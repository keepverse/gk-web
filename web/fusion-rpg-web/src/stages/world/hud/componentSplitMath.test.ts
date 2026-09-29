import { describe, expect, it } from "vitest";
import type { Magnitude } from "@/contract/types";
import { componentSplitFor, MAX_SPLIT_ROWS, type ComponentSplitInput } from "./componentSplitMath";

const net = (value: number): Magnitude => ({ unit: "loamUnits", value });
const c = (componentId: string, sectorCount: number, netValue: number): ComponentSplitInput => ({
  componentId,
  sectorCount,
  net: net(netValue)
});

describe("componentSplitFor — six states (world-stage W54)", () => {
  it("no territory renders a sentence, not a row of zeroes", () => {
    expect(componentSplitFor([])).toEqual({ kind: "no-territory" });
  });

  it("one component collapses entirely — nothing to split", () => {
    expect(componentSplitFor([c("a", 4, 120)])).toEqual({ kind: "collapsed" });
  });

  it("split and solvent — both rows shown, neither alarms", () => {
    const view = componentSplitFor([c("a", 4, 120), c("b", 2, 60)]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    expect(view.rows.map((r) => r.state)).toEqual(["solvent", "solvent"]);
    expect(view.foldedSolventCount).toBe(0);
  });

  it("one starving — only that row alarms", () => {
    const view = componentSplitFor([c("a", 4, 120), c("b", 2, -30)]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    const byId = new Map(view.rows.map((r) => [r.componentId, r.state]));
    expect(byId.get("a")).toBe("solvent");
    expect(byId.get("b")).toBe("starving");
  });

  it("both starving — both alarm independently", () => {
    const view = componentSplitFor([c("a", 4, -10), c("b", 2, -30)]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    expect(view.rows.every((r) => r.state === "starving")).toBe(true);
  });

  it("many components: starving sorts first and is never folded; solvent folds past two", () => {
    const view = componentSplitFor([
      c("solvent-1", 1, 10),
      c("starving-1", 1, -5),
      c("solvent-2", 1, 20),
      c("solvent-3", 1, 30),
      c("solvent-4", 1, 40)
    ]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    // Starving first, always present.
    expect(view.rows[0]!.componentId).toBe("starving-1");
    expect(view.rows[0]!.state).toBe("starving");
    // Budget left for solvent is MAX_SPLIT_ROWS(3) - 1 starving = 2, matching "folds past two".
    const shownSolvent = view.rows.filter((r) => r.state === "solvent");
    expect(shownSolvent).toHaveLength(2);
    expect(view.foldedSolventCount).toBe(2);
    expect(view.rows.length).toBeLessThanOrEqual(MAX_SPLIT_ROWS);
  });

  it("more starving components than the row budget: every starving row still shows, zero solvent", () => {
    const view = componentSplitFor([
      c("starving-1", 1, -5),
      c("starving-2", 1, -6),
      c("starving-3", 1, -7),
      c("starving-4", 1, -8),
      c("solvent-1", 1, 10)
    ]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    expect(view.rows.filter((r) => r.state === "starving")).toHaveLength(4);
    expect(view.rows.filter((r) => r.state === "solvent")).toHaveLength(0);
    expect(view.foldedSolventCount).toBe(1);
  });

  it("three solvent components, no starving: solvent still folds past two — the cap is unconditional", () => {
    const view = componentSplitFor([c("a", 1, 1), c("b", 1, 2), c("c", 1, 3)]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    expect(view.rows).toHaveLength(2);
    expect(view.foldedSolventCount).toBe(1);
  });

  it("exactly two solvent components, no starving: neither folds", () => {
    const view = componentSplitFor([c("a", 1, 1), c("b", 1, 2)]);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") throw new Error("unreachable");
    expect(view.rows).toHaveLength(2);
    expect(view.foldedSolventCount).toBe(0);
  });
});
