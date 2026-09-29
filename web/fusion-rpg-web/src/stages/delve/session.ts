import type { DelveConnectionStatus } from "./hud/connectionState";

/**
 * D5.11 — the live session client's own pure state machine (spec-delve-stage.md §9, "Live input and
 * session behaviour"; its own §14 Verify row names the four tests this file's colocated `.test.ts`
 * carries by name: `Three_timeouts_freeze_and_say_so`, `Reconnect_replays_then_goes_live`,
 * `Closing_the_fight_panel_is_not_a_retreat`, `Leaving_the_stage_resolves_nothing`).
 *
 * **What this file deliberately is NOT, and never was: a SignalR client.** This module is the pure
 * reducer half only — no transport, no timers, no `Date.now()`. That split is now proven out, not just
 * planned: `stages/delve/liveSession.ts` (built 2026-09-08, once D2.16's server-side session primitive
 * and its own live-push wave landed — `RpgHub.cs`'s real `Steer`/`Declare` calls plus
 * `DelveLiveEventNames`'s real SignalR pushes) is the actual transport, feeding this reducer real
 * `SessionEvent`s via `dispatch` — and nothing in THIS file changed to receive that wiring, exactly as
 * planned below.
 *
 * **What was safely buildable before that wire contract existed: this pure reducer.** Every real
 * precedent in this program splits "the state a UI renders from" (a reducer, tested with plain objects)
 * from "the transport that feeds it" (a hook wired separately) — `delveSelection.ts`/
 * `delveSelectionReducer` is the closest sibling shape, and `lib/bus/delve.ts`'s own hooks are the
 * closest "transport is a separate concern" precedent. `liveSession.ts` is that transport now; see its
 * own doc comment for the exact wire-message-to-`SessionEvent` mapping.
 *
 * **Status is not reinvented.** `hud/connectionState.ts`'s `DelveConnectionStatus` (`"live" |
 * "reconnecting" | "frozen" | "offline"`) already exists, is already rendered by
 * `ConnectionStateBadge.tsx`/`InitiativeRail.tsx`, and already carries the exact §9 quoted copy this
 * spec requires ("Your band is waiting.", via `connectionStatusLabel("frozen")`) — GG-23's "one
 * translation table" discipline means this module reuses that type and that label rather than adding a
 * second, parallel vocabulary for the identical concept. "Replaying the recorded prefix" (§9: "resume
 * replays the recorded prefix, then goes live") is deliberately mapped onto the existing `"reconnecting"`
 * state rather than a fifth status: from the player's own point of view both are "not live yet, band is
 * catching up," and `connectionStatusLabel` already has honest copy for it. Adding a status the badge
 * component does not know how to render would be a second, silent contract this module has no authority
 * to open.
 *
 * **`declared` mirrors `DecisionSource` (`DecisionTrace.cs:6-20`), not a client invention.** The C# enum
 * has exactly two members, `Player` and `Timeout` — "a timeout is a real decision, not an absence." This
 * file's `SessionEvent["source"]` union carries the same two values so the freeze rule below reads as
 * the identical count `BattleSessionRegistry.NoteTurn` (`BattleSessionRegistry.cs:144-157`) already
 * implements server-side, not a re-derived one.
 *
 * **Named, out of scope on purpose:** `steer` (switching which party is being controlled) is a
 * delve-level decision (`steer{from,to}`, `spec-delve-battle-profile.md:144`) that multiplexes several
 * parties' fight sessions against one delve — it is not a transition of any *single* fight's session
 * state machine, which is all this file models. A caller that wires several parties would run one of
 * these reducers per steered party and swap which instance is live; that composition is a future task's
 * wiring concern, not a reason to invent a `"steer"` event here with no payload shape to give it (no
 * `SteerDto` exists anywhere in `contract/types.ts` today).
 */

/** Where a recorded decision came from. Mirrors `DecisionSource` (`DecisionTrace.cs:6-20`) exactly —
 * two members, nothing invented. */
export type SessionDecisionSource = "player" | "timeout";

/**
 * What the pure session state machine reacts to. Every variant here is either something the (not yet
 * built) live transport would eventually report, or a genuinely local UI event this module must prove
 * has no session-level effect (`panel-closed`, `stage-left`).
 */
export type SessionEvent =
  /** The live session was (re)subscribed and is answering normally. */
  | { type: "subscribed" }
  /** A decision landed for the steered party — a player's own choice, or the dwell's timeout fallback.
   * Mirrors the server's own `InteractiveIntentSource.TryDeclare` (`InteractiveIntentSource.cs:119-145`):
   * every declare either records `Player` (resets the AFK count) or `Timeout` (advances it). */
  | { type: "declared"; source: SessionDecisionSource }
  /** The transport dropped outright (as distinct from three timeouts landing normally) — §9's own
   * "or the connection drops" clause freezes the fight the same way the third timeout does. */
  | { type: "connection-dropped" }
  /** The client has started trying to re-establish the transport after a freeze. */
  | { type: "reconnect-started" }
  /** The server handed the session back after a freeze: `replayCount` recorded decisions must be
   * replayed before new input is accepted, mirroring `InteractiveIntentSource.ResumeReplayThenLive`
   * (`InteractiveIntentSource.cs:110-117`) — a `replayCount` of `0` has nothing to replay and goes
   * straight live, the same `TryDeclare` branch takes when `ReplayExhausted` is already true. */
  | { type: "resumed"; replayCount: number }
  /** One item of the recorded prefix was applied. Fired once per replayed decision until the prefix is
   * exhausted, at which point the session goes live — never re-timed, never re-asked. */
  | { type: "replay-consumed" }
  /** The fight panel was closed. §9: "Nothing pauses; the fight keeps taking fallbacks and the room
   * stays live" — `FightInputPanel.tsx`'s own doc comment already confirms the real panel has no
   * close-time side effect. This event exists so the reducer itself proves the same thing: closing the
   * panel can only ever be a no-op here, never a retreat. */
  | { type: "panel-closed" }
  /** The player navigated away from the delve stage entirely (unmount). §9: "Nothing resolves. The
   * delve stays `Active`... Navigation is not `retreat` and not `extract`" — the siege precedent
   * (`spec-siege-stage.md:141`). Whatever the server-side freeze/timeout logic would have done anyway
   * still happens; this event itself must add no further side effect. */
  | { type: "stage-left" };

export type SessionState = {
  /** Reuses `hud/connectionState.ts`'s own type — see the module doc comment for why this is not a
   * second, parallel status vocabulary. */
  status: DelveConnectionStatus;
  /** Turns taken by timeout since the last player decision (or the last freeze/resume). Mirrors
   * `BattleSession.ConsecutiveTimeouts` (`BattleSessionRegistry.cs:34`). */
  consecutiveTimeouts: number;
  /** Recorded decisions still to be replayed before live input resumes. Zero once the session is
   * genuinely live, including a fresh subscribe that never froze. */
  replayRemaining: number;
};

export const initialSessionState: SessionState = {
  status: "offline",
  consecutiveTimeouts: 0,
  replayRemaining: 0
};

/**
 * Turns of silence before the fight freezes. **Structural, not a tunable** — mirrors
 * `BattleSessionRegistry.MaxConsecutiveTimeouts` (`BattleSessionRegistry.cs:67`), itself commented "a
 * session bound, not a feel number" and named as such again in `spec-delve-stage.md` §12's "Not
 * tunables" row. A balance pass does not change how many turns of silence a fight tolerates before
 * telling the player it is waiting; changing this number changes what the freeze rule *means*, the
 * `tunables-ssot.md` line for "keep the const."
 */
export const MAX_CONSECUTIVE_TIMEOUTS = 3;

/**
 * The pure session reducer. No transport, no timers, no `Date.now()` — every timing decision (the dwell
 * window, the AFK count) is made by the server and arrives here as an event, the identical
 * "the session layer owns the countdown, the trace owns what it decided" split
 * `InteractiveIntentSource.cs:14-17`'s own doc comment states for its C# counterpart.
 */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "subscribed":
      return { status: "live", consecutiveTimeouts: 0, replayRemaining: 0 };

    case "declared": {
      // A frozen session takes no further decisions of its own — it is waiting on `resumed`, exactly
      // as `BattleSessionRegistry.Disconnect` preserves a session rather than continuing to tick it.
      if (state.status === "frozen") return state;

      if (event.source === "player") {
        return { ...state, consecutiveTimeouts: 0 };
      }

      const consecutiveTimeouts = state.consecutiveTimeouts + 1;
      return consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS
        ? { ...state, status: "frozen", consecutiveTimeouts }
        : { ...state, consecutiveTimeouts };
    }

    case "connection-dropped":
      // §9: "or the connection drops" freezes exactly like the third timeout — same visible state, a
      // different cause. The timeout count is left as-is: a resume always resets it explicitly.
      return { ...state, status: "frozen" };

    case "reconnect-started":
      return { ...state, status: "reconnecting" };

    case "resumed":
      if (event.replayCount < 0) {
        throw new Error(`sessionReducer: resumed with a negative replayCount (${event.replayCount})`);
      }
      return {
        status: event.replayCount > 0 ? "reconnecting" : "live",
        consecutiveTimeouts: 0,
        replayRemaining: event.replayCount
      };

    case "replay-consumed": {
      const replayRemaining = Math.max(0, state.replayRemaining - 1);
      return { ...state, replayRemaining, status: replayRemaining > 0 ? "reconnecting" : "live" };
    }

    case "panel-closed":
    case "stage-left":
      // Deliberately the exact same object back, not a shallow copy — the strongest available proof
      // these two events are true no-ops: nothing about the session changes, so nothing is allocated.
      return state;

    default: {
      const exhaustive: never = event;
      throw new Error(`sessionReducer: unhandled event ${JSON.stringify(exhaustive)}`);
    }
  }
}
