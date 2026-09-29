import type Phaser from "phaser";
import type { AdaptedWorldState } from "@/contract/adapt";
import type { ForceView, LaneView, LegionView, SectorView } from "@/contract/types";
import { channelsFor } from "@/stages/world/render/sectorChannels";
import { fogTreatmentFor } from "@/stages/world/render/fogTreatments";
import { ownershipOf, healthOf } from "@/stages/world/render/sectorHealthAndOwnership";
import type { LaneKind } from "@/stages/world/render/laneChannels";
import type { WorldTheme } from "../snapshotTheme";
import { sectorCenter } from "../layout";
import type { ZoomTier } from "../zoomTier";
import type { WorldRegistry } from "../entities/WorldRegistry";
import { createSectorPin } from "../objects/sectorPin";
import { createLaneStroke, pointOnLane } from "../objects/laneStroke";
import { createForceMarker } from "../objects/forceMarker";

export type SyncWorldModel = AdaptedWorldState & {
  playerFactionId?: string | null;
  legions?: readonly LegionView[];
};

export type SyncWorldSystemInput = {
  scene: Phaser.Scene;
  theme: WorldTheme;
  registry: WorldRegistry;
  lastApplied: number;
  modelSeq: number;
  model: unknown;
  tier: ZoomTier;
  forceLodRefresh?: boolean;
};

function asModel(model: unknown): SyncWorldModel | null {
  if (model == null || typeof model !== "object") return null;
  const m = model as Partial<SyncWorldModel>;
  if (!Array.isArray(m.sectors) || !Array.isArray(m.lanes)) return null;
  return m as SyncWorldModel;
}

function laneState(lane: LaneView) {
  return {
    severed: lane.state === "Severed",
    wardLevel: lane.wardLevel.value > 0 ? lane.wardLevel.value : null,
    hazardMilli: lane.hazard.value
  };
}

function destroyAbsent(
  registry: WorldRegistry,
  currentIds: string[],
  nextIds: Set<string>,
  kind: "sector" | "lane" | "force"
): void {
  for (const id of currentIds) {
    if (nextIds.has(id)) continue;
    if (kind === "sector") {
      registry.getSector(id)?.destroy();
      registry.deleteSector(id);
    } else if (kind === "lane") {
      registry.getLane(id)?.destroy();
      registry.deleteLane(id);
    } else {
      registry.getForce(id)?.destroy();
      registry.deleteForce(id);
    }
  }
}

function upsertSectorPin(
  scene: Phaser.Scene,
  theme: WorldTheme,
  registry: WorldRegistry,
  sector: SectorView,
  tier: ZoomTier,
  playerFactionId: string | null,
  slotsBySectorId: Record<string, { slotIndex: number; slotTypeId: string }[]>
): void {
  const ownership = ownershipOf(sector, playerFactionId);
  const health = healthOf(sector, ownership);
  const channels = channelsFor({
    intel: sector.intel,
    ownership,
    health,
    stabilityMilli: sector.stability.value
  });
  const fog = fogTreatmentFor(sector.intel, sector.intelAge);
  const { x, y } = sectorCenter(sector.layoutX, sector.layoutY);
  const slots = (slotsBySectorId[sector.sectorId] ?? []).map((s) => ({
    slotIndex: s.slotIndex,
    slotTypeId: s.slotTypeId
  }));
  const netLoam = ownership === "yours" ? sector.loam.net.value : null;
  const paintKey = JSON.stringify({ channels, fog, tier, slots, netLoam, x, y });

  const existing = registry.getSector(sector.sectorId) as Phaser.GameObjects.Container | undefined;
  if (existing?.active && existing.getData("paintKey") === paintKey) {
    return;
  }
  existing?.destroy();

  const pin = createSectorPin(scene, theme, {
    id: sector.sectorId,
    channels,
    fog,
    zoom: tier,
    x,
    y,
    slots,
    netLoam
  });
  pin.setDepth(0);
  pin.setData("paintKey", paintKey);
  registry.setSector(sector.sectorId, pin);
}

function upsertLane(
  scene: Phaser.Scene,
  theme: WorldTheme,
  registry: WorldRegistry,
  lane: LaneView,
  sectorsById: Map<string, SectorView>
): void {
  const from = sectorsById.get(lane.fromSectorId);
  const to = sectorsById.get(lane.toSectorId);
  if (!from || !to) return;

  const a = sectorCenter(from.layoutX, from.layoutY);
  const b = sectorCenter(to.layoutX, to.layoutY);
  const state = laneState(lane);
  const paintKey = JSON.stringify({
    kind: lane.typeId,
    state,
    widthMilli: lane.width.value,
    x0: a.x,
    y0: a.y,
    x1: b.x,
    y1: b.y
  });

  const existing = registry.getLane(lane.laneId) as Phaser.GameObjects.Container | undefined;
  if (existing?.active && existing.getData("paintKey") === paintKey) {
    return;
  }
  existing?.destroy();

  const stroke = createLaneStroke(scene, theme, {
    id: lane.laneId,
    kind: lane.typeId as LaneKind,
    state,
    widthMilli: lane.width.value,
    x0: a.x,
    y0: a.y,
    x1: b.x,
    y1: b.y
  });
  stroke.setData("paintKey", paintKey);
  registry.setLane(lane.laneId, stroke);
}

function forceFromLegion(legion: LegionView): ForceView {
  return {
    entityId: legion.entityId,
    ownerFactionId: legion.ownerFactionId,
    kind: legion.kind,
    exact: true,
    strength: { unit: "gameUnits", value: legion.members.length }
  };
}

/** Cheap fingerprint for force paint — position is updated separately (followup F7). */
function forcePaintKey(force: ForceView, ownership: "yours" | "enemy"): string {
  if (force.exact) {
    return JSON.stringify({
      ownership,
      kind: force.kind,
      exact: true,
      strength: force.strength
    });
  }
  return JSON.stringify({
    ownership,
    kind: force.kind,
    exact: false,
    bandName: force.bandName,
    bandCeiling: force.bandCeiling
  });
}

function legionWorldPosition(
  legion: LegionView,
  sectorsById: Map<string, SectorView>,
  lanesById: Map<string, LaneView>
): { x: number; y: number } | null {
  if (legion.position.kind === "sector") {
    const sector = sectorsById.get(legion.position.sectorId);
    if (!sector) return null;
    const c = sectorCenter(sector.layoutX, sector.layoutY);
    return { x: c.x, y: c.y - 20 };
  }

  const lane = lanesById.get(legion.position.laneId);
  if (!lane) return null;
  const from = sectorsById.get(lane.fromSectorId);
  const to = sectorsById.get(lane.toSectorId);
  if (!from || !to) return null;
  const a = sectorCenter(from.layoutX, from.layoutY);
  const b = sectorCenter(to.layoutX, to.layoutY);
  // Orient progress toward towardSectorId.
  const toward = legion.position.towardSectorId;
  const forward = toward === lane.toSectorId;
  const x0 = forward ? a.x : b.x;
  const y0 = forward ? a.y : b.y;
  const x1 = forward ? b.x : a.x;
  const y1 = forward ? b.y : a.y;
  return pointOnLane(x0, y0, x1, y1, legion.position.progress.value);
}

function upsertForces(
  scene: Phaser.Scene,
  theme: WorldTheme,
  registry: WorldRegistry,
  model: SyncWorldModel,
  sectorsById: Map<string, SectorView>
): void {
  const playerFactionId = model.playerFactionId ?? null;
  const nextForceIds = new Set<string>();
  const lanesById = new Map(model.lanes.map((l) => [l.laneId, l]));
  const legionIds = new Set((model.legions ?? []).map((l) => l.entityId));

  // Exact legions win over forcesBySectorId for the same entityId (gaps D15).
  for (const legion of model.legions ?? []) {
    const pos = legionWorldPosition(legion, sectorsById, lanesById);
    if (!pos) continue;
    const id = legion.entityId;
    nextForceIds.add(id);
    const force = forceFromLegion(legion);
    const ownership = legion.ownerFactionId === playerFactionId ? "yours" : "enemy";
    const paintKey = forcePaintKey(force, ownership);
    const existing = registry.getForce(id) as Phaser.GameObjects.Container | undefined;
    if (existing?.active && existing.getData("paintKey") === paintKey) {
      existing.setPosition(pos.x, pos.y);
      continue;
    }
    existing?.destroy();
    const marker = createForceMarker(scene, theme, {
      id,
      force,
      ownership,
      x: pos.x,
      y: pos.y
    });
    marker.setDepth(5);
    marker.setData("paintKey", paintKey);
    registry.setForce(id, marker);
  }

  for (const [sectorId, forces] of Object.entries(model.forcesBySectorId ?? {})) {
    const sector = sectorsById.get(sectorId);
    if (!sector) continue;
    const { x: cx, y: cy } = sectorCenter(sector.layoutX, sector.layoutY);

    forces.forEach((force, index) => {
      if (legionIds.has(force.entityId)) return;
      const id = force.entityId;
      nextForceIds.add(id);
      const ownership = force.ownerFactionId === playerFactionId ? "yours" : "enemy";
      const offset = (index - (forces.length - 1) / 2) * 16;
      const x = cx + offset;
      const y = cy - 20;
      const paintKey = forcePaintKey(force, ownership);
      const existing = registry.getForce(id) as Phaser.GameObjects.Container | undefined;
      if (existing?.active && existing.getData("paintKey") === paintKey) {
        existing.setPosition(x, y);
        return;
      }
      existing?.destroy();

      const marker = createForceMarker(scene, theme, {
        id,
        force,
        ownership,
        x,
        y
      });
      marker.setDepth(5);
      marker.setData("paintKey", paintKey);
      registry.setForce(id, marker);
    });
  }

  destroyAbsent(registry, registry.forceIds(), nextForceIds, "force");
}

/**
 * Apply `world:model` when `modelSeq > lastApplied` (or `forceLodRefresh`).
 * Returns the new `lastApplied` seq, or `null` when skipped.
 */
export function syncWorldSystem(input: SyncWorldSystemInput): number | null {
  if (!input.forceLodRefresh && input.modelSeq <= input.lastApplied) return null;

  const model = asModel(input.model);
  if (!model) return input.forceLodRefresh ? input.lastApplied : null;

  const sectorsById = new Map(model.sectors.map((s) => [s.sectorId, s]));
  const playerFactionId = model.playerFactionId ?? null;

  const nextSectorIds = new Set(model.sectors.map((s) => s.sectorId));
  destroyAbsent(input.registry, input.registry.sectorIds(), nextSectorIds, "sector");
  for (const sector of model.sectors) {
    upsertSectorPin(
      input.scene,
      input.theme,
      input.registry,
      sector,
      input.tier,
      playerFactionId,
      model.slotsBySectorId ?? {}
    );
  }

  const nextLaneIds = new Set(model.lanes.map((l) => l.laneId));
  destroyAbsent(input.registry, input.registry.laneIds(), nextLaneIds, "lane");
  for (const lane of model.lanes) {
    upsertLane(input.scene, input.theme, input.registry, lane, sectorsById);
  }

  upsertForces(input.scene, input.theme, input.registry, model, sectorsById);

  return input.modelSeq;
}
