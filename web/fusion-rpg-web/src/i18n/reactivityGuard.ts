import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type GuardViolation = {
  file: string;
  line: number;
  text: string;
};

const SCANNABLE_EXTENSIONS = new Set([".tsx"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

function walk(rootDir: string, onFile: (filePath: string) => void): void {
  for (const entry of readdirSync(rootDir)) {
    if (SKIPPED_DIR_NAMES.has(entry)) continue;
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath);
    }
  }
}

/**
 * The bug this guards against (found live, T6 — see web/spec.md §13): the
 * bare `t` macro from `@lingui/macro` compiles to a call against the global
 * `i18n` singleton with no React subscription. A component using only that
 * has nothing wiring it to `I18nProvider`'s context, so a locale switch
 * elsewhere in the tree never causes it to re-render. Every `.tsx` component
 * should import `msg` and resolve it through `useLingui()`'s `_` instead.
 * `t` stays legitimate in non-component code (nothing in this codebase does
 * that yet), which is why this only scans `.tsx`.
 */
const BARE_T_IMPORT_PATTERN = /import\s+\{[^}]*\bt\b[^}]*\}\s+from\s+["']@lingui\/macro["']/;

export function scanForBareTMacroInComponents(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(srcDir, (filePath) => {
    const relPath = relative(srcDir, filePath).split("\\").join("/");
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (BARE_T_IMPORT_PATTERN.test(line)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
      }
    });
  });
  return violations;
}
