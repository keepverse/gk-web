import { describe, expect, it } from "vitest";
import { GRID_X, GRID_Y, sectorCenter } from "../layout";
import {
  planBlockedMark,
  planLensMarks,
  planLifelineHalos,
  planQueuedRoutes,
  planRangeRings,
  planSelectionHalo,
  planSupplyCutoffs,
  planWorldOverlay,
  type OverlayModelSlice
} from "./worldOverlayPlan";
import type { SectorView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";

function sector(partial: Partial<SectorView> & Pick<SectorView, "sectorId" | "layoutX" | "layoutY">): SectorView {
  return {
    sectorId: partial.sectorId,
    typeId: "plain",
    climate: null,
    intel: "Watched",
    intelAge: 0,
    ownerFactionId: "player",
    phase: "Anchored",
    dangerBand: { unit: "count", value: 0 },
    developmentLevel: { unit: "count", value: 0 },
    stability: { unit: "perMilleRatio", value: 1000, op: "flat" },
    pressure: { unit: "perMilleRatio", value: 0, op: "flat" },
    fractureIntensity: { unit: "perMilleRatio", value: 1000, op: "absolute" },
    habitable: true,
    layoutX: partial.layoutX,
    layoutY: partial.layoutY,
    loam: {
      production: { unit: "loamUnits", value: 1 },
      upkeep: { unit: "loamUnits", value: 0 },
      net: { unit: "loamUnits", value: 1 },
      stock: { unit: "loamUnits", value: 0 },
      capacity: pendingWithReason("n/a"),
      upkeepBreakdown: {
        base: { unit: "loamUnits", value: 0 },
        garrison: { unit: "loamUnits", value: 0 },
        development: { unit: "loamUnits", value: 0 },
        danger: { unit: "loamUnits", value: 0 },
        intensityMilli: { unit: "perMilleRatio", value: 1000, op: "absolute" },
        handicapMilli: { unit: "perMilleRatio", value: 1000, op: "absolute" }
      }
    },
    component: {
      componentId: "c1",
      production: { unit: "loamUnits", value: 1 },
      upkeep: { unit: "loamUnits", value: 0 },
      net: { unit: "loamUnits", value: 1 },
      stock: { unit: "loamUnits", value: 0 }
    },
    willReleaseNextTurn: false,
    lifelineCost: pendingWithReason("ask"),
    lifeline: pendingWithReason("ask"),
    wardenBindingId: pendingWithReason("n/a"),
    neglectedTurns: pendingWithReason("n/a"),
    ...partial
  };
}

describe("worldOverlayPlan", () => {
  it("plans a selection halo at the given centre", () => {
    const halo = planSelectionHalo({ x: 10, y: 20 });
    expect(halo).toEqual({ kind: "selection-halo", x: 10, y: 20, radius: 28 });
  });

  it("plans range rings with solid vs dashed by hop band (non-colour)", () => {
    const model: OverlayModelSlice = {
      sectors: [sector({ sectorId: "a", layoutX: 0, layoutY: 0 }), sector({ sectorId: "b", layoutX: 1, layoutY: 0 })]
    };
    const rings = planRangeRings(model, {
      reachable: [
        { sectorId: "a", hops: 1 },
        { sectorId: "b", hops: 3 }
      ]
    });
    expect(rings).toHaveLength(2);
    expect(rings[0]!.dash).toBe("solid");
    expect(rings[1]!.dash).toBe("dashed");
    expect(rings[0]!.x).toBe(sectorCenter(0, 0).x);
  });

  it("plans queued routes along lane centres and a destination flag", () => {
    const model: OverlayModelSlice = {
      sectors: [
        sector({ sectorId: "a", layoutX: 0, layoutY: 0 }),
        sector({ sectorId: "b", layoutX: 1, layoutY: 0 })
      ],
      lanes: [
        {
          laneId: "l1",
          fromSectorId: "a",
          toSectorId: "b",
          typeId: "Road",
          length: { unit: "count", value: 1 },
          width: { unit: "count", value: 1 },
          hazard: { unit: "perMilleRatio", value: 0, op: "flat" },
          wardLevel: { unit: "count", value: 0 },
          state: "Open",
          gateKeyId: pendingWithReason("n/a")
        }
      ]
    };
    const { segments, flags } = planQueuedRoutes(model, {
      pending: [{ commandId: "c1", kind: "move", sectorId: "b", lanePath: ["l1"] }]
    });
    expect(segments).toHaveLength(1);
    expect(segments[0]!.dash).toBe("dashed");
    expect(segments[0]!.x1).toBe(GRID_X / 2);
    expect(segments[0]!.x2).toBe(GRID_X + GRID_X / 2);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.y).toBe(GRID_Y / 2);
  });

  it("plans a blocked mark at the decision sector", () => {
    const model: OverlayModelSlice = {
      sectors: [sector({ sectorId: "x", layoutX: 2, layoutY: 1 })]
    };
    const mark = planBlockedMark(model, { blocked: { sectorId: "x", reason: "path.empty" } });
    expect(mark?.kind).toBe("blocked-mark");
    expect(mark?.reason).toBe("path.empty");
    expect(mark?.treatment).toBe("blocked");
    expect(mark?.x).toBe(sectorCenter(2, 1).x);
  });

  it("plans inert blocked marks when targeting says inert (gaps D29)", () => {
    const model: OverlayModelSlice = {
      sectors: [sector({ sectorId: "x", layoutX: 0, layoutY: 0 })]
    };
    const mark = planBlockedMark(model, {
      blocked: { sectorId: "x", reason: "ward.unavailable", treatment: "inert" }
    });
    expect(mark?.treatment).toBe("inert");
  });

  it("keeps ownership lens marks empty — pin paint-ops are SSOT (gaps D18)", () => {
    const model: OverlayModelSlice = {
      playerFactionId: "player",
      sectors: [sector({ sectorId: "home", layoutX: 0, layoutY: 0, ownerFactionId: "player" })]
    };
    expect(planLensMarks(model, "ownership")).toEqual([]);
  });

  it("plans supply cut-offs only for owned sectors outside a component when lens=supply", () => {
    const model: OverlayModelSlice = {
      playerFactionId: "player",
      sectors: [
        sector({
          sectorId: "cut",
          layoutX: 0,
          layoutY: 0,
          ownerFactionId: "player",
          component: {
            componentId: null,
            production: { unit: "loamUnits", value: 0 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 0 },
            stock: { unit: "loamUnits", value: 0 }
          }
        }),
        sector({
          sectorId: "fed",
          layoutX: 1,
          layoutY: 0,
          ownerFactionId: "player",
          component: {
            componentId: "c1",
            production: { unit: "loamUnits", value: 1 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 1 },
            stock: { unit: "loamUnits", value: 0 }
          }
        })
      ]
    };
    expect(planSupplyCutoffs(model, "ownership")).toHaveLength(0);
    expect(planSupplyCutoffs(model, "supply")).toHaveLength(1);
    expect(planSupplyCutoffs(model, "supply")[0]!.kind).toBe("supply-cutoff");
  });

  it("plans lifeline halos when lens=supply|lifeline and lifeline data is known", () => {
    const model: OverlayModelSlice = {
      sectors: [
        sector({
          sectorId: "hinge",
          layoutX: 0,
          layoutY: 0,
          lifeline: known(true),
          lifelineCost: known({ unit: "count", value: 40 })
        })
      ]
    };
    expect(planLifelineHalos(model, "ownership")).toHaveLength(0);
    const halos = planLifelineHalos(model, "supply");
    expect(halos).toHaveLength(1);
    expect(halos[0]!.weight).toBe("thick");
    expect(halos[0]!.caption).toContain("40");
    expect(planLifelineHalos(model, "lifeline")).toHaveLength(1);
  });

  it("planWorldOverlay aggregates counts and keeps lens marks free of colour-only fields", () => {
    const model: OverlayModelSlice = {
      playerFactionId: "player",
      sectors: [
        sector({ sectorId: "a", layoutX: 0, layoutY: 0, dangerBand: { unit: "count", value: 2 } })
      ]
    };
    const { commands, counts } = planWorldOverlay({
      model,
      selectionPos: { x: 1, y: 2 },
      lens: "danger",
      targeting: { reachable: [{ sectorId: "a", hops: 1 }] }
    });
    expect(counts.selectionHalos).toBe(1);
    expect(counts.rangeRings).toBe(1);
    expect(counts.lensMarks).toBe(1);
    const mark = commands.find((c) => c.kind === "lens-mark");
    expect(mark && "shape" in mark && mark.shape).toBe("diamond");
    expect(mark && "count" in mark && mark.count).toBe(2);
    expect(JSON.stringify(mark)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
