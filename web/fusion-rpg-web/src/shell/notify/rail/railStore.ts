import type { NotifyCategoryId, NotifySeverity } from "../catalog";

export type RailItemState = "unread" | "opened" | "dismissed" | "minimized" | "blocking";

/**
 * One row on a rail — the rail's own shape, moved here from the world stage's store
 * (world-notify-source §4) so the rail is not world-owned.
 *
 * `id` is the handle the rail's own callbacks take and `dedupKey` is the feed's identity (R-N5).
 * They are the same string today; both names exist because a server row is addressed by its key
 * while the rail's buttons pass an id. `seq`, `worldId` and `worldTurn` are `null` only for a row
 * this session built itself — the named capture-loss debt adapter (world-notify-source §Debt) — and
 * a server row always carries all three.
 */
export type RailItem = {
  id: string;
  dedupKey: string;
  /** The server row id; null for a locally built row that was never durable. */
  seq: number | null;
  category: NotifyCategoryId;
  severity: NotifySeverity;
  /** Already translated by `renderNotification`. This module never sees an engine token. */
  title: string;
  body: string;
  state: RailItemState;
  /** Null for a locally built row: never durable, so never on a turn. */
  worldId: string | null;
  worldTurn: number | null;
  /** Blockers cannot be dismissed and are never filtered out — spec-world-notify.md §2. */
  readonly blocking: boolean;
};

// The End Turn flush is RETIRED as a store function (world-notify-source §4, notify-client §6). The
// GG-50 bound a rail declares is its mount policy's filter now — `mountPolicies.worldLatestTurn`
// includes only the most recently resolved turn of one world, so it needs no commit wiring to fire
// on `advanced` and it survives a reload, which a flush over a transient array did not.

/** Opening and dismissing are two gestures with two outcomes (§3) — this only clears "unread". */
export function open(items: RailItem[], id: string): RailItem[] {
  return items.map((i) => (i.id === id && i.state === "unread" ? { ...i, state: "opened" } : i));
}

/**
 * Removed from the feed, never from history — the server row keeps the record, so this never deletes
 * the item outright: it marks it dismissed, and the mount policy is what stops showing it. A blocker
 * refuses silently: the state is already `"blocking"` and this leaves it exactly as it was.
 */
export function dismiss(items: RailItem[], id: string): RailItem[] {
  return items.map((i) => (i.id === id && !i.blocking ? { ...i, state: "dismissed" } : i));
}

/** A per-category state, not a per-message one — where a whole category lands once routed here. */
export function minimizeCategory(items: RailItem[], category: NotifyCategoryId): RailItem[] {
  return items.map((i) => (i.category === category && !i.blocking ? { ...i, state: "minimized" } : i));
}
