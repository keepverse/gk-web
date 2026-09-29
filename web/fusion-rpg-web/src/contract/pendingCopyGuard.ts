import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { GuardViolation } from "@/shell/bandGuard";

const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

/** Same dev-surface allow-list as vocabularyGuard.ts (GG-41). */
const ALLOW_LISTED_PREFIXES = [
  "dev/",
  "features/status/",
  "features/stats/",
  "features/pvz-activity/",
  "features/icon-dump/",
  "features/almanac-dump/",
  "features/cheats/",
  "features/sim/",
  "features/log/",
  "features/metrics/",
  "features/lawn/",
  "features/roster/",
  "stages/lawn/",
  "game/",
  "lib/bus/",
  "contract/pendingCopyGuard.ts"
];

/** Player-surface prefixes scanned for inline JSX / string-literal copy. */
const PLAYER_SURFACE_PREFIXES = ["stages/", "layers/", "ui/"];

/**
 * Dev/internal jargon that must never appear in player-facing pending reasons or UI copy
 * (game-gui-map.md R1b — the UI renders pending reasons verbatim).
 */
const BANNED_COPY_PATTERNS: RegExp[] = [
  /AGENTS\.md/i,
  /tasks\//i,
  /game-gui/i,
  /spec-/i,
  /\.md["')\s]/,
  /\bT\d+\b/,
  /\bGG-\d+\b/,
  /gap G\d+/i,
  /\bendpoint\b/i,
  /\bDTO\b/,
  /\breader\b/i,
  /\bwired\b/i,
  /server-side/i,
  /UniqueActor/,
  /excluded this phase/i,
  /ships today/i,
  /product direction/i,
  /\bPending\b/,
  /not wired/i,
  /no server endpoint/i,
  /isn't specced/i,
  /isn't exposed/i,
  /isn't joined/i
];

const STRING_LITERAL_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

const NON_RENDERING_ATTR_PATTERN =
  /\b(value|id|key|name|htmlFor|className|class|type|role|href|src|to|path|testId)\s*=\s*$/;

const PENDING_WITH_REASON_PATTERN = /pendingWithReason\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

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

function isAllowListed(relPath: string): boolean {
  return ALLOW_LISTED_PREFIXES.some((p) => relPath.startsWith(p) || relPath === p);
}

function isPlayerSurface(relPath: string): boolean {
  return PLAYER_SURFACE_PREFIXES.some((p) => relPath.startsWith(p));
}

function findBannedInText(text: string): RegExp | null {
  for (const pattern of BANNED_COPY_PATTERNS) {
    if (pattern.test(text)) return pattern;
  }
  return null;
}

function scanPendingWithReasonCalls(text: string, relPath: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const lines = text.split(/\r?\n/);

  for (const match of text.matchAll(PENDING_WITH_REASON_PATTERN)) {
    const literal = match[1]!;
    const inner = literal.slice(1, -1);
    const banned = findBannedInText(inner);
    if (!banned) continue;

    const line = text.slice(0, match.index!).split("\n").length;
    violations.push({
      file: relPath,
      line,
      text: lines[line - 1]?.trim() ?? inner
    });
  }

  return violations;
}

function scanPlayerSurfaceLiterals(text: string, relPath: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (line.includes("data-testid") || line.includes("data-test-id")) return;
    if (/^\s*import\s/.test(line) || /\bfrom\s+["']/.test(line)) return;

    const jsxTextSegments = line.match(/>[^<>{]*</g) ?? [];
    for (const seg of jsxTextSegments) {
      const inner = seg.slice(1, -1);
      if (findBannedInText(inner)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
        return;
      }
    }

    for (const match of line.matchAll(STRING_LITERAL_PATTERN)) {
      const literal = match[0];
      const before = line.slice(0, match.index);
      if (NON_RENDERING_ATTR_PATTERN.test(before)) continue;
      const staticParts = literal.startsWith("`") ? literal.replace(/\$\{[^}]*\}/g, "") : literal;
      const inner = staticParts.slice(1, -1);
      if (findBannedInText(inner)) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
        return;
      }
    }
  });

  return violations;
}

/**
 * R1b enforcement: pending reasons and player-surface string literals must use player vocabulary,
 * not task notes, spec filenames, or wiring jargon.
 */
export function scanForDevCopyInPlayerStrings(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];

  walk(srcDir, (filePath) => {
    const relPath = relative(srcDir, filePath).split("\\").join("/");
    if (isAllowListed(relPath)) return;

    const text = readFileSync(filePath, "utf8");
    violations.push(...scanPendingWithReasonCalls(text, relPath));

    if (isPlayerSurface(relPath)) {
      violations.push(...scanPlayerSurfaceLiterals(text, relPath));
    }
  });

  return violations;
}
