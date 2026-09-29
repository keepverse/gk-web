import type { WorldCommandRequest, WorldEntityDto } from "@/lib/bus/world";
import type { WorldGraph } from "./worldViewModel";

/**
 * Selection and the pending-order queue — the map page's entire interaction state, as a pure
 * reducer. Keeping it out of the component is what makes "can I claim this?" testable without a
 * canvas, and it is the same rule the engine applies, so a refusal is never a surprise.
 */

/**
 * `world-stage` W66: widened from three kinds to eight, matching `WorldCommand.All`'s own live
 * vocabulary (`WorldCommand.cs:53-54`) at the time this task was built — `stand-fast`, `stance`
 * (with its `stance` posture field), `sustain` (with `amount`), `build` (with `structureId` and
 * `slotIndex`), alongside the original `move`/`clear`/`claim`. **`ward` is the one member that is
 * type-complete but unreachable today**: the task this widening was planned against names it as a
 * lane-scoped order, but `WorldCommand.cs:44-49`'s own comment is explicit that `ward` — raising a
 * lane's `WardLevel` — "names the still-unbuilt lane action" and is deliberately distinct from the
 * real, already-shipped `bind-warden` (a sector order). No `WorldCommandAdmission.cs` case exists
 * for it, so a `ward`-kind order would always be refused as an unknown kind if actually filed —
 * the type accepts it (and `toRequests` maps its `laneId` faithfully) so the queue's own shape is
 * ready the day the engine catches up, but nothing in this program's UI produces one yet, matching
 * the same "never draw a verb the vocabulary lacks" rule the cede embargo (W59/W60) established.
 * `cede` and `bind-warden` (also real commands today, `world-commands` W24/W28) are deliberately
 * **not** added here: both act immediately rather than joining a march-style queue a player reviews
 * before committing, so they don't fit `PendingOrder`'s own shape — a scope boundary, not an
 * oversight.
 */
export type PendingOrder = {
  commandId: string;
  kind: "move" | "clear" | "claim" | "stand-fast" | "stance" | "sustain" | "build" | "ward";
  entityId: string;
  sectorId?: string;
  slotIndex?: number;
  lanePath?: string[];
  /** `stance`'s posture — march, scout, hold, or dowse (`world-commands` W30). */
  stance?: string;
  /** `sustain`'s whole-loam spend — `long` end to end per W22, never a narrower type. */
  amount?: number;
  /** `build`'s structure choice. */
  structureId?: string;
  /** Wonder `build`'s picked relic list (`rpg_item.instance_id`s, order-preserved — wonder-rest
   * §Design 3). Absent = "spends no relic"; `toRequests` emits `null`, never `[]`-vs-`null` drift. */
  relicInstanceIds?: string[];
  /** `ward`'s target — a lane, not a sector (see the module comment on why this kind is unreachable
   * today even though the field round-trips). */
  laneId?: string;
  /** What the order does, in one line, for the queue list. */
  label: string;
};

export type WorldUiState = {
  selectedSectorId: string | null;
  selectedEntityId: string | null;
  pending: PendingOrder[];
};

export type WorldUiAction =
  | { type: "select-sector"; sectorId: string | null }
  | { type: "select-entity"; entityId: string | null }
  | { type: "queue"; order: PendingOrder }
  | { type: "unqueue"; commandId: string }
  | { type: "clear-queue" };

export const initialWorldUi: WorldUiState = {
  selectedSectorId: null,
  selectedEntityId: null,
  pending: []
};

export function worldUiReducer(state: WorldUiState, action: WorldUiAction): WorldUiState {
  switch (action.type) {
    case "select-sector":
      // world-stage W65: clicking the already-selected sector again deselects it — a real dispatch
      // of `select-sector: null` this reducer never had, not merely the caller passing `null`
      // explicitly (Esc/right-click/✕ do that already). A `null` action always deselects outright.
      return {
        ...state,
        selectedSectorId: action.sectorId != null && action.sectorId === state.selectedSectorId ? null : action.sectorId
      };
    case "select-entity":
      return { ...state, selectedEntityId: action.entityId };
    case "queue": {
      // One order per legion per turn, the same rule the engine's movement phase applies: a second
      // order for the same force replaces the first rather than stacking behind it.
      const kept = state.pending.filter(
        (p) => !(p.entityId === action.order.entityId && p.kind === action.order.kind)
      );
      return { ...state, pending: [...kept, action.order] };
    }
    case "unqueue":
      return { ...state, pending: state.pending.filter((p) => p.commandId !== action.commandId) };
    case "clear-queue":
      return { ...state, pending: [] };
    default:
      return state;
  }
}

/**
 * Wire shape for the whole queue — the exact payload `POST /commands` expects. Every field the
 * engine actually reads for one of the eight kinds round-trips (`stance`/`amount`/`structureId`/
 * `relicInstanceIds`, `world-stage` W66 + wonder-rest §Design 3) — a field the queue carries and
 * exactly how `stance` was found missing the first time. `laneId` (`ward`'s own target) has no
 * wire counterpart at all yet — `WorldCommandRequest` carries no `LaneId` field, matching `ward`
 * having no admission arm either — so it is deliberately not mapped here; a `ward` order files as
 * `kind: "ward"` alone and is refused as an unknown kind, honestly, rather than smuggled onto a
 * field (like `sectorId`) that means something else.
 */
export function toRequests(pending: PendingOrder[]): WorldCommandRequest[] {
  return pending.map((order) => ({
    commandId: order.commandId,
    kind: order.kind,
    entityId: order.entityId,
    sectorId: order.sectorId ?? null,
    slotIndex: order.slotIndex ?? null,
    lanePath: order.lanePath ?? [],
    stance: order.stance ?? null,
    amount: order.amount ?? null,
    structureId: order.structureId ?? null,
    relicInstanceIds: order.relicInstanceIds ?? null
  }));
}

/**
 * The lane path from one sector to another, as a breadth-first walk over open lanes in stable id
 * order. Wave 1 has no lane costs on the client — this finds *a* legal route, and the engine is the
 * one that decides how far along it the legion actually gets this turn.
 */
export function routeBetween(graph: WorldGraph, fromSectorId: string, toSectorId: string): string[] | null {
  if (fromSectorId === toSectorId) return null;

  const neighbours = new Map<string, { laneId: string; to: string }[]>();
  for (const edge of graph.edges) {
    if (edge.data.severed) continue;
    for (const [a, b] of [
      [edge.source, edge.target],
      [edge.target, edge.source]
    ]) {
      const list = neighbours.get(a);
      const step = { laneId: edge.id, to: b };
      if (list) list.push(step);
      else neighbours.set(a, [step]);
    }
  }

  const cameFrom = new Map<string, { laneId: string; from: string }>();
  const seen = new Set<string>([fromSectorId]);
  const queue: string[] = [fromSectorId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toSectorId) break;

    for (const step of (neighbours.get(current) ?? []).slice().sort((x, y) => (x.laneId < y.laneId ? -1 : 1))) {
      if (seen.has(step.to)) continue;
      seen.add(step.to);
      cameFrom.set(step.to, { laneId: step.laneId, from: current });
      queue.push(step.to);
    }
  }

  if (!cameFrom.has(toSectorId)) return null;

  const path: string[] = [];
  let cursor = toSectorId;
  while (cursor !== fromSectorId) {
    const step = cameFrom.get(cursor)!;
    path.unshift(step.laneId);
    cursor = step.from;
  }

  return path;
}

/**
 * The route to file for one particular force, which is not the same question as the route between
 * two sectors.
 *
 * A legion caught in mid-stride is the awkward case: the engine resumes a march from the lane the
 * legion is already on and **refuses any path that does not contain it** (`path.not-contiguous`).
 * So the current lane goes at the head of the route and the rest is walked from the end it is
 * heading toward — otherwise the order looks fine in the queue and is silently dropped when the
 * turn resolves.
 */
export function routeForLegion(
  graph: WorldGraph,
  legion: WorldEntityDto,
  toSectorId: string
): string[] | null {
  if (legion.atSectorId) return routeBetween(graph, legion.atSectorId, toSectorId);

  const currentLane = legion.onLaneId;
  const heading = legion.onLaneTowardSectorId;
  if (!currentLane || !heading) return null;

  // It is already walking into the destination — the lane it is on *is* the whole order.
  if (heading === toSectorId) return [currentLane];

  const onward = routeBetween(graph, heading, toSectorId);
  return onward ? [currentLane, ...onward] : null;
}

/** A stable, readable id for an order — unique per commander per turn, which is what the store keys on. */
export function orderId(turn: number, kind: string, entityId: string): string {
  return `t${turn}-${kind}-${entityId}`;
}

/**
 * Every sector a legion could actually file a march toward, keyed to the real route length in lane
 * hops (`world-stage` W71) — the input `RangeOverlay` (W69) needs to draw a legion's own reachable
 * set, the same "solid ring plus its hop number" grammar the build verbs already use, just fed a
 * different source.
 *
 * Deliberately **not** a second BFS: it walks `graph.nodes` and calls `routeForLegion` for each one,
 * so the "resume from the current lane" rule for a mid-march legion — the entire reason
 * `routeForLegion` exists rather than a plain `routeBetween` — is honoured for free instead of
 * re-derived and risking the two falling out of sync. The legion's own sector (or, mid-march, no
 * sector is "its own" at all) never appears in the map, because `routeForLegion` already refuses a
 * route to where the legion stands — which is exactly right: standing still is not a march order.
 */
export function reachableFromLegion(graph: WorldGraph, legion: WorldEntityDto): Map<string, number> {
  const distances = new Map<string, number>();
  for (const node of graph.nodes) {
    const path = routeForLegion(graph, legion, node.id);
    if (path) distances.set(node.id, path.length);
  }
  return distances;
}
