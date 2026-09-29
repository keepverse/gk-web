import type { NotificationItem, NotificationStateChangedEvent } from "../catalog";

/** notify-client spec §2 — `NotificationItem` already carries `state` (notify-vocabulary's own
 * wire shape), so the feed's item type is exactly the wire item; no separate merge is needed. */
export type FeedItem = NotificationItem;

export type FeedStatus = "idle" | "loading" | "ready" | "error";

export type FeedState = {
  /** The save being shown (R17). `null` before the first `player-joined`. */
  playerId: number | null;
  /** Keyed by `dedupKey` (R-N5) — the one identity a row keeps across insert and every later
   * state change. */
  byKey: Record<string, FeedItem>;
  /** The since-cursor for the next catch-up page (`notify-store` property 4). */
  maxRev: number;
  status: FeedStatus;
};

export const initialFeedState: FeedState = {
  playerId: null,
  byKey: {},
  maxRev: 0,
  status: "idle"
};

/** F1 (first join) / F3 (save switch) — the key-set edge. The old save's items are gone before
 * the new catch-up lands (the caller pages `since: 0` against this fresh state, never the old
 * `maxRev`). */
export function resetForPlayer(playerId: number): FeedState {
  return { playerId, byKey: {}, maxRev: 0, status: "loading" };
}

/**
 * The whole dedup story is one keyed merge (F1/F2/F4/F4b all funnel through this). F7: a batch for
 * a save other than the one shown is dropped whole, never partially applied.
 */
export function applyItems(s: FeedState, items: readonly NotificationItem[], playerId: number): FeedState {
  if (playerId !== s.playerId) return s; // F7
  const byKey = { ...s.byKey };
  let maxRev = s.maxRev;
  for (const it of items) {
    const held = byKey[it.dedupKey];
    if (!held || it.rev > held.rev) byKey[it.dedupKey] = { ...it }; // higher rev wins — order-free
    if (it.rev > maxRev) maxRev = it.rev;
  }
  return { ...s, byKey, maxRev, status: "ready" };
}

/**
 * F5 (pushed elsewhere) / F6 (this session's own read/dismiss/undo, applied from the mutation's
 * own response — same shape as the pushed event). A change for a row this feed has never held is
 * dropped WITHOUT advancing `maxRev`: `NotificationStateChangedDto` carries only `{seq, rev}`, not
 * the row's other fields, so there is nothing to store yet, and advancing the cursor past a row we
 * never actually received would make the next catch-up page skip it forever (a store row's `rev`
 * is bumped in place on a state change, not appended as a new one — `since=maxRev` would then never
 * be `< rev` again for that row). The next catch-up GET (or a live/catch-up batch) brings the row
 * in at its current state, closing the gap correctly.
 */
export function applyStateChange(s: FeedState, event: NotificationStateChangedEvent): FeedState {
  if (event.playerId !== s.playerId) return s;
  const byKey = { ...s.byKey };
  let maxRev = s.maxRev;
  for (const change of event.changes) {
    const key = Object.keys(byKey).find((k) => byKey[k]!.seq === change.seq);
    if (!key) continue; // not held — see doc comment above; maxRev intentionally not advanced
    const held = byKey[key]!;
    if (change.rev > held.rev) {
      byKey[key] = { ...held, state: event.state, rev: change.rev };
      if (change.rev > maxRev) maxRev = change.rev;
    }
  }
  return { ...s, byKey, maxRev };
}
