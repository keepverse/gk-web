import type { EventEnvelope } from "@/lib/bus/types";
import { isCombatHitKind } from "./lawnLogFilter";
import { foldLawnEvents, foldLawnFromRing } from "./lawnProjectorFold";
import {
  emptyLawnViewModel,
  listOccupants,
  listTiles,
  type LawnViewModel
} from "./lawnViewModel";

export function membershipFingerprint(m: LawnViewModel): string {
  const occ = listOccupants(m)
    .map(
      (o) =>
        `${o.ptr}:${o.side}:${o.typeId}:${o.row ?? ""}:${o.col ?? ""}:${o.hp ?? ""}`
    )
    .sort()
    .join(";");
  const mow = [...m.mowers.values()]
    .map((x) => `${x.ptr}:${x.started ? 1 : 0}`)
    .sort()
    .join(";");
  const tiles = listTiles(m)
    .map((t) => t.ptr)
    .sort()
    .join(";");
  const chrome = `${m.economy?.sun ?? ""}:${m.economy?.money ?? ""}:${m.economy?.wave ?? ""}:${m.economy?.points ?? ""}`;
  return `${m.phase}|${m.matchKey ?? ""}|${m.rows}x${m.cols}|${occ}|${mow}|${tiles}|${chrome}`;
}

function finalizeSession(
  prev: LawnViewModel,
  folded: LawnViewModel,
  lastEventId: number
): { model: LawnViewModel; lastEventId: number } {
  let model = folded;
  if (model.revision < prev.revision) model = { ...model, revision: prev.revision };
  if (
    membershipFingerprint(model) !== membershipFingerprint(prev) &&
    model.revision <= prev.revision
  ) {
    model = { ...model, revision: prev.revision + 1 };
  }
  return { model, lastEventId };
}

/** Incremental session fold. Ring eviction does not un-apply. Snapshot events still GC living. */
export function applyLawnSession(
  prev: LawnViewModel,
  ringNewestFirst: readonly EventEnvelope[],
  lastEventId: number
): { model: LawnViewModel; lastEventId: number } {
  const hasIds = ringNewestFirst.some((e) => e.id != null && e.id > 0);
  if (!hasIds) {
    const folded = foldLawnFromRing(ringNewestFirst);
    return finalizeSession(prev, folded, lastEventId);
  }
  const maxId = Math.max(0, ...ringNewestFirst.map((e) => e.id ?? 0));
  if (maxId < lastEventId) {
    const folded = foldLawnFromRing(ringNewestFirst);
    return finalizeSession(emptyLawnViewModel(), folded, maxId);
  }
  const chrono = [...ringNewestFirst]
    .reverse()
    .filter((e) => (e.id ?? 0) > lastEventId);
  if (!chrono.length) return { model: prev, lastEventId };
  const membershipDelta = chrono.filter((e) => !isCombatHitKind(e.kind));
  if (!membershipDelta.length) {
    return { model: prev, lastEventId: Math.max(lastEventId, maxId) };
  }
  const folded = foldLawnEvents(membershipDelta, prev);
  return finalizeSession(prev, folded, Math.max(lastEventId, maxId));
}
