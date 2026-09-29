import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useToastStack } from "@/shell/toastStack";
import { clearChannelSettingsForTests, setChannel } from "./channelSettings";
import { resetNotificationFeedForTests, useNotificationFeed } from "./feed/feedStore";

// This environment's default window.localStorage is incomplete (channelSettings.test.ts's own
// note) — stub a real in-memory Storage before each test so setChannel/channelFor round-trip.
beforeEach(() => {
  const mem: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
});

const playerJoinedListeners: ((id: number) => void)[] = [];
const batchListeners: ((batch: unknown) => void)[] = [];
const stateChangedListeners: ((event: unknown) => void)[] = [];
let fetchImpl: (playerId: number, since: number) => Promise<{ items: unknown[]; nextSince: number; hasMore: boolean }> =
  async (_playerId, since) => ({ items: [], nextSince: since, hasMore: false });

vi.mock("@/lib/bus/playerRouting", () => ({
  subscribePlayerJoined: (fn: (id: number) => void) => {
    playerJoinedListeners.push(fn);
    return () => {
      const i = playerJoinedListeners.indexOf(fn);
      if (i >= 0) playerJoinedListeners.splice(i, 1);
    };
  }
}));

vi.mock("@/lib/bus/notifications", () => ({
  subscribeNotificationBatch: (fn: (b: unknown) => void) => {
    batchListeners.push(fn);
    return () => {
      const i = batchListeners.indexOf(fn);
      if (i >= 0) batchListeners.splice(i, 1);
    };
  },
  subscribeNotificationStateChanged: (fn: (e: unknown) => void) => {
    stateChangedListeners.push(fn);
    return () => {
      const i = stateChangedListeners.indexOf(fn);
      if (i >= 0) stateChangedListeners.splice(i, 1);
    };
  },
  fetchNotificationsSince: (playerId: number, since: number) => fetchImpl(playerId, since)
}));

import { NotificationWire, retryNotificationCatchUp } from "./NotificationWire";

function emitPlayerJoined(id: number): void {
  for (const fn of [...playerJoinedListeners]) fn(id);
}

function emitBatch(batch: unknown): void {
  for (const fn of [...batchListeners]) fn(batch);
}

function emitStateChanged(event: unknown): void {
  for (const fn of [...stateChangedListeners]) fn(event);
}

function item(over: Record<string, unknown> & { dedupKey: string }) {
  return {
    seq: 1,
    rev: 1,
    category: "wire.test.category",
    severity: "routine",
    sourceId: "s",
    messageKey: "m",
    args: [],
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("NotificationWire (notify-client spec §2, F1-F7)", () => {
  afterEach(() => {
    playerJoinedListeners.length = 0;
    batchListeners.length = 0;
    stateChangedListeners.length = 0;
    fetchImpl = async (_playerId, since) => ({ items: [], nextSince: since, hasMore: false });
    resetNotificationFeedForTests();
    clearChannelSettingsForTests();
    useToastStack.getState().clear();
  });

  it("F1: player-joined resets and pages the catch-up GET from 0", async () => {
    fetchImpl = async () => ({ items: [item({ dedupKey: "a", seq: 1, rev: 5 })], nextSince: 5, hasMore: false });
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();

    const s = useNotificationFeed.getState();
    expect(s.playerId).toBe(1);
    expect(s.maxRev).toBe(5);
    expect(Object.keys(s.byKey)).toEqual(["a"]);
  });

  it("F2: a reconnect (player-joined again for the same id) pages from maxRev, without resetting held items", async () => {
    fetchImpl = async () => ({ items: [item({ dedupKey: "a", seq: 1, rev: 5 })], nextSince: 5, hasMore: false });
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();

    fetchImpl = async (_playerId, since) => {
      expect(since).toBe(5); // continues from the cursor, not 0
      return { items: [item({ dedupKey: "b", seq: 2, rev: 6 })], nextSince: 6, hasMore: false };
    };
    emitPlayerJoined(1);
    await flush();

    const s = useNotificationFeed.getState();
    expect(Object.keys(s.byKey).sort()).toEqual(["a", "b"]); // the old item was NOT reset away
  });

  it("F3: a save switch (a different id) drops the old save's items before the new catch-up lands", async () => {
    fetchImpl = async () => ({ items: [item({ dedupKey: "a" })], nextSince: 5, hasMore: false });
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();
    expect(Object.keys(useNotificationFeed.getState().byKey)).toEqual(["a"]);

    fetchImpl = async (playerId, since) => {
      expect(since).toBe(0); // reset, not continued from the old save's cursor
      return { items: [item({ dedupKey: "c" })], nextSince: 9, hasMore: false };
    };
    emitPlayerJoined(2);
    await flush();

    const s = useNotificationFeed.getState();
    expect(s.playerId).toBe(2);
    expect(Object.keys(s.byKey)).toEqual(["c"]); // "a" is gone
  });

  it("F4: a live batch is applied to the feed and toasts (channel = toast)", async () => {
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();
    setChannel("wire.test.category", "toast");

    emitBatch({ playerId: 1, delivery: "live", items: [item({ dedupKey: "live1" })] });

    expect(useNotificationFeed.getState().byKey.live1).toBeDefined();
    expect(useToastStack.getState().toasts).toHaveLength(1);
  });

  it("F4b: a catchUp-delivery batch is applied to the feed but never toasts", async () => {
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();
    setChannel("wire.test.category", "toast");

    emitBatch({ playerId: 1, delivery: "catchUp", items: [item({ dedupKey: "cu1" })] });

    expect(useNotificationFeed.getState().byKey.cu1).toBeDefined();
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("F7: a batch for a save other than the one shown is ignored", async () => {
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();

    emitBatch({ playerId: 999, delivery: "live", items: [item({ dedupKey: "other" })] });

    expect(useNotificationFeed.getState().byKey.other).toBeUndefined();
  });

  it("F5: a pushed state change applies to a held item", async () => {
    fetchImpl = async () => ({ items: [item({ dedupKey: "a", seq: 1, rev: 1 })], nextSince: 1, hasMore: false });
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();

    emitStateChanged({ playerId: 1, state: "dismissed", changes: [{ seq: 1, rev: 2 }] });

    expect(useNotificationFeed.getState().byKey.a!.state).toBe("dismissed");
  });

  it("a failed catch-up sets status to error, never leaving the feed silently empty-looking as ready", async () => {
    fetchImpl = async () => {
      throw new Error("network down");
    };
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();

    expect(useNotificationFeed.getState().status).toBe("error");
  });

  it("retryNotificationCatchUp re-attempts from the last known cursor and can clear the error", async () => {
    fetchImpl = async () => {
      throw new Error("down");
    };
    render(<NotificationWire />);
    emitPlayerJoined(1);
    await flush();
    expect(useNotificationFeed.getState().status).toBe("error");

    fetchImpl = async () => ({ items: [item({ dedupKey: "recovered" })], nextSince: 3, hasMore: false });
    retryNotificationCatchUp();
    await flush();

    expect(useNotificationFeed.getState().status).toBe("ready");
    expect(useNotificationFeed.getState().byKey.recovered).toBeDefined();
  });

  it("retryNotificationCatchUp is a no-op before any player has joined", async () => {
    render(<NotificationWire />);
    retryNotificationCatchUp();
    await flush();
    expect(useNotificationFeed.getState().playerId).toBeNull();
  });
});
