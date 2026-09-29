import type { HubConnection } from "@microsoft/signalr";
import { getHubConnection } from "@/lib/bus/hub";
import type { SessionDecisionSource, SessionEvent } from "./session";

/**
 * D5.11's live-push wave (2026-09-08) — the actual SignalR transport `session.ts`'s own module doc
 * comment named as "a future task": a real connection dispatching real `SessionEvent`s, fed by the
 * server-side wire vocabulary `DelveLiveEventNames.cs` now pushes (`gk-core/src/FusionRpg.Server/DelveLivePush.cs`)
 * and the real `Steer`/`Declare` hub methods (`RpgHub.cs`) already built by D2.16.
 *
 * **What this file deliberately is NOT: a second connection, or any logic of its own.** `lib/bus/hub.ts`'s
 * `getHubConnection()` is the one shared SignalR connection every other bus module already reuses
 * (`hub-provider.tsx`'s own `HubProvider` owns starting/stopping it and its top-level status); this
 * module attaches its own scoped listeners to that SAME connection and tears them down again, exactly
 * the `c.on(...)`/`c.off(...)` pattern `hub-provider.tsx` already establishes — it never calls
 * `connection.start()`/`.stop()` itself. Every real transformation (what a push MEANS for the session)
 * stays inside `sessionReducer` (`session.ts`) — this file only maps a wire event name to the matching
 * `SessionEvent` and calls `dispatch`, matching `lib/bus/delve.ts`'s own "transport is a separate
 * concern" precedent cited in `session.ts`'s own doc comment.
 *
 * **Wire message names, mapped 1:1 onto `SessionEvent`, cited from `DelveLivePush.cs`'s own doc
 * comment (the authoritative source — kept in sync by hand, not generated):**
 * - `DelveDeclared{matchKey,actorKey,source}` → `{type:"declared",source}`.
 * - `DelveFightFrozen{matchKey,delveId,partyIndex}` → `{type:"connection-dropped"}` — every freeze
 *   cause (three timeouts, an explicit steer-away, a real dropped connection) lands on the identical
 *   `status:"frozen"` state; the three-timeout cause is ALSO independently derivable client-side by
 *   counting `declared{source:"timeout"}` events, so this is a harmless, idempotent double signal for
 *   that one cause, not a bug.
 * - `DelveResumed{matchKey,replayCount}` → `{type:"resumed",replayCount}`.
 * - `DelveReplayConsumed{matchKey}` → `{type:"replay-consumed"}`.
 * - `DelveTurnStarted{matchKey,actorKey,dwellMs}` is NOT one of `session.ts`'s existing `SessionEvent`
 *   variants (whose turn it is does not change that reducer's own status/counts) — it is surfaced
 *   through the separate `onTurnStarted` callback below instead of being forced into `dispatch`.
 *
 * **`"subscribed"` is dispatched locally**, the instant this hook attaches its listeners for a given
 * `matchKey` — there is no separate server-side "you are now watching" acknowledgement message today
 * (the server has nothing to acknowledge: it pushes to the whole `WebGroup` regardless of who is
 * listening, the same broadcast-and-filter discipline every other push in this program already uses).
 * A future `DelveSessionJoined` ack could replace this dispatch if a real join round-trip is ever
 * needed; today "I started listening" and "I am subscribed" are the same fact from this client's own
 * point of view.
 *
 * **`"reconnect-started"` is NOT wired here.** It is the client's own declaration of intent right before
 * it attempts to resume a frozen fight — but `RpgHub.Resume` itself still throws `NotImplementedException`
 * in production (no automated policy exists for the raid's un-steered actors yet, D2.16's own named,
 * still-open remainder) and this task was explicitly told not to attempt that wiring. `SignalR`'s own
 * `withAutomaticReconnect()` transport-level `onreconnecting`/`onreconnected`/`onclose` hooks are ALSO
 * deliberately left unwired here: they fire for ANY transport hiccup, not specifically a delve fight
 * freeze, and `hub-provider.tsx` already owns them for its own connection-status badge. Mixing a global
 * transport signal into one delve fight's session reducer would be exactly the kind of invented wiring
 * this wave was told to avoid — a future task that actually builds a working `resume` call is the
 * correct place to dispatch `"reconnect-started"`/`"resumed"` from a real user action.
 */

export type DelveTurnStarted = { matchKey: string; actorKey: string; dwellMs: number };

type DeclaredPush = { matchKey: string; actorKey: string; source: SessionDecisionSource };
type FrozenPush = { matchKey: string; delveId: number; partyIndex: number };
type ResumedPush = { matchKey: string; replayCount: number };
type ReplayConsumedPush = { matchKey: string };

export type DelveLiveSessionHandlers = {
  /** Every `SessionEvent` this transport can produce is handed straight to the caller's own
   * `sessionReducer` dispatch — this module never reduces state itself. */
  dispatch: (event: SessionEvent) => void;
  /** `DelveTurnStarted` is real, useful information (`session.ts`'s own doc comment: "the 'your turn'
   * signal a live client needs to accept a Declare call and show a countdown") that is not a
   * `SessionEvent` — surfaced separately so a caller can wire a dwell countdown without this module
   * inventing a `SessionEvent` variant that does not belong in that reducer. */
  onTurnStarted?: (turn: DelveTurnStarted) => void;
};

/**
 * Subscribes `handlers.dispatch`/`handlers.onTurnStarted` to the live pushes for exactly ONE fight
 * (`matchKey`), on the shared hub connection. Returns an unsubscribe function — call it on unmount, the
 * same lifecycle `hub-provider.tsx`'s own `useEffect` cleanup already follows.
 *
 * Dispatches `{type:"subscribed"}` synchronously before returning (see the module doc comment for why
 * this is a local, not a server-acknowledged, event).
 */
export function subscribeDelveLiveSession(
  matchKey: string,
  handlers: DelveLiveSessionHandlers,
  connection: HubConnection = getHubConnection()
): () => void {
  const { dispatch, onTurnStarted } = handlers;

  const onDeclared = (msg: DeclaredPush) => {
    if (msg.matchKey !== matchKey) return;
    dispatch({ type: "declared", source: msg.source });
  };
  const onFrozen = (msg: FrozenPush) => {
    if (msg.matchKey !== matchKey) return;
    dispatch({ type: "connection-dropped" });
  };
  const onResumed = (msg: ResumedPush) => {
    if (msg.matchKey !== matchKey) return;
    dispatch({ type: "resumed", replayCount: msg.replayCount });
  };
  const onReplayConsumed = (msg: ReplayConsumedPush) => {
    if (msg.matchKey !== matchKey) return;
    dispatch({ type: "replay-consumed" });
  };
  const onTurnStartedMsg = (msg: DelveTurnStarted) => {
    if (msg.matchKey !== matchKey) return;
    onTurnStarted?.(msg);
  };

  connection.on("DelveDeclared", onDeclared);
  connection.on("DelveFightFrozen", onFrozen);
  connection.on("DelveResumed", onResumed);
  connection.on("DelveReplayConsumed", onReplayConsumed);
  connection.on("DelveTurnStarted", onTurnStartedMsg);

  dispatch({ type: "subscribed" });

  return () => {
    connection.off("DelveDeclared", onDeclared);
    connection.off("DelveFightFrozen", onFrozen);
    connection.off("DelveResumed", onResumed);
    connection.off("DelveReplayConsumed", onReplayConsumed);
    connection.off("DelveTurnStarted", onTurnStartedMsg);
  };
}

/** `RpgHub.Steer` (`RpgHub.cs:194`) — moves control from one party to another (or to none). */
export function steerDelveParty(
  delveId: number,
  fromPartyIndex: number | null,
  toPartyIndex: number | null,
  connection: HubConnection = getHubConnection()
): Promise<void> {
  return connection.invoke("Steer", delveId, fromPartyIndex, toPartyIndex);
}

/** `RpgHub.Declare` (`RpgHub.cs:210`) — a player's declared choice for the CURRENT dwell. Resolves
 * `false` for a stale/misdirected declare (wrong actor, no session, already frozen), never throws for
 * those cases — see `DelveBattleSession.Declare`'s own doc comment. */
export function declareDelveAction(
  matchKey: string,
  actorKey: string,
  actionId: string,
  targetKey: string | null,
  connection: HubConnection = getHubConnection()
): Promise<boolean> {
  return connection.invoke("Declare", matchKey, actorKey, actionId, targetKey);
}
