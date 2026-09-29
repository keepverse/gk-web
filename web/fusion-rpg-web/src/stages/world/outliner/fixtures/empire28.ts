import type { LegionMemberView, LegionView, SectorView, UpkeepBreakdownView } from "@/contract/types";
import { pendingWithReason } from "@/contract/pending";

const R = (name: string) => pendingWithReason<never>(`this fixture does not track ${name}`);

const member: LegionMemberView = {
  instanceId: null,
  speciesId: "sunflower",
  level: { unit: "count", value: 1 },
  hp: { unit: "gameUnits", value: 100 },
  wounds: { unit: "gameUnits", value: 0 },
  role: R("member role")
};

function legion(entityId: string, movementRemaining: number): LegionView {
  return {
    entityId,
    kind: "Legion",
    ownerFactionId: "dave",
    position: { kind: "sector", sectorId: "s-1" },
    stance: movementRemaining === 0 ? "hold" : "march",
    movementRemaining: { unit: "perMilleRatio", op: "flat", value: movementRemaining },
    routed: false,
    members: [member],
    carriedLoam: R("carried loam"),
    capacity: R("capacity"),
    burn: R("burn"),
    runway: R("runway")
  };
}

const upkeepBreakdown: UpkeepBreakdownView = {
  base: { unit: "loamUnits", value: 10 },
  garrison: { unit: "loamUnits", value: 5 },
  development: { unit: "loamUnits", value: 0 },
  danger: { unit: "loamUnits", value: 1 },
  wonderUpkeep: { unit: "loamUnits", value: 0 },
  intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 },
  handicapMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
};

function sector(sectorId: string, stabilityMilli: number, willReleaseNextTurn = false): SectorView {
  return {
    sectorId,
    typeId: "stable",
    climate: null,
    ownerFactionId: "dave",
    intel: "Watched",
    intelAge: 0,
    phase: "Held",
    dangerBand: { unit: "count", value: 1 },
    developmentLevel: { unit: "count", value: 0 },
    stability: { unit: "perMilleRatio", op: "flat", value: stabilityMilli },
    pressure: { unit: "perMilleRatio", op: "flat", value: 0 },
    fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
    habitable: true,
    layoutX: 0,
    layoutY: 0,
    loam: {
      production: { unit: "loamUnits", value: 50 },
      upkeep: { unit: "loamUnits", value: 16 },
      net: { unit: "loamUnits", value: 34 },
      stock: { unit: "loamUnits", value: 100 },
      capacity: R("capacity"),
      upkeepBreakdown
    },
    component: {
      componentId: "c-1",
      production: { unit: "loamUnits", value: 50 },
      upkeep: { unit: "loamUnits", value: 16 },
      net: { unit: "loamUnits", value: 34 }
    } as SectorView["component"],
    willReleaseNextTurn,
    lifelineCost: R("lifeline cost"),
    lifeline: R("lifeline"),
    wardenBindingId: R("warden binding"),
    neglectedTurns: R("neglected turns"),
    wonderLiveCountSector: { unit: "count", value: 0 },
    wonderLiveCountEmpire: { unit: "count", value: 0 },
    wonderProductionContribution: { unit: "loamUnits", value: 0 }
  };
}

/**
 * world-stage W90 (spec-world-outliner.md, §8e.3's own 6-10 legion target run at its ceiling) — the
 * 10-legion + 18-sector = 28-row fixture every outliner test runs against, matching the module's own
 * "sizing" discipline (a component tested at one row proves nothing about grouping, sorting, or a
 * scrolling list). Four legions carry positive movement and no order (flagged); three sectors sit
 * below the anchored floor (flagged, fading); one of those also carries `willReleaseNextTurn`.
 */
export const EMPIRE_28_LEGIONS: readonly LegionView[] = [
  legion("e-1", 1000),
  legion("e-2", 1000),
  legion("e-3", 500),
  legion("e-4", 500),
  legion("e-5", 0),
  legion("e-6", 0),
  legion("e-7", 0),
  legion("e-8", 1000),
  legion("e-9", 0),
  legion("e-10", 0)
];

export const EMPIRE_28_SECTORS: readonly SectorView[] = [
  sector("sector-01", 1000),
  sector("sector-02", 1000),
  sector("sector-03", 850),
  sector("sector-04", 1000),
  sector("sector-05", 1000),
  sector("sector-06", 700, true),
  sector("sector-07", 1000),
  sector("sector-08", 1000),
  sector("sector-09", 1000),
  sector("sector-10", 1000),
  sector("sector-11", 1000),
  sector("sector-12", 1000),
  sector("sector-13", 600),
  sector("sector-14", 1000),
  sector("sector-15", 1000),
  sector("sector-16", 1000),
  sector("sector-17", 1000),
  sector("sector-18", 1000)
];
