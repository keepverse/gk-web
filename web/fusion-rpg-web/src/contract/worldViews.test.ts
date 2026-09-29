import { describe, expect, it } from "vitest";
import { findEmptyPendingReasons } from "./contractGuard";
import { pendingWithReason } from "./pending";
import type {
  ForceView,
  LaneView,
  LegionView,
  SectorView,
  SlotView,
  TurnEventView
} from "./types";

/**
 * world-stage W4 — "every `pending` field has a non-empty player-readable reason, asserted by a
 * test that enumerates the world fields rather than spot-checking" (the acceptance criterion's own
 * words). One maximally-pending fixture per view, every `Pending` field given a real reason, run
 * through the same `findEmptyPendingReasons` the rest of the contract is policed by — so this test
 * fails the moment a field is added and left with no reason, not just the ones written today.
 */

const R = (name: string) => pendingWithReason<never>(`no ${name} endpoint yet`);

const sector: SectorView = {
  sectorId: "s-1",
  typeId: "wildland",
  climate: null,
  ownerFactionId: "dave",
  intel: "Watched",
  intelAge: 0,
  phase: "Held",
  dangerBand: { unit: "count", value: 2 },
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
    capacity: R("effective capacity"),
    upkeepBreakdown: {
      base: { unit: "loamUnits", value: 10 },
      garrison: { unit: "loamUnits", value: 2 },
      development: { unit: "loamUnits", value: 5 },
      danger: { unit: "loamUnits", value: 1 },
      intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 },
      handicapMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
    }
  },
  component: {
    componentId: "c-1",
    production: { unit: "loamUnits", value: 40 },
    upkeep: { unit: "loamUnits", value: 18 },
    net: { unit: "loamUnits", value: 22 },
    stock: { unit: "loamUnits", value: 120 }
  },
  willReleaseNextTurn: false,
  lifelineCost: R("lifelines opt-in"),
  lifeline: R("lifelines opt-in"),
  wardenBindingId: R("warden binding"),
  neglectedTurns: R("neglected-turns")
};

const lane: LaneView = {
  laneId: "l-1",
  fromSectorId: "s-1",
  toSectorId: "s-2",
  typeId: "corridor",
  length: { unit: "count", value: 1000 },
  width: { unit: "count", value: 1000 },
  hazard: { unit: "perMilleRatio", op: "flat", value: 0 },
  wardLevel: { unit: "count", value: 0 },
  state: "Open",
  gateKeyId: R("gate key")
};

const legion: LegionView = {
  entityId: "e-1",
  kind: "Legion",
  ownerFactionId: "dave",
  position: { kind: "sector", sectorId: "s-1" },
  stance: "march",
  movementRemaining: { unit: "perMilleRatio", op: "flat", value: 1000 },
  routed: false,
  members: [
    {
      instanceId: "i-1",
      speciesId: "sunflower",
      level: { unit: "count", value: 1 },
      hp: { unit: "gameUnits", value: 100 },
      wounds: { unit: "gameUnits", value: 0 },
      role: R("member role")
    }
  ],
  carriedLoam: R("carried loam"),
  capacity: R("capacity"),
  burn: R("burn"),
  runway: R("runway")
};

const slot: SlotView = {
  slotIndex: 0,
  slotTypeId: "rootbed",
  element: null,
  state: "Intact",
  ownerFactionId: "dave",
  guardWaveId: null,
  guardState: "None",
  structureId: null,
  constructionTurnsRemaining: R("construction turns remaining")
};

const bandedForce: ForceView = {
  entityId: "e-2",
  ownerFactionId: "zomboss",
  kind: "Warband",
  exact: false,
  bandName: "warband",
  bandCeiling: { unit: "gameUnits", value: 1499 }
};

const turnEvent: TurnEventView = {
  sectorId: "s-1",
  phase: "Movement",
  kind: "event",
  subject: "e-1",
  detail: "arrival:s-1",
  sentence: R("turn-playback translation")
};

describe("world views — pending reasons (W4)", () => {
  it("every pending field across all six views carries a real reason", () => {
    expect(findEmptyPendingReasons(sector)).toEqual([]);
    expect(findEmptyPendingReasons(lane)).toEqual([]);
    expect(findEmptyPendingReasons(legion)).toEqual([]);
    expect(findEmptyPendingReasons(slot)).toEqual([]);
    expect(findEmptyPendingReasons(bandedForce)).toEqual([]);
    expect(findEmptyPendingReasons(turnEvent)).toEqual([]);
  });

  it("still catches an empty reason nested three levels deep in a world view (positive control)", () => {
    const broken: SectorView = {
      ...sector,
      loam: { ...sector.loam, capacity: { state: "pending", reason: "" } }
    };
    const violations = findEmptyPendingReasons(broken);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.text).toContain("loam.capacity");
  });

  it("does not flag a fully-known sector with no pending fields at all", () => {
    const allKnown: SectorView = {
      ...sector,
      loam: { ...sector.loam, capacity: { state: "known", value: { unit: "loamUnits", value: 300 } } },
      lifelineCost: { state: "known", value: { unit: "count", value: 0 } },
      lifeline: { state: "known", value: false },
      wardenBindingId: { state: "absent" },
      neglectedTurns: { state: "known", value: { unit: "count", value: 0 } }
    };
    expect(findEmptyPendingReasons(allKnown)).toEqual([]);
  });
});
