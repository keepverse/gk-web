import { describe, expect, it } from "vitest";
import { pendingWithReason } from "@/contract/pending";
import type { AdaptedWorldState } from "@/contract/adapt";
import type { LegionView, SectorView, SlotView } from "@/contract/types";
import { worldModelProjection } from "./worldModelProjection";

const R = <T>(name: string) => pendingWithReason<T>(`no ${name}`);

function baseSector(overrides: Partial<SectorView> = {}): SectorView {
  return {
    sectorId: "homeworld",
    typeId: "wildland",
    climate: null,
    ownerFactionId: "dave",
    intel: "Watched",
    intelAge: 0,
    phase: "Held",
    dangerBand: { unit: "count", value: 1 },
    developmentLevel: { unit: "count", value: 1 },
    stability: { unit: "perMilleRatio", op: "flat", value: 900 },
    pressure: { unit: "perMilleRatio", op: "flat", value: 0 },
    fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
    habitable: true,
    layoutX: 0,
    layoutY: 0,
    loam: {
      production: { unit: "loamUnits", value: 40 },
      upkeep: { unit: "loamUnits", value: 18 },
      net: { unit: "loamUnits", value: 22 },
      stock: { unit: "loamUnits", value: 120 },
      capacity: R("capacity"),
      upkeepBreakdown: {
        base: { unit: "loamUnits", value: 10 },
        garrison: { unit: "loamUnits", value: 2 },
        development: { unit: "loamUnits", value: 5 },
        danger: { unit: "loamUnits", value: 1 },
        intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
      }
    },
    component: { componentId: "c1", production: { unit: "loamUnits", value: 0 }, upkeep: { unit: "loamUnits", value: 0 }, net: { unit: "loamUnits", value: 0 }, stock: { unit: "loamUnits", value: 0 } },
    willReleaseNextTurn: false,
    lifelineCost: R("lifeline cost"),
    lifeline: R("lifeline"),
    wardenBindingId: R("warden"),
    neglectedTurns: R("neglected"),
    ...overrides
  };
}

function emptyModel(sectors: SectorView[] = [baseSector()], slotsBySectorId: Record<string, SlotView[]> = {}): AdaptedWorldState {
  return { sectors, lanes: [], slotsBySectorId, forcesBySectorId: {} };
}

describe("worldModelProjection — dirty flag completeness (gaps D1/D30)", () => {
  it("changes when ownerFactionId changes with identical intel", () => {
    const a = worldModelProjection({
      model: emptyModel([baseSector({ ownerFactionId: "dave" })]),
      overlayEpoch: 0,
      playerFactionId: "dave"
    });
    const b = worldModelProjection({
      model: emptyModel([baseSector({ ownerFactionId: "zomboss" })]),
      overlayEpoch: 0,
      playerFactionId: "dave"
    });
    expect(a).not.toBe(b);
  });

  it("changes when slotsBySectorId changes", () => {
    const slot: SlotView = {
      slotIndex: 0,
      slotTypeId: "rootbed",
      element: null,
      state: "Intact",
      ownerFactionId: "dave",
      guardWaveId: null,
      guardState: "None",
      structureId: null,
      constructionTurnsRemaining: R("construction")
    };
    const a = worldModelProjection({
      model: emptyModel([baseSector()], {}),
      overlayEpoch: 0,
      playerFactionId: "dave"
    });
    const b = worldModelProjection({
      model: emptyModel([baseSector()], { homeworld: [slot] }),
      overlayEpoch: 0,
      playerFactionId: "dave"
    });
    expect(a).not.toBe(b);
  });

  it("changes when playerFactionId changes", () => {
    const model = emptyModel();
    const a = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "dave" });
    const b = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "zomboss" });
    expect(a).not.toBe(b);
  });

  it("changes when legion lane progress changes", () => {
    const legionA: LegionView = {
      entityId: "e-1",
      kind: "Legion",
      ownerFactionId: "dave",
      position: {
        kind: "lane",
        laneId: "l-1",
        towardSectorId: "ember",
        progress: { unit: "perMilleRatio", op: "flat", value: 100 }
      },
      stance: "march",
      movementRemaining: { unit: "perMilleRatio", op: "flat", value: 500 },
      routed: false,
      members: [],
      carriedLoam: R("loam"),
      capacity: R("cap"),
      burn: R("burn"),
      runway: R("runway")
    };
    const legionB: LegionView = {
      ...legionA,
      position: { ...legionA.position, kind: "lane", laneId: "l-1", towardSectorId: "ember", progress: { unit: "perMilleRatio", op: "flat", value: 900 } }
    };
    const model = emptyModel();
    const a = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "dave", legions: [legionA] });
    const b = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "dave", legions: [legionB] });
    expect(a).not.toBe(b);
  });

  it("does not encode targeting — same graph yields same projection regardless of overlay-only intent", () => {
    const model = emptyModel();
    const a = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "dave" });
    const b = worldModelProjection({ model, overlayEpoch: 0, playerFactionId: "dave" });
    expect(a).toBe(b);
  });
});
