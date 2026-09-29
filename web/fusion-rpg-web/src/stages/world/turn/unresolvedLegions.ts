import type { LegionView } from "@/contract/types";
import type { PendingOrder } from "@/stages/world/worldSelection";

/**
 * world-stage W77 (spec-world-turn.md §3) — THE derivation: a legion of yours with movement
 * remaining and no order filed this turn. Written once and consumed twice — the turn cluster's own
 * count (W79/W80) and the outliner's per-row unresolved flag (`world-outliner`) both import this
 * rather than re-deriving it, which is the whole reason it lives here instead of inline in either
 * caller.
 *
 * Pure, and holds no state: every legion still standing after this filter is unresolved, full stop.
 */
export function unresolvedLegions(
  legions: readonly LegionView[],
  pending: readonly PendingOrder[]
): readonly LegionView[] {
  const ordered = new Set(pending.map((order) => order.entityId));
  return legions.filter((legion) => legion.movementRemaining.value > 0 && !ordered.has(legion.entityId));
}
