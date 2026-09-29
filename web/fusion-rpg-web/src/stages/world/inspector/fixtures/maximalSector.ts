import type { SectorView, SlotView, ForceView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";

const count = (value: number) => ({ unit: "count" as const, value });
const loam = (value: number) => ({ unit: "loamUnits" as const, value });
const perMille = (value: number) => ({ unit: "perMilleRatio" as const, op: "flat" as const, value });

/**
 * The GG-61 density proof's own fixture (world-stage W57): every one of the nine blocks populated
 * at once, four slots, multiple forces, a warden, a construction in progress — the "1,597px of body
 * content in a 400px well" case `spec-world-inspector.md` §2 measured against the plate.
 */
export const maximalSector: SectorView = {
  sectorId: "ember-hollow",
  typeId: "stable",
  climate: "temperate",
  ownerFactionId: "dave",
  intel: "Watched",
  intelAge: 0,
  phase: "Held",
  dangerBand: count(3),
  developmentLevel: count(4),
  stability: perMille(820),
  pressure: perMille(120),
  fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
  habitable: true,
  layoutX: 2,
  layoutY: 1,
  loam: {
    production: loam(140),
    upkeep: loam(60),
    net: loam(80),
    stock: loam(2400),
    capacity: known(loam(3000)),
    upkeepBreakdown: {
      base: loam(20),
      garrison: loam(15),
      development: loam(20),
      danger: loam(5),
      wonderUpkeep: loam(0),
      intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 },
      handicapMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
    }
  },
  component: {
    componentId: "c-1",
    production: loam(410),
    upkeep: loam(260),
    net: loam(150),
    stock: loam(6200)
  },
  willReleaseNextTurn: false,
  lifelineCost: known(count(120)),
  lifeline: known(true),
  wardenBindingId: known("e-dave-warden-1"),
  neglectedTurns: known(count(0)),
  wonderLiveCountSector: count(0),
  wonderLiveCountEmpire: count(0),
  wonderProductionContribution: loam(0)
};

export const maximalSlots: SlotView[] = [
  {
    slotIndex: 0,
    slotTypeId: "grove",
    element: "earth",
    state: "Intact",
    ownerFactionId: "dave",
    guardWaveId: null,
    guardState: "Cleared",
    structureId: "well",
    constructionTurnsRemaining: known(null),
    wonderScope: null,
    wonderRarity: null
  },
  {
    slotIndex: 1,
    slotTypeId: "grove",
    element: "fire",
    state: "Intact",
    ownerFactionId: "dave",
    guardWaveId: null,
    guardState: "Cleared",
    structureId: "waystation",
    constructionTurnsRemaining: known(2),
    wonderScope: null,
    wonderRarity: null
  },
  {
    slotIndex: 2,
    slotTypeId: "rootbed",
    element: null,
    state: "Claimed",
    ownerFactionId: null,
    guardWaveId: "e-guard-wave-1",
    guardState: "Intact",
    structureId: null,
    constructionTurnsRemaining: known(null),
    wonderScope: null,
    wonderRarity: null
  },
  {
    slotIndex: 3,
    slotTypeId: "grove",
    element: null,
    state: "Depleted",
    ownerFactionId: "dave",
    guardWaveId: null,
    guardState: "Cleared",
    structureId: null,
    constructionTurnsRemaining: known(null),
    wonderScope: null,
    wonderRarity: null
  }
];

export const maximalForces: ForceView[] = [
  { entityId: "e-dave-legion-1", ownerFactionId: "dave", kind: "Legion", exact: true, strength: count(240) },
  { entityId: "e-dave-legion-2", ownerFactionId: "dave", kind: "Legion", exact: true, strength: count(90) },
  {
    entityId: "e-wild-pack-1",
    ownerFactionId: "wild",
    kind: "Warband",
    exact: false,
    bandName: "a warband",
    bandCeiling: count(200)
  },
  // Slot 2's own guard (`maximalSlots[2].guardWaveId`) — the real force `SlotRow` (world-stage W62)
  // looks up to name it as a force, not the bare id.
  {
    entityId: "e-guard-wave-1",
    ownerFactionId: "wild",
    kind: "Guard",
    exact: false,
    bandName: "a guard force",
    bandCeiling: count(50)
  }
];

/** Nothing under construction, no forces, no warden — the sparse counterpart the same test suite
 * proves each block still renders honestly (Pending/absent stated, never a zero standing in). */
export const emptySector: SectorView = {
  ...maximalSector,
  sectorId: "far-reach",
  ownerFactionId: null,
  intel: "Rumored",
  intelAge: 6,
  component: { componentId: null, production: loam(0), upkeep: loam(0), net: loam(0), stock: loam(0) },
  loam: { ...maximalSector.loam, capacity: pendingWithReason("capacity not yet exposed by the server") },
  lifelineCost: pendingWithReason("lifelines opt-in"),
  lifeline: pendingWithReason("lifelines opt-in"),
  wardenBindingId: known(null),
  neglectedTurns: pendingWithReason("not surveyed recently enough to know")
};
