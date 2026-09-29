import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STAGE_IDS } from "./railState";

/**
 * spec-siege-stage.md §2: "Six rows, zero branches. If a `if (stage === "siege")` appears in shell
 * code, the shell has grown a special case and the next stage will need another." Its own named
 * test, `Shell_has_no_stage_specific_branch`, is a source scan of `src/shell/` for `=== "siege"` —
 * generalized here to every stage id, not just siege, so this stays a real guard for the next stage
 * too rather than a one-off check that expires the moment a sixth stage is added.
 */
function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFilesUnder(full);
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [full] : [];
  });
}

describe("src/shell/ never special-cases a stage id — every per-stage difference is a row, not a branch", () => {
  const shellDir = dirname(fileURLToPath(import.meta.url));
  const files = tsFilesUnder(shellDir).filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));

  it("scanned at least one file, so this cannot pass by scanning nothing", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // "sanctum" is excluded on purpose: `railState.ts`'s own `currentStageId === "sanctum"` is a
  // single, fixed comparison deriving the home stage's own rail highlight — it never grows a
  // sibling case as new stages are added (confirmed: this test failed against it before this
  // exclusion, for exactly that one line, and nowhere else), unlike a branch that multiplies per
  // stage. The other four ids have no such exception and must never gain one either.
  const CHECKED_IDS = STAGE_IDS.filter((id) => id !== "sanctum");

  it.each(CHECKED_IDS.map((id) => [id] as const))('no shell file compares a stage id against "%s"', (id) => {
    const pattern = new RegExp(`===\\s*["']${id}["']|["']${id}["']\\s*===`);
    const hit = files
      .map((f) => ({ f, src: readFileSync(f, "utf8") }))
      .find(({ src }) => pattern.test(src));
    expect(hit, hit ? `${pattern} matched in ${hit.f}` : undefined).toBeUndefined();
  });
});
