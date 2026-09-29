import { describe, expect, it } from "vitest";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { unresolvedLegions } from "./unresolvedLegions";
import { TEN_LEGIONS } from "./fixtures/legions";

const orderFor = (entityId: string): PendingOrder => ({
  commandId: "c-" + entityId,
  kind: "stand-fast",
  entityId,
  label: "stand fast"
});

describe("unresolvedLegions — the one derivation (world-stage W77)", () => {
  it("counts 1000 and 500 per-mille movement as unresolved when no order is filed", () => {
    const unresolved = unresolvedLegions(TEN_LEGIONS, []);
    const ids = unresolved.map((l) => l.entityId);

    expect(ids).toContain("e-1"); // march, 1000
    expect(ids).toContain("e-3"); // scout, 500
  });

  it("never counts 0 per-mille movement, regardless of stance", () => {
    const unresolved = unresolvedLegions(TEN_LEGIONS, []);
    const ids = unresolved.map((l) => l.entityId);

    expect(ids).not.toContain("e-7");
    expect(ids).not.toContain("e-8");
    expect(ids).not.toContain("e-9");
  });

  it("over all 10 legions with no orders, exactly the 7 non-zero-movement legions are unresolved", () => {
    const unresolved = unresolvedLegions(TEN_LEGIONS, []);
    expect(unresolved).toHaveLength(7);
  });

  it("a filed order removes that legion from the unresolved set, and nothing else", () => {
    const unresolved = unresolvedLegions(TEN_LEGIONS, [orderFor("e-1"), orderFor("e-3")]);
    const ids = unresolved.map((l) => l.entityId);

    expect(ids).not.toContain("e-1");
    expect(ids).not.toContain("e-3");
    expect(ids).toContain("e-5"); // untouched march/1000 legion
    expect(unresolved).toHaveLength(5);
  });

  it("at 6 legions (the first six, all non-zero movement), the count is 6 minus however many are ordered", () => {
    const six = TEN_LEGIONS.slice(0, 6);
    expect(unresolvedLegions(six, [])).toHaveLength(6);
    expect(unresolvedLegions(six, [orderFor("e-2"), orderFor("e-4")])).toHaveLength(4);
  });

  it("holds no state and exports exactly one function", async () => {
    const module = await import("./unresolvedLegions");
    expect(Object.keys(module)).toEqual(["unresolvedLegions"]);
  });
});
