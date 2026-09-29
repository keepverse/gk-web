import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export type GuardViolation = {
  file: string;
  line: number;
  text: string;
};

const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage", "theme"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

/**
 * One principled exclusion, not a loophole: `game/` is Phaser's canvas/WebGL rendering — it sits
 * outside the CSSOM entirely, so a `var(--color-*)` reference structurally cannot resolve there;
 * bridging that (reading computed CSS custom properties at runtime and feeding them into Phaser's
 * colour APIs) is a real, separate piece of work, not a side effect of T7. The same files are
 * already carved out of the coverage include list for the same reason (vite.config.ts).
 *
 * `features/world/` was exempted here (T16, 2026-08-23 owner decision) "until its own plan
 * lands" — `world-stage` W49 is that plan: every hex literal in the old tree was mapped onto an
 * existing semantic token (`LaneEdge.tsx`, `LegionMarker.tsx`), so the exemption is retired rather
 * than renewed.
 */
const SKIPPED_PATH_PREFIXES = ["game/"];

function walk(rootDir: string, relBase: string, onFile: (filePath: string, relPath: string) => void): void {
  for (const entry of readdirSync(rootDir)) {
    if (SKIPPED_DIR_NAMES.has(entry)) continue;
    const fullPath = join(rootDir, entry);
    const relPath = relBase ? `${relBase}/${entry}` : entry;
    if (SKIPPED_PATH_PREFIXES.some((prefix) => `${relPath}/`.startsWith(prefix))) continue;
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, relPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath, relPath);
    }
  }
}

/** #rgb, #rgba, #rrggbb, #rrggbbaa — a hex colour, not a router hash (`#/lawn`) or an id selector (`#root`, non-hex letters). */
const HEX_COLOR_PATTERN = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

export function scanForHexLiterals(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(srcDir, "", (filePath, relPath) => {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (HEX_COLOR_PATTERN.test(line)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
      }
    });
  });
  return violations;
}
