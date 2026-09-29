import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForHardcodedPassiveVocabulary } from "./passiveVocabularyGuard";

const srcDir = join(__dirname, "..");

describe("passiveVocabularyGuard — real tree", () => {
  it("no passive-tree surface file hardcodes a currency/track word outside passiveTreeVocabulary.ts (I10)", () => {
    expect(scanForHardcodedPassiveVocabulary(srcDir)).toEqual([]);
  });
});

describe("passiveVocabularyGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  function writeSurfaceFile(relPath: string, content: string): string {
    const fullPath = join(fixtureDir, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
    return relPath;
  }

  it("flags a bare 'points' reaching player text", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "ui/actor/PlanPanel.tsx",
      'export const x = <p>{n} points spent</p>;\n'
    );
    const violations = scanForHardcodedPassiveVocabulary(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "ui/actor/PlanPanel.tsx", line: 1 });
  });

  it("does not flag the real fixed shape -- the word never appears literally, only via vocabulary interpolation", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "ui/actor/PathLattice.tsx",
      "export const x = <p>{n} {PASSIVE_TREE_VOCABULARY.currency.aptitudePoints}, {m} {PASSIVE_TREE_VOCABULARY.currency.skillPoints}</p>;\n"
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });

  it("flags 'aptitude points' hardcoded outside the vocabulary module", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "contract/passivesLattice.ts",
      'export const text = `Opens at ${need} aptitude points.`;\n'
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toHaveLength(1);
  });

  it("flags 'skill points' hardcoded outside the vocabulary module", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile("ui/actor/PlanPanel.tsx", 'export const x = <p>{price.skillPoints} skill points</p>;\n');
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toHaveLength(1);
  });

  it("flags a hardcoded 'souls'/'Unlock'/'Depth' on a passive-tree surface file", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile("ui/actor/PlanPanel.tsx", 'export const x = <p>{price.souls} souls</p>;\n');
    writeSurfaceFile("ui/actor/PathLattice.tsx", 'export const y = <button>Unlock</button>;\n');
    writeSurfaceFile("ui/actor/TraitDetail.tsx", 'export const z = <p>Depth {n}</p>;\n');
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toHaveLength(3);
  });

  it("does not flag the words inside identifiers (word-boundary anchored)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "ui/actor/PassivesTab.tsx",
      "export const x = tree.data.skillPointsAvailable + currentDepth + onUnlock() + soulLevelByNodeId;\n"
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag a data-testid carrying one of these words as an identifier", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "ui/actor/PlanPanel.tsx",
      'export const x = <p data-testid="plan-skill-points">{price.skillPoints} {V.currency.skillPoints}</p>;\n'
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag the words inside a comment", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "contract/passivesLattice.ts",
      "// Never the bare word points alone -- always aptitude points, naming the wallet.\nexport const x = 1;\n"
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });

  it("never scans passiveTreeVocabulary.ts itself, even if the file list is edited to include it", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    writeSurfaceFile(
      "contract/passiveTreeVocabulary.ts",
      'export const PASSIVE_TREE_VOCABULARY = { currency: { souls: "souls" } };\n'
    );
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });

  it("skips a file from the fixed list that does not exist in this fixture", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "passive-vocab-guard-"));
    // No files written at all -- every entry in PASSIVE_TREE_SURFACE_FILES is missing.
    expect(scanForHardcodedPassiveVocabulary(fixtureDir)).toEqual([]);
  });
});
