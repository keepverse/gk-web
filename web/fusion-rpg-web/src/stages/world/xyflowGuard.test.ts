import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * world-stage W36: the WORLD stage never imports `@xyflow/react` as its own map HOW — a guard, not
 * a review, since a library that quietly stops being imported produces no compile error and no
 * runtime error of its own (the exact failure mode `stageIds.ts`'s own migration-risk note names
 * for `LegionMarker`).
 *
 * <b>Narrowed 2026-09-07 (party-dungeon D5.4) to `stages/world/` only, not the whole `stages/` tree
 * or the whole `src/` tree.</b> `docs/design/tech-stack.md` T3's own 2026-09-07 amendment restores
 * `@xyflow/react` for "genuine node/tree surfaces (ActorSheet Paths, passive-tree push, future
 * sector-graph *authoring*)" and retracts the prior repo-wide removal by name ("that was a
 * splitting failure dressed as a library ban") — the ONLY thing T3 still forbids is xyflow as the
 * **player world map's own HOW** on `#/world` (Phaser stays that stage's canvas). A guard scanning
 * every OTHER stage — `delve`'s own room graph among them, a genuine node/tree surface under the
 * amendment's own listed examples' spirit — enforced a decision the design doc no longer makes,
 * confirmed as a real, dated drift (not fixed silently: `DelveGraph.tsx`'s own doc comment names
 * this exact drift, found independently, before this guard was narrowed to match).
 *
 * Matches a *quoted module specifier* (the exact form a real `import`, a CSS side-effect import, or
 * a `vi.mock(...)` call always uses) rather than a bare substring, so prose that names the library
 * in a comment or a test's own description — this file's own doc comment among them — never trips
 * the guard. A backtick-quoted or unquoted mention of the library name is deliberately not enough
 * to match.
 */
const XYFLOW_REFERENCE = /["']@xyflow\/react(?:\/[^"']*)?["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function findReferences(dir: string): { file: string; line: number }[] {
  const hits: { file: string; line: number }[] = [];
  for (const file of walk(dir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      if (XYFLOW_REFERENCE.test(text)) {
        const relPath = relative(join(__dirname, "..", "..", ".."), file).split("\\").join("/");
        hits.push({ file: relPath, line: i + 1 });
      }
    });
  }
  return hits;
}

describe("xyflowGuard", () => {
  it("no file under stages/world/ imports @xyflow/react — the player map's own HOW stays Phaser (T3)", () => {
    expect(findReferences(__dirname)).toEqual([]);
  });
});
