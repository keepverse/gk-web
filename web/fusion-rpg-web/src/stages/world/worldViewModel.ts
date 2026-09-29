import type { WorldEntityDto, WorldForceDto, WorldSectorDto, WorldStateDto } from "@/lib/bus/world";
import { sectorLabel } from "./labels";

/**
 * The map fold: a world-state payload in, React Flow nodes and edges out. Pure, so the whole of the
 * map's presentation logic is testable without a canvas — the renderer above it stays a thin host,
 * which is the same split the lawn uses.
 */

/** Pixels per unit of the authored layout grid. Sectors are placed, never auto-laid-out. */
export const GRID_X = 220;
export const GRID_Y = 190;

export type Ownership = "mine" | "enemy" | "neutral";

export type SectorSlotView = {
  slotIndex: number;
  slotTypeId: string;
  element: string | null;
  /** `intact` is the only one that blocks a claim; `none` means there was never a guard. */
  guard: "intact" | "cleared" | "none";
};

export type ForceView = {
  entityId: string;
  ownerFactionId: string;
  ownership: Ownership;
  kind: string;
  routed: boolean;
  /** Members still standing. Meaningful only when `exact`. */
  strength: number;
  /**
   * False when this is believed rather than surveyed — the card must then show a band name and not
   * a number, or it implies a certainty the viewer does not have.
   */
  exact: boolean;
  /** What to call it when you cannot count it: "warband", "host", "horde". */
  bandName: string;
};

/**
 * Territory is light in the dark (spec-loam-fe.md). Four states, mutually exclusive:
 * - `not-yours` — the existing fog treatment owns this one entirely; loam has nothing to add.
 * - `anchored` — yours, holding a source, stability at or near full.
 * - `fading` — yours, holding a source, stability has started to slip. Dims *in proportion*.
 * - `barren` — yours, but it holds no source at all and can never be kept, regardless of its
 *   current stability number. Deliberately a flat, distinct look rather than a point on the same
 *   dimming scale as `fading` — confusing the two is the one mistake this module exists to prevent.
 */
export type AnchorState = "anchored" | "fading" | "barren" | "not-yours";

const AnchoredFloorMilli = 900;

export function anchorStateOf(ownership: Ownership, habitable: boolean, stabilityMilli: number): AnchorState {
  if (ownership !== "mine") return "not-yours";
  if (!habitable) return "barren";
  return stabilityMilli >= AnchoredFloorMilli ? "anchored" : "fading";
}

export type LoamComponentSummary = {
  componentId: string;
  production: number;
  upkeep: number;
  net: number;
  stock: number;
  sectorCount: number;
  /** The sector this component is about to lose next turn if nothing changes, or none. */
  releaseCandidateSectorId: string | null;
};

export type LoamEmpireSummary = {
  production: number;
  upkeep: number;
  net: number;
  stock: number;
  components: LoamComponentSummary[];
};

/**
 * Empire-scope totals for the gauge (spec-loam-fe.md). Every number here is read straight off a
 * sector or component total `loam-calc` already finalized on the server — this groups the viewer's
 * own sectors by component and adds already-settled figures once per distinct component, which is
 * addition, not a second copy of any upkeep/decay formula.
 */
export function summarizeLoam(nodes: SectorNodeData[]): LoamEmpireSummary {
  const byComponent = new Map<string, SectorNodeData[]>();
  for (const node of nodes) {
    if (node.ownership !== "mine" || node.componentId == null) continue;
    const list = byComponent.get(node.componentId);
    if (list) list.push(node);
    else byComponent.set(node.componentId, [node]);
  }

  const components: LoamComponentSummary[] = Array.from(byComponent.entries())
    .map(([componentId, members]) => ({
      componentId,
      production: members[0].componentProduction,
      upkeep: members[0].componentUpkeep,
      net: members[0].componentNet,
      stock: members[0].componentStock,
      sectorCount: members.length,
      releaseCandidateSectorId: members.find((m) => m.willReleaseNextTurn)?.sectorId ?? null
    }))
    .sort((a, b) => a.componentId.localeCompare(b.componentId));

  return {
    production: components.reduce((sum, c) => sum + c.production, 0),
    upkeep: components.reduce((sum, c) => sum + c.upkeep, 0),
    net: components.reduce((sum, c) => sum + c.net, 0),
    stock: components.reduce((sum, c) => sum + c.stock, 0),
    components
  };
}

export type SectorNodeData = {
  sectorId: string;
  label: string;
  typeId: string;
  climate: string | null;
  phase: string;
  intel: string;
  dangerBand: number;
  ownerFactionId: string | null;
  ownership: Ownership;
  /** True while the sector has never been seen — drawn as a shrouded card. */
  unknown: boolean;
  /** True when it is remembered rather than in sight: dimmed, and stamped with its age. */
  remembered: boolean;
  /** Turns since it was last seen. */
  age: number;
  claimable: boolean;
  /** What losing it would cost your empire (world-topology). Zero for ground you do not hold. */
  lifelineCost: number;
  lifeline: boolean;
  slots: SectorSlotView[];
  forces: ForceView[];
  /** Whether this ground can hold a source at all — terrain, visible once scouted. */
  habitable: boolean;
  /** Owner-only; zero for ground you do not hold. */
  stabilityMilli: number;
  anchorState: AnchorState;
  /** What this sector earns/costs/nets this turn, and the pool it belongs to — owner-only. */
  loamProduction: number;
  loamUpkeep: number;
  loamNet: number;
  componentId: string | null;
  componentProduction: number;
  componentUpkeep: number;
  componentNet: number;
  loamStock: number;
  componentStock: number;
  willReleaseNextTurn: boolean;
};

export type LaneEdgeData = {
  laneId: string;
  typeId: string;
  length: number;
  width: number;
  hazardMilli: number;
  severed: boolean;
  /**
   * Forces currently on the lane. `progressMilli` is what the world stores — distance from the end
   * that force started at — and `alongMilli` is the same position re-measured from the lane's own
   * `source` end, which is the only one a renderer can draw with. Doing that here rather than in the
   * component keeps the mirroring testable.
   */
  forces: (ForceView & {
    progressMilli: number;
    towardSectorId: string | null;
    alongMilli: number;
    /**
     * Where this force was on this lane in the previous world state, when it was on it. The marker
     * animates from here to `alongMilli`; undefined means it simply appears where it is, which is
     * what a force that just stepped onto the lane should do.
     */
    fromMilli?: number;
  })[];
};

export type SectorNode = {
  id: string;
  type: "sector";
  position: { x: number; y: number };
  data: SectorNodeData;
};

export type LaneEdge = {
  id: string;
  type: "lane";
  source: string;
  target: string;
  data: LaneEdgeData;
};

export type WorldGraph = { nodes: SectorNode[]; edges: LaneEdge[] };

export function ownershipOf(factionId: string | null, playerFactionId: string | null): Ownership {
  if (factionId == null) return "neutral";
  return factionId === playerFactionId ? "mine" : "enemy";
}

/** The player's faction, read from the payload rather than assumed to be called `dave`. */
export function playerFactionId(state: WorldStateDto): string | null {
  return state.factions.find((f) => f.kind === "Player")?.factionId ?? null;
}

/** Your own force: you know exactly what you brought. */
function ownForceView(entity: WorldEntityDto, mine: string | null): ForceView {
  return {
    entityId: entity.entityId,
    ownerFactionId: entity.ownerFactionId,
    ownership: ownershipOf(entity.ownerFactionId, mine),
    kind: entity.kind,
    routed: entity.routed,
    strength: entity.members.reduce((sum, m) => sum + Math.max(0, m.hp - m.wounds), 0),
    exact: true,
    bandName: ""
  };
}

/** Somebody else's, at whatever detail it was seen. */
function believedForceView(force: WorldForceDto, mine: string | null): ForceView {
  return {
    entityId: force.entityId,
    ownerFactionId: force.ownerFactionId,
    ownership: ownershipOf(force.ownerFactionId, mine),
    kind: force.kind,
    routed: false,
    strength: force.strength,
    exact: force.exact,
    bandName: force.bandName
  };
}

function slotViews(sector: WorldSectorDto): SectorSlotView[] {
  return sector.slots.map((slot) => ({
    slotIndex: slot.slotIndex,
    slotTypeId: slot.slotTypeId,
    element: slot.element,
    guard: slot.guardState === "Intact" ? "intact" : slot.guardWaveId ? "cleared" : "none"
  }));
}

/** Where each entity was on each lane last time, keyed `entityId|laneId`. */
function laneHistory(previous: WorldStateDto | null | undefined): Map<string, number> {
  const history = new Map<string, number>();
  if (!previous) return history;

  for (const lane of previous.lanes)
    for (const e of previous.entities)
      if (e.onLaneId === lane.laneId)
        history.set(
          e.entityId + "|" + lane.laneId,
          e.onLaneTowardSectorId === lane.toSectorId ? e.laneProgressMilli : 1000 - e.laneProgressMilli
        );

  return history;
}

/**
 * `previous` is the world before the last turn resolved, and it is optional: without it the map
 * still draws correctly, it just snaps rather than slides.
 */
export function toGraph(state: WorldStateDto, previous?: WorldStateDto | null): WorldGraph {
  const mine = playerFactionId(state);
  const wasOnLane = laneHistory(previous);

  // `entities` is the viewer's own forces only; everything else is believed, per sector, at
  // whatever detail it was seen. Lane markers therefore only ever draw your own columns — an
  // enemy on the road shows up as a force at the sector it is walking toward.
  const onLane = new Map<string, WorldEntityDto[]>();
  for (const entity of state.entities) {
    if (entity.onLaneId == null) continue;
    const list = onLane.get(entity.onLaneId);
    if (list) list.push(entity);
    else onLane.set(entity.onLaneId, [entity]);
  }

  const nodes: SectorNode[] = state.sectors.map((sector) => {
    const forces = (sector.forces ?? []).map((f) => believedForceView(f, mine));
    const slots = slotViews(sector);
    const ownership = ownershipOf(sector.ownerFactionId, mine);
    const habitable = sector.habitable ?? false;
    const stabilityMilli = sector.stabilityMilli ?? 0;

    return {
      id: sector.sectorId,
      type: "sector",
      position: { x: sector.layoutX * GRID_X, y: sector.layoutY * GRID_Y },
      data: {
        sectorId: sector.sectorId,
        label: sectorLabel(sector.sectorId),
        typeId: sector.typeId,
        climate: sector.climate,
        phase: sector.phase,
        intel: sector.intel,
        dangerBand: sector.dangerBand,
        ownerFactionId: sector.ownerFactionId,
        ownership,
        unknown: sector.intel === "Unknown",
        remembered: sector.intel === "Scouted" || sector.intel === "Rumored",
        age: sector.intelAge ?? 0,
        lifelineCost: sector.lifelineCost ?? 0,
        lifeline: sector.lifeline ?? false,
        // The same rule the engine applies, shown before the order is filed so a refusal is never
        // a surprise — but only where the viewer has actually surveyed the ground. A sector you
        // have merely glimpsed reports no slots, and "no slots" must not read as "nothing left to
        // clear".
        claimable:
          sector.intel === "Watched" &&
          slots.length > 0 &&
          slots.every((s) => s.guard !== "intact") &&
          forces.every((f) => f.ownership !== "enemy") &&
          sector.ownerFactionId !== mine,
        slots,
        forces,
        habitable,
        stabilityMilli,
        anchorState: anchorStateOf(ownership, habitable, stabilityMilli),
        loamProduction: sector.loamProduction ?? 0,
        loamUpkeep: sector.loamUpkeep ?? 0,
        loamNet: sector.loamNet ?? 0,
        componentId: sector.componentId ?? null,
        componentProduction: sector.componentProduction ?? 0,
        componentUpkeep: sector.componentUpkeep ?? 0,
        componentNet: sector.componentNet ?? 0,
        loamStock: sector.loamStock ?? 0,
        componentStock: sector.componentStock ?? 0,
        willReleaseNextTurn: sector.willReleaseNextTurn ?? false
      }
    };
  });

  const edges: LaneEdge[] = state.lanes.map((lane) => ({
    id: lane.laneId,
    type: "lane",
    source: lane.fromSectorId,
    target: lane.toSectorId,
    data: {
      laneId: lane.laneId,
      typeId: lane.typeId,
      length: lane.length,
      width: lane.width,
      hazardMilli: lane.hazardMilli,
      severed: lane.state === "Severed",
      forces: (onLane.get(lane.laneId) ?? []).map((e) => ({
        ...ownForceView(e, mine),
        progressMilli: e.laneProgressMilli,
        towardSectorId: e.onLaneTowardSectorId,
        alongMilli:
          e.onLaneTowardSectorId === lane.toSectorId
            ? e.laneProgressMilli
            : 1000 - e.laneProgressMilli,
        fromMilli: wasOnLane.get(e.entityId + "|" + lane.laneId)
      }))
    }
  }));

  return { nodes, edges };
}
