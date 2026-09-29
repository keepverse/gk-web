/**
 * Canonical dirty-flag projection for the world map host (gaps D1/D30).
 * Structural completeness — not a yield. Never hashes targeting (that rides world:interaction).
 */
import type { AdaptedWorldState } from "@/contract/adapt";
import type { LegionView } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { healthOf, ownershipOf } from "@/stages/world/render/sectorHealthAndOwnership";

export type WorldModelProjectionInput = {
  model: AdaptedWorldState;
  overlayEpoch: number;
  playerFactionId?: string | null;
  legions?: readonly LegionView[];
};

function pendingKey(p: Pending<unknown>): string {
  if (p.state === "known") return `k:${JSON.stringify(p.value)}`;
  if (p.state === "absent") return "a";
  return `p:${p.reason}`;
}

/** Projection the dirty flag hashes. Never include targeting. */
export function worldModelProjection(input: WorldModelProjectionInput): string {
  const { model, overlayEpoch } = input;
  const playerFactionId = input.playerFactionId ?? null;
  const legions = input.legions ?? [];

  const sectors = [...model.sectors]
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))
    .map((s) => {
      const ownership = ownershipOf(s, playerFactionId);
      const health = healthOf(s, ownership);
      return [
        s.sectorId,
        s.intel,
        s.intelAge,
        s.ownerFactionId ?? "",
        s.layoutX,
        s.layoutY,
        ownership,
        health,
        s.stability.value,
        s.loam.net.value,
        s.dangerBand.value,
        pendingKey(s.lifeline),
        pendingKey(s.lifelineCost),
        s.willReleaseNextTurn ? 1 : 0,
        s.component?.componentId ?? ""
      ].join(":");
    })
    .join("|");

  const lanes = [...model.lanes]
    .sort((a, b) => a.laneId.localeCompare(b.laneId))
    .map((l) =>
      [
        l.laneId,
        l.fromSectorId,
        l.toSectorId,
        l.state,
        l.typeId,
        l.width.value,
        l.wardLevel.value,
        l.hazard.value
      ].join(":")
    )
    .join("|");

  const slots = Object.keys(model.slotsBySectorId)
    .sort()
    .map((sectorId) => {
      const list = [...(model.slotsBySectorId[sectorId] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
      return `${sectorId}=${list.map((sl) => `${sl.slotIndex}:${sl.slotTypeId}:${sl.state}`).join(",")}`;
    })
    .join("|");

  const forces = Object.keys(model.forcesBySectorId)
    .sort()
    .map((sectorId) => {
      const list = [...(model.forcesBySectorId[sectorId] ?? [])].sort((a, b) =>
        a.entityId.localeCompare(b.entityId)
      );
      return `${sectorId}=${list
        .map((f) => `${f.entityId}:${f.kind}:${f.ownerFactionId}:${f.exact ? "e" : "b"}`)
        .join(",")}`;
    })
    .join("|");

  const legionPart = [...legions]
    .sort((a, b) => a.entityId.localeCompare(b.entityId))
    .map((leg) => {
      const pos =
        leg.position.kind === "sector"
          ? `s:${leg.position.sectorId}`
          : `l:${leg.position.laneId}:${leg.position.towardSectorId}:${leg.position.progress.value}`;
      return `${leg.entityId}:${pos}:${leg.ownerFactionId}`;
    })
    .join("|");

  return [
    `pf:${playerFactionId ?? ""}`,
    `ep:${overlayEpoch}`,
    `sec:${sectors}`,
    `lane:${lanes}`,
    `slot:${slots}`,
    `force:${forces}`,
    `leg:${legionPart}`
  ].join(";");
}
