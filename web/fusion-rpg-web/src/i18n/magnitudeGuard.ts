import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type GuardViolation = {
  file: string;
  line: number;
  text: string;
};

const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx"]);
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
 * GG-46's guard, exactly as spec-magnitude-and-units.md §7 states it:
 * *"There is no overload accepting a bare number. That omission is the
 * GG-46 guard."* — scoped to the `Magnitude` vocabulary itself
 * (`src/i18n/`, where `formatMagnitude` and its siblings live), not every
 * `format*(number)` helper in the app. A duration formatter like
 * `expeditionTime.ts`'s `formatRemaining(ms: number)` is a different,
 * pre-existing concern (a countdown string, not a game-balance `Magnitude`)
 * and is correctly out of scope here.
 */
const BARE_NUMBER_FORMATTER_PATTERN = /export\s+function\s+format\w*\s*\(\s*\w+\s*:\s*number\b/i;

export function scanForBareNumberFormatters(i18nDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(i18nDir, (filePath) => {
    const relPath = relative(i18nDir, filePath).split("\\").join("/");
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (BARE_NUMBER_FORMATTER_PATTERN.test(line)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
      }
    });
  });
  return violations;
}
