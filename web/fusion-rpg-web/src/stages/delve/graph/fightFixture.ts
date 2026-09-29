import { known } from "@/contract/pending";
import type { FightView } from "@/contract/types";
import type { RoomFightState } from "./FightInPlace";

/**
 * D5.5 demo / live-preview data only. **Not a wire fixture** — unlike `fixtures/first-descent.json`
 * (D5.4), this is never parsed from a server-shaped DTO through an adapter, because no adapter for
 * `FightView` exists (`adaptFight` was never built — D5.3's own entry: "no real, composed Core
 * producer exists"). `FightView.initiative`/`.strikeFeed` are typed `Pending<unknown[]>` specifically
 * because no Core producer or SignalR message shape for a fight's live state exists anywhere
 * (confirmed by `FightInPlace.tsx`'s own module doc comment) — so `FightInPlace` reads these arrays by
 * **length only**, never per-entry shape, and the `{}` placeholders below are never dereferenced for
 * content. Their sole purpose is giving `known([...])` a real, non-zero length so the ranks row and
 * the strike feed have something real to animate against, in tests and in a live browser.
 *
 * Wired only behind `DelveStage.tsx`'s own existing fixture fallback (`live.data == null`, D5.1's
 * precedent) — the moment a real delve loads, this demo overlay is never even constructed, so it can
 * never shadow real data. See that file's own module doc comment for the exact gate.
 */
const DEMO_FIGHT: FightView = {
  frozen: known(false),
  dwellRemaining: known({ unit: "milliseconds", value: 1200 }),
  initiative: known([{}, {}, {}]),
  strikeFeed: known([{}, {}])
};

/**
 * Keyed to `fixtures/first-descent.json`'s own real sector ids (D5.4), not invented ones.
 * - `s-1` — `kind: "fight"`, `sight: "Full"` in the bundled fixture, with party 501 positioned there
 *   (`atSectorId: "s-1"`): the steered demo. Expands live.
 * - `s-3` — `kind: "elite"` but `sight: "Glimpse"` in the bundled fixture: the un-steered demo, and
 *   simultaneously a live proof of `RoomNode`'s own sight gate — an active fight is supplied here, but
 *   the room never expands, because a glimpsed room never reveals fight detail (the same rule every
 *   other Full-only field already follows).
 */
export const DEMO_ACTIVE_FIGHTS: Record<string, RoomFightState> = {
  "s-1": { fight: DEMO_FIGHT, steered: true },
  "s-3": { fight: DEMO_FIGHT, steered: false }
};
