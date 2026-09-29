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

/**
 * GG-39 / spec-tree-surface.md §10: "Everything in this module works with the game closed... no
 * new write surface, and nothing gates on the game being open." The narrow, checkable form of that
 * rule: `HealthDto.injectorConnected` (`lib/bus/types.ts:19`) is the ONLY wire signal a surface
 * could use to decide "the injector is attached," so a player surface that branches on it is the
 * exact defect GG-39 forbids — a screen that renders differently, or not at all, depending on
 * whether the desktop game happens to be running.
 *
 * Today there is exactly one legitimate reference outside the type declaration itself:
 * `SystemLayer.tsx`'s own connection-status readout, which only ever choose between two strings to
 * DISPLAY the state — it never hides a control, disables an action, or returns null because of it.
 * Every other occurrence, on any current or future player surface (the passive-tree module
 * included, per spec-tree-surface.md §10), is a violation: a surface may show connection status,
 * but it may never gate on it.
 */
const ALLOW_LISTED_PATHS = new Set([
  // The one legitimate display of connection state — it always renders both branches as text.
  "layers/system/SystemLayer.tsx",
  // The wire type declaration itself — the field has to be named somewhere.
  "lib/bus/types.ts",
  // This guard's own source, which has to name the field to forbid using it.
  "ui/injectorAbsentGuard.ts"
]);

const INJECTOR_CONNECTED_PATTERN = /\binjectorConnected\b/;

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
 * GG-39: scans player-facing source for `injectorConnected`. A hit outside the allow-list means
 * some surface reads whether the desktop injector is attached — standalone-first (§10) says no
 * surface may do that, whether to gate a whole screen, disable a control, or render a placeholder
 * instead of real content. Comments are skipped (prose mentioning the rule is not a violation of it).
 */
export function scanForInjectorGating(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(srcDir, (filePath) => {
    const relPath = relative(srcDir, filePath).split("\\").join("/");
    if (ALLOW_LISTED_PATHS.has(relPath)) return;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (INJECTOR_CONNECTED_PATTERN.test(line)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
      }
    });
  });
  return violations;
}
