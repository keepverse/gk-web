import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { railItemsFrom } from "./railItems";
import { worldLatestTurn } from "./mountPolicies";
import { clearChannelSettingsForTests, setChannel } from "../channelSettings";
import { initialFeedState } from "../feed/feedReducer";
import type { FeedItem, FeedState } from "../feed/feedReducer";

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

function item(over: Partial<FeedItem> & { dedupKey: string }): FeedItem {
  return {
    seq: 1,
    rev: 1,
    category: "railItems.test.category",
    severity: "routine",
    sourceId: "test",
    messageKey: "test.key",
    args: [],
    state: "unread",
    worldId: "w1",
    worldTurn: 5,
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

function feedWith(items: FeedItem[]): FeedState {
  const byKey: Record<string, FeedItem> = {};
  for (const i of items) byKey[i.dedupKey] = i;
  return { ...initialFeedState, playerId: 1, byKey, status: "ready" };
}

const ctx = { worldId: "w1", lastResolvedTurn: 5 };

describe("railItemsFrom (notify-client spec §5)", () => {
  afterEach(() => clearChannelSettingsForTests());

  it("maps server unread/read/dismissed onto unread/opened/dismissed", () => {
    setChannel("railItems.test.category", "rail");
    const feed = feedWith([
      item({ dedupKey: "a", state: "unread" }),
      item({ dedupKey: "b", state: "read" }),
      item({ dedupKey: "c", state: "dismissed" })
    ]);
    const byId = Object.fromEntries(railItemsFrom(feed, worldLatestTurn, ctx).map((i) => [i.id, i.state]));
    expect(byId).toEqual({ a: "unread", b: "opened", c: "dismissed" });
  });

  it("excludes categories whose channel is off", () => {
    setChannel("railItems.test.category", "off");
    const feed = feedWith([item({ dedupKey: "a" })]);
    expect(railItemsFrom(feed, worldLatestTurn, ctx)).toHaveLength(0);
  });

  it("a minimized category maps to state minimized, overriding the server state", () => {
    setChannel("railItems.test.category", "rail");
    const feed = feedWith([item({ dedupKey: "a", state: "unread" })]);
    const result = railItemsFrom(feed, worldLatestTurn, ctx, new Set(["railItems.test.category"]));
    expect(result[0]!.state).toBe("minimized");
  });

  it("blocking is always false in v1 (no source sets it yet)", () => {
    setChannel("railItems.test.category", "rail");
    const feed = feedWith([item({ dedupKey: "a" })]);
    expect(railItemsFrom(feed, worldLatestTurn, ctx)[0]!.blocking).toBe(false);
  });

  it("applies the mount policy — an item from a different turn is excluded", () => {
    setChannel("railItems.test.category", "rail");
    const feed = feedWith([item({ dedupKey: "old", worldTurn: 4 }), item({ dedupKey: "new", worldTurn: 5 })]);
    const ids = railItemsFrom(feed, worldLatestTurn, ctx).map((i) => i.id);
    expect(ids).toEqual(["new"]);
  });
});
