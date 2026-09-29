import type { LegionView, SectorView } from "@/contract/types";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { unresolvedLegions } from "@/stages/world/turn/unresolvedLegions";

export type OutlinerRowKind = "legion" | "sector";

export type OutlinerRow = {
  kind: OutlinerRowKind;
  id: string;
  /** Anything flagged sorts above anything quiet — a legion with moves left and no orders, or a
   * sector whose stability has started to slip (`worldViewModel.ts`'s own `anchorStateOf`). */
  flagged: boolean;
  legion?: LegionView;
  sector?: SectorView;
};

export type OutlinerGroup = {
  kind: OutlinerRowKind;
  label: string;
  count: number;
  rows: OutlinerRow[];
};

export type OutlinerFilter = "needs-orders" | "fading" | "all";

/** Stable below the flag: two rows with the same flagged-ness keep their original relative order,
 * so a row never moves under the pointer for a reason the player cannot see. */
function sortFlaggedFirstStable(rows: readonly OutlinerRow[]): OutlinerRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.flagged !== b.row.flagged) return a.row.flagged ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * world-stage W90 (spec-world-outliner.md) — the pure model: two groups with counts, anything
 * flagged sorted above anything quiet, stable below that. `legions`/`sectors` are the caller's own
 * job to have already narrowed to the player's — this module never filters by ownership itself, the
 * same "views in, rows out" boundary `unresolvedLegions.ts` already draws.
 *
 * The unresolved flag is `unresolvedLegions.ts`'s own export, imported rather than re-derived — the
 * same derivation the turn cluster's own count reads, so the two can never disagree.
 */
export function buildOutlinerGroups(
  legions: readonly LegionView[],
  sectors: readonly SectorView[],
  pending: readonly PendingOrder[]
): OutlinerGroup[] {
  const unresolvedIds = new Set(unresolvedLegions(legions, pending).map((l) => l.entityId));

  const legionRows = sortFlaggedFirstStable(
    legions.map((legion) => ({
      kind: "legion" as const,
      id: legion.entityId,
      flagged: unresolvedIds.has(legion.entityId),
      legion
    }))
  );

  const sectorRows = sortFlaggedFirstStable(
    sectors.map((sector) => ({
      kind: "sector" as const,
      id: sector.sectorId,
      flagged: isFading(sector),
      sector
    }))
  );

  return [
    { kind: "legion", label: "Legions", count: legionRows.length, rows: legionRows },
    { kind: "sector", label: "Sectors", count: sectorRows.length, rows: sectorRows }
  ];
}

/** §4.6's own floor (`worldViewModel.ts`'s `AnchoredFloorMilli`, private there) — mirrored here as
 * the outliner's own "flagged" threshold rather than importing a private constant. A sector below it
 * has started to slip; ownership/habitability are the caller's own concern via which sectors it
 * passes in, not re-checked here. */
const ANCHORED_FLOOR_MILLI = 900;
function isFading(sector: SectorView): boolean {
  return sector.stability.value < ANCHORED_FLOOR_MILLI;
}

/** Three exclusive filter chips — at 28 rows the player knows the condition, not the name. */
export function applyOutlinerFilter(groups: readonly OutlinerGroup[], filter: OutlinerFilter): OutlinerGroup[] {
  if (filter === "all") return [...groups];
  return groups.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => {
      if (filter === "needs-orders") return row.kind === "legion" && row.flagged;
      return row.kind === "sector" && row.flagged; // "fading"
    })
  }));
}
