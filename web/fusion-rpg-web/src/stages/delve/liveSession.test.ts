import type { HubConnection } from "@microsoft/signalr";
import { describe, expect, it, vi } from "vitest";
import {
  declareDelveAction,
  steerDelveParty,
  subscribeDelveLiveSession,
  type DelveTurnStarted
} from "./liveSession";
import type { SessionEvent } from "./session";

/**
 * A fake `HubConnection` — no real network, no live server, matching this program's own
 * `DelveBattleSessionManagerTests.RecordingPush` precedent for testing a push seam without a mocking
 * library. Records every registered handler by event name (so a test can `emit` a push directly) and
 * every `invoke` call (so `steerDelveParty`/`declareDelveAction` can be asserted against real arguments).
 */
function fakeConnection() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  const invoke = vi.fn((..._args: unknown[]) => Promise.resolve(true));

  const conn = {
    on(event: string, callback: (payload: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(callback);
    },
    off(event: string, callback: (payload: unknown) => void) {
      handlers.get(event)?.delete(callback);
    },
    invoke
  } as unknown as HubConnection;

  const emit = (event: string, payload: unknown) => {
    for (const cb of handlers.get(event) ?? []) cb(payload);
  };

  const listenerCount = (event: string) => handlers.get(event)?.size ?? 0;

  return { conn, emit, invoke, listenerCount };
}

describe("subscribeDelveLiveSession (D5.11's live-push wave, 2026-09-08)", () => {
  it("dispatches subscribed synchronously, before any push arrives", () => {
    const { conn } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);
    expect(events).toEqual([{ type: "subscribed" }]);
  });

  it("DelveDeclared for this matchKey dispatches declared with the real source", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    emit("DelveDeclared", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", source: "player" });
    emit("DelveDeclared", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:1", source: "timeout" });

    expect(events).toEqual([
      { type: "subscribed" },
      { type: "declared", source: "player" },
      { type: "declared", source: "timeout" }
    ]);
  });

  it("a push for a DIFFERENT matchKey is ignored — one connection can carry several fights", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    emit("DelveDeclared", { matchKey: "delve-2-0-0-p0", actorKey: "squad:p0:0", source: "player" });
    emit("DelveFightFrozen", { matchKey: "delve-2-0-0-p0", delveId: 2, partyIndex: 0 });
    emit("DelveResumed", { matchKey: "delve-2-0-0-p0", replayCount: 3 });
    emit("DelveReplayConsumed", { matchKey: "delve-2-0-0-p0" });

    expect(events).toEqual([{ type: "subscribed" }]); // nothing else landed
  });

  it("DelveFightFrozen maps to connection-dropped", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    emit("DelveFightFrozen", { matchKey: "delve-1-0-0-p0", delveId: 1, partyIndex: 0 });

    expect(events).toEqual([{ type: "subscribed" }, { type: "connection-dropped" }]);
  });

  it("DelveResumed carries its replayCount through untouched", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    emit("DelveResumed", { matchKey: "delve-1-0-0-p0", replayCount: 4 });

    expect(events).toEqual([{ type: "subscribed" }, { type: "resumed", replayCount: 4 }]);
  });

  it("DelveReplayConsumed maps to replay-consumed, once per push", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    emit("DelveReplayConsumed", { matchKey: "delve-1-0-0-p0" });
    emit("DelveReplayConsumed", { matchKey: "delve-1-0-0-p0" });

    expect(events.filter(e => e.type === "replay-consumed")).toHaveLength(2);
  });

  it("DelveTurnStarted calls onTurnStarted, not dispatch — it is not a SessionEvent", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    const turns: DelveTurnStarted[] = [];
    subscribeDelveLiveSession(
      "delve-1-0-0-p0",
      { dispatch: e => events.push(e), onTurnStarted: t => turns.push(t) },
      conn
    );

    emit("DelveTurnStarted", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", dwellMs: 1500 });

    expect(events).toEqual([{ type: "subscribed" }]); // no SessionEvent for this
    expect(turns).toEqual([{ matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", dwellMs: 1500 }]);
  });

  it("DelveTurnStarted is a no-op when onTurnStarted was not supplied", () => {
    const { conn, emit } = fakeConnection();
    const events: SessionEvent[] = [];
    // No onTurnStarted handler passed at all -- must not throw.
    expect(() => {
      subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);
      emit("DelveTurnStarted", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", dwellMs: 1500 });
    }).not.toThrow();
  });

  it("the returned unsubscribe function removes every listener this call registered", () => {
    const { conn, emit, listenerCount } = fakeConnection();
    const events: SessionEvent[] = [];
    const unsubscribe = subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => events.push(e) }, conn);

    expect(listenerCount("DelveDeclared")).toBe(1);
    expect(listenerCount("DelveFightFrozen")).toBe(1);
    expect(listenerCount("DelveResumed")).toBe(1);
    expect(listenerCount("DelveReplayConsumed")).toBe(1);
    expect(listenerCount("DelveTurnStarted")).toBe(1);

    unsubscribe();

    expect(listenerCount("DelveDeclared")).toBe(0);
    expect(listenerCount("DelveFightFrozen")).toBe(0);
    expect(listenerCount("DelveResumed")).toBe(0);
    expect(listenerCount("DelveReplayConsumed")).toBe(0);
    expect(listenerCount("DelveTurnStarted")).toBe(0);

    // A push after unsubscribe must not reach the (now-stale) dispatch.
    events.length = 0;
    emit("DelveDeclared", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", source: "player" });
    expect(events).toEqual([]);
  });

  it("two independently-subscribed fights on the same connection do not cross-talk", () => {
    const { conn, emit } = fakeConnection();
    const eventsA: SessionEvent[] = [];
    const eventsB: SessionEvent[] = [];
    subscribeDelveLiveSession("delve-1-0-0-p0", { dispatch: e => eventsA.push(e) }, conn);
    subscribeDelveLiveSession("delve-1-0-0-p1", { dispatch: e => eventsB.push(e) }, conn);

    emit("DelveDeclared", { matchKey: "delve-1-0-0-p0", actorKey: "squad:p0:0", source: "player" });
    emit("DelveDeclared", { matchKey: "delve-1-0-0-p1", actorKey: "squad:p1:0", source: "timeout" });

    expect(eventsA).toEqual([{ type: "subscribed" }, { type: "declared", source: "player" }]);
    expect(eventsB).toEqual([{ type: "subscribed" }, { type: "declared", source: "timeout" }]);
  });
});

describe("steerDelveParty / declareDelveAction (RpgHub.cs's real Steer/Declare calls)", () => {
  it("steerDelveParty invokes Steer with delveId/from/to in order", async () => {
    const { conn, invoke } = fakeConnection();
    await steerDelveParty(7, 0, 1, conn);
    expect(invoke).toHaveBeenCalledWith("Steer", 7, 0, 1);
  });

  it("steerDelveParty passes null through for 'to none'", async () => {
    const { conn, invoke } = fakeConnection();
    await steerDelveParty(7, 0, null, conn);
    expect(invoke).toHaveBeenCalledWith("Steer", 7, 0, null);
  });

  it("declareDelveAction invokes Declare with matchKey/actorKey/actionId/targetKey and returns its result", async () => {
    const { conn, invoke } = fakeConnection();
    invoke.mockResolvedValueOnce(true);
    const ok = await declareDelveAction("delve-1-0-0-p0", "squad:p0:0", "act.attack", "wave:0", conn);
    expect(invoke).toHaveBeenCalledWith("Declare", "delve-1-0-0-p0", "squad:p0:0", "act.attack", "wave:0");
    expect(ok).toBe(true);
  });

  it("declareDelveAction surfaces a false (stale/misdirected declare) rather than inventing success", async () => {
    const { conn, invoke } = fakeConnection();
    invoke.mockResolvedValueOnce(false);
    const ok = await declareDelveAction("delve-1-0-0-p0", "squad:p0:0", "act.attack", null, conn);
    expect(ok).toBe(false);
  });
});
