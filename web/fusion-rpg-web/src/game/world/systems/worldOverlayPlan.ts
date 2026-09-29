/**
 * Pure overlay plan for the Phaser world map (R12–R14).
 * Descriptors carry stroke/dash/fill-density — never hue-only (GG-27).
 */

import { sectorCenter, type WorldPoint } from "../layout";
import {
  encodeDangerLens,
  encodeFadeRiskLens,
  encodeIntelAgeLens,
  encodeLoamFlowLens,
  encodeOwnershipLens,
  encodeSupplyLens,
  type LensId
} from "@/stages/world/lenses/lensCatalog";
import type { HealthState, Ownership } from "@/stages/world/render/sectorChannels";
import { healthOf, ownershipOf } from "@/stages/world/render/sectorHealthAndOwnership";
import { supplyEnvelopeFor } from "@/stages/world/render/supplyEnvelope";
import type { LaneView, SectorView } from "@/contract/types";

export type OverlayDrawCounts = {
  selectionHalos: number;
  rangeRings: number;
  queuedRouteSegments: number;
  destinationFlags: number;
  blockedMarks: number;
  supplyCutoffs: number;
  lifelineHalos: number;
  lensMarks: number;
};

export type RangeTarget = { sectorId: string; hops: number; x?: number; y?: number };

export type PendingRouteOrder = {
  commandId: string;
  kind: string;
  sectorId?: string;
  lanePath?: string[];
};

export type TargetingPlanInput = {
  reachable?: RangeTarget[] | null;
  blocked?: { sectorId: string; reason: string; treatment?: "blocked" | "inert" } | null;
  pending?: PendingRouteOrder[] | null;
};

export type SelectionHaloCmd = { kind: "selection-halo"; x: number; y: number; radius: number };
export type RangeRingCmd = {
  kind: "range-ring";
  x: number;
  y: number;
  radius: number;
  hops: number;
  /** Non-colour: solid vs dashed by hop band. */
  dash: "solid" | "dashed";
};
export type RouteSegCmd = {
  kind: "route-segment";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Non-colour: dashed stroke for queued routes. */
  dash: "dashed";
};
export type DestFlagCmd = { kind: "destination-flag"; x: number; y: number };
export type BlockedMarkCmd = {
  kind: "blocked-mark";
  x: number;
  y: number;
  reason: string;
  /** Distinct blocked (hatch+✕+caption) vs inert (calm ellipsis) — gaps D29. */
  treatment: "blocked" | "inert";
};
export type SupplyCutoffCmd = {
  kind: "supply-cutoff";
  x: number;
  y: number;
  /** GG-23 words — never the mark alone (gaps D16). */
  word: "cut off";
};
export type SupplyEnvelopeCmd =
  | { kind: "supply-envelope"; mode: "hull"; points: Array<{ x: number; y: number }> }
  | { kind: "supply-envelope"; mode: "per-lane"; nodes: Array<{ x: number; y: number }> };
export type LifelineHaloCmd = {
  kind: "lifeline-halo";
  x: number;
  y: number;
  /** Non-colour: thick vs thin ring. */
  weight: "thin" | "thick";
  caption: string;
};
export type LensMarkCmd = {
  kind: "lens-mark";
  x: number;
  y: number;
  lens: LensId;
  /** Stroke pattern — never the sole hue channel. */
  stroke: "solid" | "dashed" | "dotted" | "double";
  /** Fill density 0..1 for hatch/wedge. */
  fillDensity: number;
  /** Shape token for GG-27 squint. */
  shape: "ring" | "chevron-up" | "chevron-down" | "bar" | "hatch" | "diamond" | "cross";
  label?: string;
  count?: number;
};

export type OverlayCommand =
  | SelectionHaloCmd
  | RangeRingCmd
  | RouteSegCmd
  | DestFlagCmd
  | BlockedMarkCmd
  | SupplyCutoffCmd
  | SupplyEnvelopeCmd
  | LifelineHaloCmd
  | LensMarkCmd;

export type OverlayModelSlice = {
  sectors?: SectorView[];
  lanes?: LaneView[];
  playerFactionId?: string | null;
};

function emptyCounts(): OverlayDrawCounts {
  return {
    selectionHalos: 0,
    rangeRings: 0,
    queuedRouteSegments: 0,
    destinationFlags: 0,
    blockedMarks: 0,
    supplyCutoffs: 0,
    lifelineHalos: 0,
    lensMarks: 0
  };
}

export function sectorPositionFromModel(model: OverlayModelSlice | null | undefined, sectorId: string): WorldPoint | null {
  const sector = model?.sectors?.find((s) => s.sectorId === sectorId);
  if (!sector) return null;
  return sectorCenter(sector.layoutX, sector.layoutY);
}

export function planSelectionHalo(
  pos: WorldPoint | null,
  radius = 28
): SelectionHaloCmd | null {
  if (!pos) return null;
  return { kind: "selection-halo", x: pos.x, y: pos.y, radius };
}

export function planRangeRings(model: OverlayModelSlice | null | undefined, targeting: TargetingPlanInput | null | undefined): RangeRingCmd[] {
  const reachable = targeting?.reachable;
  if (!reachable?.length) return [];
  const out: RangeRingCmd[] = [];
  for (const target of reachable) {
    const pos =
      target.x != null && target.y != null
        ? { x: target.x, y: target.y }
        : sectorPositionFromModel(model, target.sectorId);
    if (!pos) continue;
    out.push({
      kind: "range-ring",
      x: pos.x,
      y: pos.y,
      radius: 24 + target.hops * 10,
      hops: target.hops,
      dash: target.hops <= 2 ? "solid" : "dashed"
    });
  }
  return out;
}

export function planQueuedRoutes(
  model: OverlayModelSlice | null | undefined,
  targeting: TargetingPlanInput | null | undefined
): { segments: RouteSegCmd[]; flags: DestFlagCmd[] } {
  const pending = targeting?.pending ?? [];
  const lanes = model?.lanes ?? [];
  const laneById = new Map(lanes.map((l) => [l.laneId, l]));
  const segments: RouteSegCmd[] = [];
  const flags: DestFlagCmd[] = [];

  for (const order of pending) {
    if (order.kind !== "move") continue;
    for (const laneId of order.lanePath ?? []) {
      const lane = laneById.get(laneId);
      if (!lane) continue;
      const from = sectorPositionFromModel(model, lane.fromSectorId);
      const to = sectorPositionFromModel(model, lane.toSectorId);
      if (!from || !to) continue;
      segments.push({ kind: "route-segment", x1: from.x, y1: from.y, x2: to.x, y2: to.y, dash: "dashed" });
    }
    if (order.sectorId) {
      const dest = sectorPositionFromModel(model, order.sectorId);
      if (dest) flags.push({ kind: "destination-flag", x: dest.x, y: dest.y });
    }
  }
  return { segments, flags };
}

export function planBlockedMark(
  model: OverlayModelSlice | null | undefined,
  targeting: TargetingPlanInput | null | undefined
): BlockedMarkCmd | null {
  const blocked = targeting?.blocked;
  if (!blocked) return null;
  const pos = sectorPositionFromModel(model, blocked.sectorId);
  if (!pos) return null;
  return {
    kind: "blocked-mark",
    x: pos.x,
    y: pos.y,
    reason: blocked.reason,
    treatment: blocked.treatment ?? "blocked"
  };
}

export function planSupplyCutoffs(model: OverlayModelSlice | null | undefined, lens: string): SupplyCutoffCmd[] {
  if (lens !== "supply") return [];
  const out: SupplyCutoffCmd[] = [];
  for (const sector of model?.sectors ?? []) {
    if (sector.component?.componentId != null) continue;
    // Only mark owned / player-relevant cut-offs when ownership is yours; otherwise skip open ground.
    const ownership = ownershipOf(sector, model?.playerFactionId ?? null);
    if (ownership !== "yours") continue;
    const pos = sectorCenter(sector.layoutX, sector.layoutY);
    out.push({ kind: "supply-cutoff", x: pos.x, y: pos.y, word: "cut off" });
  }
  return out;
}

/** Fed-component envelopes for supply lens (gaps D28) — hull or per-lane from supplyEnvelope.ts. */
export function planSupplyEnvelopes(
  model: OverlayModelSlice | null | undefined,
  lens: string
): SupplyEnvelopeCmd[] {
  if (lens !== "supply") return [];
  const sectors = model?.sectors ?? [];
  if (sectors.length === 0) return [];

  const byComponent = new Map<string, Array<{ x: number; y: number }>>();
  for (const sector of sectors) {
    const cid = sector.component?.componentId;
    if (cid == null) continue;
    const list = byComponent.get(cid) ?? [];
    list.push(sectorCenter(sector.layoutX, sector.layoutY));
    byComponent.set(cid, list);
  }

  const allPositions = sectors.map((s) => sectorCenter(s.layoutX, s.layoutY));
  const out: SupplyEnvelopeCmd[] = [];
  for (const [, members] of byComponent) {
    const foreign = allPositions.filter(
      (p) => !members.some((m) => m.x === p.x && m.y === p.y)
    );
    const envelope = supplyEnvelopeFor(members, foreign);
    if (envelope.kind === "hull") {
      out.push({ kind: "supply-envelope", mode: "hull", points: envelope.points });
    } else {
      out.push({ kind: "supply-envelope", mode: "per-lane", nodes: members });
    }
  }
  return out;
}

export function planLifelineHalos(model: OverlayModelSlice | null | undefined, lens: string): LifelineHaloCmd[] {
  // Lens 4 id is `supply` ("Supply & lifelines"); also accept alias `lifeline` for callers.
  if (lens !== "supply" && lens !== "lifeline") return [];
  const out: LifelineHaloCmd[] = [];
  for (const sector of model?.sectors ?? []) {
    if (sector.lifeline.state !== "known" || !sector.lifeline.value) continue;
    if (sector.lifelineCost.state !== "known") continue;
    const reading = encodeSupplyLens({
      lifeline: true,
      lifelineCost: sector.lifelineCost.value.value
    });
    const pos = sectorCenter(sector.layoutX, sector.layoutY);
    out.push({
      kind: "lifeline-halo",
      x: pos.x,
      y: pos.y,
      weight: reading.weight,
      caption: reading.caption
    });
  }
  return out;
}

function lensMarkForSector(
  sector: SectorView,
  lens: LensId,
  playerFactionId: string | null
): LensMarkCmd | null {
  const pos = sectorCenter(sector.layoutX, sector.layoutY);
  const ownership = ownershipOf(sector, playerFactionId);
  const health = healthOf(sector, ownership);

  switch (lens) {
    case "ownership": {
      const reading = encodeOwnershipLens({
        intel: sector.intel,
        ownership,
        health,
        stabilityMilli: sector.stability.value
      });
      const stroke: LensMarkCmd["stroke"] =
        reading.pattern === "hatch-heavy"
          ? "dashed"
          : reading.pattern === "hatch-fine"
            ? "dotted"
            : ownership === "yours"
              ? "double"
              : "solid";
      return {
        kind: "lens-mark",
        x: pos.x,
        y: pos.y,
        lens,
        stroke,
        fillDensity:
          reading.pattern === "hatch-heavy" ? 0.7 : reading.pattern === "hatch-fine" ? 0.4 : ownership === "yours" ? 0.25 : 0,
        shape: sector.intel === "Unknown" ? "diamond" : "ring",
        label: reading.word
      };
    }
    case "loam": {
      const net =
        ownership === "yours" ? sector.loam.net.value : null;
      const reading = encodeLoamFlowLens(net);
      const shape =
        reading.arrow === "up" ? "chevron-up" : reading.arrow === "down" ? "chevron-down" : "bar";
      return {
        kind: "lens-mark",
        x: pos.x,
        y: pos.y,
        lens,
        stroke: reading.arrow === "flat" ? "dashed" : "solid",
        fillDensity: reading.arrow === "flat" ? 0 : 0.4,
        shape,
        label: reading.label
      };
    }
    case "fade": {
      const reading = encodeFadeRiskLens(health);
      const density =
        health === "will-release" ? 0.85 : health === "fading" || health === "neglected" ? 0.45 : 0.1;
      return {
        kind: "lens-mark",
        x: pos.x,
        y: pos.y,
        lens,
        stroke: health === "will-release" ? "solid" : "dashed",
        fillDensity: density,
        shape: health === "will-release" ? "cross" : "hatch",
        label: reading.word
      };
    }
    case "supply":
      // Supply envelope / cut-off / lifeline drawings own this lens; skip per-pin marks.
      return null;
    case "intel": {
      const reading = encodeIntelAgeLens(sector.intelAge);
      return {
        kind: "lens-mark",
        x: pos.x,
        y: pos.y,
        lens,
        stroke: reading.hatch === "none" ? "solid" : "dashed",
        fillDensity: reading.hatch === "heavy" ? 0.7 : reading.hatch === "light" ? 0.35 : 0,
        shape: sector.intel === "Unknown" ? "diamond" : "hatch",
        label: reading.turnsLabel
      };
    }
    case "danger": {
      const reading = encodeDangerLens(sector.dangerBand.value);
      return {
        kind: "lens-mark",
        x: pos.x,
        y: pos.y,
        lens,
        stroke: "solid",
        fillDensity: Math.min(1, reading.diamondCount * 0.2),
        shape: "diamond",
        label: reading.label,
        count: reading.diamondCount
      };
    }
    default:
      return null;
  }
}

export function planLensMarks(model: OverlayModelSlice | null | undefined, lens: string): LensMarkCmd[] {
  // Ownership is already encoded on pins; supply/lifeline use dedicated drawings.
  if (lens === "ownership" || lens === "supply" || lens === "lifeline") return [];
  const id = lens as LensId;
  const known: LensId[] = ["loam", "fade", "intel", "danger"];
  if (!known.includes(id)) return [];
  const out: LensMarkCmd[] = [];
  const playerFactionId = model?.playerFactionId ?? null;
  for (const sector of model?.sectors ?? []) {
    const mark = lensMarkForSector(sector, id, playerFactionId);
    if (mark) out.push(mark);
  }
  return out;
}

export type PlanWorldOverlayInput = {
  model: OverlayModelSlice | null | undefined;
  selectedId?: string | null;
  selectedKind?: string | null;
  selectionPos?: WorldPoint | null;
  targeting?: TargetingPlanInput | null;
  lens: string;
};

export function planWorldOverlay(input: PlanWorldOverlayInput): {
  commands: OverlayCommand[];
  counts: OverlayDrawCounts;
} {
  const counts = emptyCounts();
  const commands: OverlayCommand[] = [];

  const lensMarks = planLensMarks(input.model, input.lens);
  counts.lensMarks = lensMarks.length;
  commands.push(...lensMarks);

  const cutoffs = planSupplyCutoffs(input.model, input.lens);
  counts.supplyCutoffs = cutoffs.length;
  commands.push(...cutoffs);

  const envelopes = planSupplyEnvelopes(input.model, input.lens);
  commands.push(...envelopes);

  const lifelines = planLifelineHalos(input.model, input.lens);
  counts.lifelineHalos = lifelines.length;
  commands.push(...lifelines);

  const rings = planRangeRings(input.model, input.targeting);
  counts.rangeRings = rings.length;
  commands.push(...rings);

  const routes = planQueuedRoutes(input.model, input.targeting);
  counts.queuedRouteSegments = routes.segments.length;
  counts.destinationFlags = routes.flags.length;
  commands.push(...routes.segments, ...routes.flags);

  const blocked = planBlockedMark(input.model, input.targeting);
  if (blocked) {
    counts.blockedMarks = 1;
    commands.push(blocked);
  }

  const halo = planSelectionHalo(input.selectionPos ?? null);
  if (halo) {
    counts.selectionHalos = 1;
    commands.push(halo);
  }

  return { commands, counts };
}

export type { HealthState, Ownership };
