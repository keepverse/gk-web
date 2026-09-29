import { describe, expect, it } from "vitest";
import { ACTOR_PROGRESSION_KINDS, foldActorLedger, foldActorRows, isActorProgressionKind } from "./actorProgressionFold";

/**
 * `empire-progression` EP4.8, test 10. The server's progression table gained a `kind = 'empire'` row
 * (EP4.1), so an unfiltered read returns a row that is not an actor. This pins the fold every
 * unfiltered reader on the progression page goes through: an empire row never reaches a surface that
 * means actors, and the actor rows it sits beside are untouched.
 */
describe("the actor progression fold", () => {
  const empireRow = { kind: "empire", typeId: 0, level: 4, xp: 7 };
  const actorRows = [
    { kind: "player", typeId: 0, level: 12, xp: 3 },
    { kind: "plant", typeId: 7, level: 5, xp: 1 },
    { kind: "zombie", typeId: 3, level: 2, xp: 9 }
  ];

  it("never lets an empire row through to an actor surface", () => {
    const folded = foldActorRows([empireRow, ...actorRows]);
    expect(folded.map((r) => r.kind)).toEqual(["player", "plant", "zombie"]);
    expect(folded).not.toContain(empireRow);
    expect(folded.length).toBe(actorRows.length);
  });

  it("drops the other non-actor kinds too, not only empire", () => {
    const folded = foldActorRows([...actorRows, { kind: "species", typeId: 60007 }, { kind: "specimen", typeId: 1 }]);
    expect(folded.length).toBe(actorRows.length);
  });

  it("classifies the closed actor set, and empire is outside it", () => {
    expect(ACTOR_PROGRESSION_KINDS).toEqual(["player", "plant", "zombie"]);
    expect(isActorProgressionKind("empire")).toBe(false);
    expect(isActorProgressionKind("species")).toBe(false);
    expect(isActorProgressionKind("player")).toBe(true);
  });

  it("keeps only actor rows out of a mixed ledger page", () => {
    const ledger = [
      { id: 1, kind: "player", typeId: 0 },
      { id: 2, kind: "empire", typeId: 0 },
      { id: 3, kind: "plant", typeId: 7 }
    ] as never[];
    // The fold is generic over anything carrying `kind`, so this pins the ledger call site too.
    expect(foldActorRows(ledger).map((r) => (r as { id: number }).id)).toEqual([1, 3]);
  });
});
