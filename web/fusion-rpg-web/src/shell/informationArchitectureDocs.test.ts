import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STAGE_IDS } from "./railState";

/**
 * spec-siege-stage.md §2 cost 2: "IA documentation is now wrong in three places... correct
 * design/information-architecture.md §1... and the verb table's Space row." Its own named test,
 * `IA_docs_name_five_stages`, exists specifically "so cost 2 cannot be silently skipped" — a docs
 * correction has no compiler and no runtime behavior to catch a forgotten one, so this reads the doc
 * from disk and asserts it actually names the current stage set, the same way `GridSpec.test.ts`
 * reads a sibling source file to assert an invariant about it.
 */
function readDoc(relativePath: string): string {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("information-architecture.md names siege as a real, landed stage", () => {
  const doc = readDoc("docs/design/information-architecture.md");

  it("has a §2.4b Siege catalog entry", () => {
    expect(doc).toMatch(/### 2\.4b Siege/);
  });

  it("names every current STAGE_IDS entry somewhere in the doc", () => {
    for (const id of STAGE_IDS) {
      expect(doc, `information-architecture.md never mentions the "${id}" stage id`).toMatch(
        new RegExp(`\\b${id}\\b`, "i")
      );
    }
  });

  it("the verb table's Space row now includes siege, not just lawn and battle", () => {
    const spaceRow = doc.split("\n").find((line) => line.startsWith("| `Space`"));
    expect(spaceRow).toBeDefined();
    expect(spaceRow).toMatch(/\bsiege\b/i);
  });
});

describe("game-gui-principles.md's D2 decision row is amended, not silently stale", () => {
  const doc = readDoc("docs/architecture/game-gui-principles.md");

  it("D2 no longer just says 'four stages' with no amendment note", () => {
    const d2Row = doc.split("\n").find((line) => line.startsWith("| D2 "));
    expect(d2Row).toBeDefined();
    expect(d2Row).toMatch(/[Aa]mended/);
  });
});
