import type { FeedItem } from "../feed/feedReducer";

/**
 * notify-client spec §6 — replaces "dismiss-only". The GG-50 bound a rail declares is stated as
 * the filter itself: registering a policy here is what the `ui/volumeMatrix.test.ts` row for that
 * surface can point to as real wiring, not just a claim.
 */
export type RailMountPolicy<Ctx> = {
  id: string;
  includes(item: FeedItem, ctx: Ctx): boolean;
};

/**
 * world: the End Turn flush, as a filter — only the most recently resolved turn of this world.
 * Survives a reload (a flush on a transient array did not, `notifyRailStore.ts`'s own history),
 * and needs no commit wiring: `lastResolvedTurn` only moves on an advancing commit, so this fires
 * on `advanced`, never on the button press, by construction (spec-world-notify.md §2).
 *
 * v1 registers only this policy (spec §6): every stage gets toasts at the app level; a rail on any
 * other stage needs its own policy AND its own `volumeMatrix` row first (ideal finding C1).
 */
export const worldLatestTurn: RailMountPolicy<{ worldId: string; lastResolvedTurn: number }> = {
  id: "world",
  includes: (i, c) => i.worldId === c.worldId && i.worldTurn === c.lastResolvedTurn
};
