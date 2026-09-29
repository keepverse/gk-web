import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForBannedVocabulary } from "./vocabularyGuard";

const srcDir = join(__dirname, "..");

describe("vocabularyGuard — real tree", () => {
  it("no player surface renders a banned engine/protocol word (GG-23)", () => {
    expect(scanForBannedVocabulary(srcDir)).toEqual([]);
  });
});

describe("vocabularyGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a banned word rendered as JSX text on a player surface", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      "export const Rogue = () => <p>Equip compiles grant templates into mods_json</p>;\n"
    );
    const violations = scanForBannedVocabulary(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "layers/Rogue.tsx", line: 1 });
  });

  it("flags a banned word inside a rendered string literal", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      'export const label = "UniqueActor Cold specimens";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toHaveLength(1);
  });

  it("does not flag the word used as a code identifier, not copy", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      "export function f(actor: { typeId: number }) { return actor.typeId; }\n"
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("identity-rename T18: an identifier carrying a retired name does not trip it", () => {
    // The acceptance names exactly these two. They are safe for two reasons at once - the names are
    // matched in copy only, and the identifiers that carry them are camel/kebab-case (`PvzStatsPage`,
    // `commander:dave`, `actor.penny.name`) where the banned forms are capitalised proper nouns - and
    // that is the contract: a rename must not force a code identifier to move (owner ruling R9).
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      `import { PvzStatsPage } from "@/features/pvz-stats/PvzStatsPage";
export const commander = "commander:dave";
export const messageId = "actor.penny.name";
export function f(x: { zombossId: number }) { return x.zombossId; }
`
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag a data-testid carrying a banned word as an identifier", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      'export const x = <button data-testid="lawn-spawn-typeid">Go</button>;\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag developer surfaces (GG-41 allow-list)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "dev"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "dev", "Rogue.tsx"),
      "export const Rogue = () => <p>UniqueActor typeId ptr matchKey Admit revision</p>;\n"
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  // The symbol half of GG-23. Both of these passed the guard before 2026-09-05: every BANNED_WORDS
  // entry is wrapped in `\b...\b`, and neither symbol is a word character, so listing them there
  // matched nothing at all. Written as fixtures rather than as a list assertion so the test fails
  // if the *matching* regresses, not merely if the list is edited.
  it("flags the power index letter rendered as JSX text on its own line", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      "export const Rogue = ({ theta }: { theta: number }) => (\n  <p>\n    spent (\u0398={theta})\n  </p>\n);\n"
    );
    const violations = scanForBannedVocabulary(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "layers/Rogue.tsx", line: 3 });
  });

  it("flags the per-mille sign inside a rendered string literal", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      'export const label = "carrying 610\u2030 of the load";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toHaveLength(1);
  });

  it("does not flag an engine symbol inside a comment", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      "// a stat modifier's own \"+400\u2030 more\" reading\nexport const x = 1;\n"
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag an unrelated word that merely contains a banned substring", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      'export const label = "A coldwind swept the revisions of the plan";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });
});

// D5.10 (spec-delve-stage.md §8, `:178-179`) — the ten words the delve stage's own vocabulary
// extension adds. `stages/delve/` and `layers/delve/` are deliberately NOT allow-listed (§8: "this
// is player chrome, with no developer exemption to claim"), so these fixtures use those exact
// directory shapes rather than a generic `layers/` name, matching the spec's own testing table
// (`:283`: "vocabularyGuard over stages/delve/ and layers/delve/ with the new words").
describe("vocabularyGuard — delve extension, No_engine_token_reaches_player_text (D5.10)", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("No_engine_token_reaches_player_text — each of the ten new words is caught, individually, when rendered as player text under stages/delve/", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-delve-"));
    mkdirSync(join(fixtureDir, "stages", "delve"), { recursive: true });
    const newWords = [
      "bandDelta",
      "dangerBand",
      "PartyIndex",
      "Retired",
      "thetaOffset",
      "rungId",
      "delveId",
      "sectorId",
      "archetypeId",
      "perMille"
    ];
    // One line per word, in one file — each line is its own independent match, so the count below
    // proves every single word is caught, not just that the file as a whole is non-empty.
    const body = newWords.map((w) => `<p>engine leaked the raw ${w} here</p>`).join("\n");
    writeFileSync(join(fixtureDir, "stages", "delve", "Leaky.tsx"), `${body}\n`);

    const violations = scanForBannedVocabulary(fixtureDir);
    expect(violations).toHaveLength(newWords.length);
    newWords.forEach((_, i) => expect(violations[i]).toMatchObject({ file: "stages/delve/Leaky.tsx", line: i + 1 }));
  });

  it("No_engine_token_reaches_player_text — the same ten words are also caught under layers/delve/, the panel-layer half of §8's own testing table", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-delve-"));
    mkdirSync(join(fixtureDir, "layers", "delve"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "layers", "delve", "DomainOfferRow.tsx"),
      'export const label = "rungId not yet resolved";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toHaveLength(1);
  });

  it("does not flag the ten new words used as code identifiers, not copy — the same copy-vs-code narrowing the rest of BANNED_WORDS already gets", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-delve-"));
    mkdirSync(join(fixtureDir, "stages", "delve"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "stages", "delve", "Clean.ts"),
      "export function f(room: { archetypeId: string; sectorId: string; rungId: string; delveId: number }) {\n" +
        "  const bandDelta = 0; const dangerBand = 1; const thetaOffset = 2; const perMille = 3;\n" +
        "  return room.archetypeId + room.sectorId + room.rungId + room.delveId + bandDelta + dangerBand + thetaOffset + perMille;\n" +
        "}\n"
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("does not flag a word that merely contains a new banned word as a substring (word-boundary check, not just a doc claim)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-delve-"));
    mkdirSync(join(fixtureDir, "stages", "delve"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "stages", "delve", "Clean.tsx"),
      // "perMilleRatio" contains "perMille"; "rungIdOrTailLabel" contains "rungId" — neither has a
      // word boundary right after the banned substring, so `\bperMille\b`/`\brungId\b` must not match.
      'export const a = "unit perMilleRatio shown as a percent";\n' +
        'export const b = "resume carries rungIdOrTailLabel, not a rung on its own";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });

  it("`once` and `many` are deliberately not banned words — both render freely as ordinary English", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "vocab-guard-delve-"));
    mkdirSync(join(fixtureDir, "stages", "delve"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "stages", "delve", "Prose.tsx"),
      'export const a = "You may only enter once."; export const b = "Many bands may enter here.";\n'
    );
    expect(scanForBannedVocabulary(fixtureDir)).toEqual([]);
  });
});
