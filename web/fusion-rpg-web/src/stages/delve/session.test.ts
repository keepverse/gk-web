import { describe, expect, it } from "vitest";
import { connectionStatusLabel } from "./hud/connectionState";
import {
  MAX_CONSECUTIVE_TIMEOUTS,
  initialSessionState,
  sessionReducer,
  type SessionState
} from "./session";

/** `subscribed` from the initial `offline` state — the shape every other test below builds on. */
function live(): SessionState {
  return sessionReducer(initialSessionState, { type: "subscribed" });
}

describe("sessionReducer (D5.11, spec-delve-stage.md §9 — the pure state machine, no transport)", () => {
  it("starts offline, nothing subscribed yet", () => {
    expect(initialSessionState).toEqual({ status: "offline", consecutiveTimeouts: 0, replayRemaining: 0 });
  });

  it("subscribing goes live and resets any prior counters", () => {
    expect(live()).toEqual({ status: "live", consecutiveTimeouts: 0, replayRemaining: 0 });
  });

  it("a player decision resets the consecutive-timeout count", () => {
    let state = live();
    state = sessionReducer(state, { type: "declared", source: "timeout" });
    state = sessionReducer(state, { type: "declared", source: "timeout" });
    expect(state.consecutiveTimeouts).toBe(2);
    state = sessionReducer(state, { type: "declared", source: "player" });
    expect(state).toEqual({ status: "live", consecutiveTimeouts: 0, replayRemaining: 0 });
  });

  it("Three_timeouts_freeze_and_say_so", () => {
    // Pins the mirrored constant itself to the real server value (BattleSessionRegistry.cs:67), so a
    // drift in the mirror is caught here rather than only shifting where the loop below happens to stop.
    expect(MAX_CONSECUTIVE_TIMEOUTS).toBe(3);

    let state = live();

    // MAX_CONSECUTIVE_TIMEOUTS mirrors BattleSessionRegistry.MaxConsecutiveTimeouts (= 3): the first
    // two consecutive timeouts must NOT freeze the fight — only the third does.
    for (let i = 0; i < MAX_CONSECUTIVE_TIMEOUTS - 1; i++) {
      state = sessionReducer(state, { type: "declared", source: "timeout" });
      expect(state.status).toBe("live");
    }
    expect(state.consecutiveTimeouts).toBe(MAX_CONSECUTIVE_TIMEOUTS - 1);

    // The THIRD consecutive timeout is the one that freezes.
    state = sessionReducer(state, { type: "declared", source: "timeout" });
    expect(state.status).toBe("frozen");
    expect(state.consecutiveTimeouts).toBe(MAX_CONSECUTIVE_TIMEOUTS);

    // "...and say so": §9's own quoted copy, read through the shared translation table
    // (`connectionState.ts`) rather than a second hardcoded string here.
    expect(connectionStatusLabel(state.status)).toBe("Your band is waiting.");

    // A frozen session takes no further decisions of its own — it is waiting on a resume, not still
    // ticking timeouts up in the background.
    const afterAnotherTimeout = sessionReducer(state, { type: "declared", source: "timeout" });
    expect(afterAnotherTimeout).toEqual(state);
  });

  it("a dropped connection freezes the fight exactly like the third timeout, and also says so", () => {
    const state = sessionReducer(live(), { type: "connection-dropped" });
    expect(state.status).toBe("frozen");
    expect(connectionStatusLabel(state.status)).toBe("Your band is waiting.");
  });

  it("Reconnect_replays_then_goes_live", () => {
    const frozen = sessionReducer(live(), { type: "connection-dropped" });

    const reconnecting = sessionReducer(frozen, { type: "reconnect-started" });
    expect(reconnecting.status).toBe("reconnecting");

    // The server hands back a recorded prefix of two decisions to replay before live input resumes.
    let state = sessionReducer(reconnecting, { type: "resumed", replayCount: 2 });
    expect(state).toEqual({ status: "reconnecting", consecutiveTimeouts: 0, replayRemaining: 2 });

    // Replaying is not yet live.
    state = sessionReducer(state, { type: "replay-consumed" });
    expect(state.status).toBe("reconnecting");
    expect(state.replayRemaining).toBe(1);

    // The prefix is now exhausted: the session goes live, matching
    // InteractiveIntentSource.ResumeReplayThenLive's own "replay, then ask" branch.
    state = sessionReducer(state, { type: "replay-consumed" });
    expect(state).toEqual({ status: "live", consecutiveTimeouts: 0, replayRemaining: 0 });
  });

  it("a resume with nothing recorded to replay goes straight live", () => {
    const frozen = sessionReducer(live(), { type: "connection-dropped" });
    const state = sessionReducer(frozen, { type: "resumed", replayCount: 0 });
    expect(state).toEqual({ status: "live", consecutiveTimeouts: 0, replayRemaining: 0 });
  });

  it("resumed refuses a negative replay count rather than silently misreporting progress", () => {
    expect(() => sessionReducer(live(), { type: "resumed", replayCount: -1 })).toThrow();
  });

  it("Closing_the_fight_panel_is_not_a_retreat", () => {
    // From live, from mid-timeout-count, and from frozen — closing the panel never changes any of it.
    const cases: SessionState[] = [
      live(),
      sessionReducer(live(), { type: "declared", source: "timeout" }),
      sessionReducer(live(), { type: "connection-dropped" })
    ];

    for (const before of cases) {
      const after = sessionReducer(before, { type: "panel-closed" });
      // Referential equality, not just deep equality: the reducer must not even allocate a new state
      // for this event, the strongest available proof nothing about the session was touched.
      expect(after).toBe(before);
    }
  });

  it("Leaving_the_stage_resolves_nothing", () => {
    const cases: SessionState[] = [
      live(),
      sessionReducer(live(), { type: "declared", source: "timeout" }),
      sessionReducer(live(), { type: "connection-dropped" }),
      sessionReducer(sessionReducer(live(), { type: "connection-dropped" }), {
        type: "resumed",
        replayCount: 3
      })
    ];

    for (const before of cases) {
      const after = sessionReducer(before, { type: "stage-left" });
      expect(after).toBe(before);
    }
  });
});
