import { describe, expect, it, vi } from "vitest";
import { applyOutlinerFilter, buildOutlinerGroups } from "./outlinerModel";
import { EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS } from "./fixtures/empire28";

describe("outlinerModel — the pure model (world-stage W90)", () => {
  it("runs over the 28-row fixture: two groups with the real counts", () => {
    const groups = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    expect(groups).toHaveLength(2);
    const legionGroup = groups.find((g) => g.kind === "legion")!;
    const sectorGroup = groups.find((g) => g.kind === "sector")!;
    expect(legionGroup.count).toBe(10);
    expect(sectorGroup.count).toBe(18);
    expect(legionGroup.count + sectorGroup.count).toBe(28);
  });

  it("anything flagged sorts above anything quiet, stable below that — proven by reversing the input", () => {
    // Stability means: whatever relative order equal-priority rows arrived in is the order they
    // keep. Feeding the reversed fixture must therefore produce the *reversed* relative order among
    // the quiet rows too — the opposite would mean the sort is silently keying on something besides
    // input order (e.g. alphabetising ids), which is exactly the defect this test exists to catch.
    const forward = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    const reversedInput = buildOutlinerGroups([...EMPIRE_28_LEGIONS].reverse(), [...EMPIRE_28_SECTORS].reverse(), []);

    for (const groupKind of ["legion", "sector"] as const) {
      const forwardGroup = forward.find((g) => g.kind === groupKind)!;
      const reversedGroup = reversedInput.find((g) => g.kind === groupKind)!;

      // Every flagged row still precedes every quiet row, in both runs.
      for (const group of [forwardGroup, reversedGroup]) {
        const firstQuietIndex = group.rows.findIndex((r) => !r.flagged);
        if (firstQuietIndex >= 0) {
          expect(group.rows.slice(0, firstQuietIndex).every((r) => r.flagged)).toBe(true);
          expect(group.rows.slice(firstQuietIndex).every((r) => !r.flagged)).toBe(true);
        }
      }

      const quietIds = forwardGroup.rows.filter((r) => !r.flagged).map((r) => r.id);
      const quietIdsFromReversedInput = reversedGroup.rows.filter((r) => !r.flagged).map((r) => r.id);
      expect(quietIdsFromReversedInput).toEqual([...quietIds].reverse());
    }
  });

  it("needs-orders filter: only flagged legions, no sectors at all", () => {
    const groups = applyOutlinerFilter(buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []), "needs-orders");
    const legionGroup = groups.find((g) => g.kind === "legion")!;
    const sectorGroup = groups.find((g) => g.kind === "sector")!;
    expect(legionGroup.rows.every((r) => r.flagged)).toBe(true);
    expect(legionGroup.rows.length).toBeGreaterThan(0);
    expect(sectorGroup.rows).toEqual([]);
  });

  it("fading filter: only flagged sectors, no legions at all", () => {
    const groups = applyOutlinerFilter(buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []), "fading");
    const legionGroup = groups.find((g) => g.kind === "legion")!;
    const sectorGroup = groups.find((g) => g.kind === "sector")!;
    expect(sectorGroup.rows.every((r) => r.flagged)).toBe(true);
    expect(sectorGroup.rows.length).toBeGreaterThan(0);
    expect(legionGroup.rows).toEqual([]);
  });

  it("all filter: every row, unfiltered", () => {
    const built = buildOutlinerGroups(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    expect(applyOutlinerFilter(built, "all")).toEqual(built);
  });

  it("the unresolved flag is unresolvedLegions.ts's own export — stubbing it changes the rows", async () => {
    vi.doMock("@/stages/world/turn/unresolvedLegions", () => ({
      unresolvedLegions: () => [] // nobody is ever unresolved
    }));
    vi.resetModules();
    const { buildOutlinerGroups: rebuilt } = await import("./outlinerModel");

    const groups = rebuilt(EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS, []);
    const legionGroup = groups.find((g) => g.kind === "legion")!;
    expect(legionGroup.rows.every((r) => !r.flagged)).toBe(true);

    vi.doUnmock("@/stages/world/turn/unresolvedLegions");
    vi.resetModules();
  });
});
