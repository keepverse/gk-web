import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Prediction tripwire (phaser-kernel board-contract / RT-15).
 *
 * Allowed (rendering): interpolate between two **server-confirmed** positions.
 * Forbidden (prediction): extrapolate past the last confirmed state; invent living set.
 *
 * Until a confirmed-lerp helper lands under an allow-listed name, board/ + camera/ must not
 * contain tween/rAF/lerp/extrapolate calls. When confirmed lerp is added, it must live in a
 * file that documents confirmed endpoints and must not match FORBIDDEN_EXTRAPOLATION patterns.
 */

const SCANNED_DIRS = ["board", "camera"];

/** Any of these in production sources fail the tripwire today (no lerp merges yet). */
const MOTION_PATTERNS: RegExp[] = [
  /\.tween\(/,
  /\btweens\.add\(/i,
  /requestAnimationFrame\(/,
  /\blerp\(/,
  /\binterpolate\(/,
  /\bextrapolate\(/
];

/** Explicit extrapolation vocabulary — always forbidden even after confirmed-lerp lands. */
const FORBIDDEN_EXTRAPOLATION: RegExp[] = [
  /\bextrapolate\(/,
  /\bpredict(ed|ion)?\b/i,
  /\bvelocity\s*\*\s*dt\b/i,
  /\blastConfirmed\s*\+/
];

function sourceFiles(dir: string): Array<{ path: string; contents: string }> {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => {
      const path = join(dir, name);
      return { path, contents: readFileSync(path, "utf8") };
    });
}

describe("board/camera client prediction tripwire (confirmed vs extrapolation)", () => {
  const gameDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const files = SCANNED_DIRS.flatMap((d) => sourceFiles(join(gameDir, d)));

  it("scanned at least one file per directory", () => {
    expect(files.length).toBeGreaterThanOrEqual(SCANNED_DIRS.length);
  });

  it.each(MOTION_PATTERNS.map((pattern) => [pattern.toString(), pattern] as const))(
    "no production motion/lerp until confirmed-lerp helper lands: %s",
    (_label, pattern) => {
      const hit = files.find((f) => pattern.test(f.contents));
      expect(hit, hit ? `${pattern} matched in ${hit.path}` : undefined).toBeUndefined();
    }
  );

  it.each(FORBIDDEN_EXTRAPOLATION.map((pattern) => [pattern.toString(), pattern] as const))(
    "forbidden extrapolation vocabulary: %s",
    (_label, pattern) => {
      const hit = files.find((f) => pattern.test(f.contents));
      expect(hit, hit ? `${pattern} matched in ${hit.path}` : undefined).toBeUndefined();
    }
  );

  it("documents allowed confirmed-lerp vs forbidden extrapolation in this suite", () => {
    // Fixture contract (no code path yet): confirmed A→B is rendering; past B is prediction.
    const confirmedFrom = { x: 0, y: 0, revision: 1 };
    const confirmedTo = { x: 10, y: 0, revision: 2 };
    const t = 0.5;
    const renderedX =
      confirmedFrom.x + (confirmedTo.x - confirmedFrom.x) * t; // allowed math shape
    expect(renderedX).toBe(5);
    const lastConfirmed = confirmedTo;
    const extrapolatedX = lastConfirmed.x + 10; // forbidden shape — must not ship in board/
    expect(extrapolatedX).toBe(20);
    expect(confirmedTo.revision).toBeGreaterThan(confirmedFrom.revision);
  });
});
