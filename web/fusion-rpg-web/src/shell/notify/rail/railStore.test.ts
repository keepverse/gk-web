import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dismiss, minimizeCategory, open, type RailItem } from "./railStore";
import { worldLatestTurn } from "./mountPolicies";
import type { FeedItem } from "../feed/feedReducer";

function item(overrides: Partial<RailItem> = {}): RailItem {
  return {
    id: "r-1",
    dedupKey: "r-1",
    seq: 1,
    category: "growth",
    severity: "routine",
    title: "Ash Waste grew a rootbed",
    body: "",
    state: "unread",
    worldId: "w1",
    worldTurn: 4,
    blocking: false,
    ...overrides
  };
}

describe("railStore — the item transitions (world-stage W87/W88, moved by world-notify-source §4)", () => {
  it("dismissing marks an item dismissed rather than erasing it — removed from the rail, not the record", () => {
    const items = [item({ id: "a" })];
    const after = dismiss(items, "a");
    expect(after).toHaveLength(1);
    expect(after[0]!.state).toBe("dismissed");
  });

  it("a blocker cannot be dismissed", () => {
    const items = [item({ id: "a", blocking: true, state: "blocking" })];
    const after = dismiss(items, "a");
    expect(after[0]!.state).toBe("blocking");
  });

  it("opening clears unread without dismissing", () => {
    const items = [item({ id: "a", state: "unread" })];
    const after = open(items, "a");
    expect(after[0]!.state).toBe("opened");
  });

  it("minimizeCategory routes a whole category, never touching a blocker in it", () => {
    const items = [
      item({ id: "a", category: "growth", state: "unread" }),
      item({ id: "b", category: "growth", blocking: true, state: "blocking" }),
      item({ id: "c", category: "intel.new", state: "unread" })
    ];
    const after = minimizeCategory(items, "growth");
    expect(after.find((i) => i.id === "a")!.state).toBe("minimized");
    expect(after.find((i) => i.id === "b")!.state).toBe("blocking");
    expect(after.find((i) => i.id === "c")!.state).toBe("unread");
  });

  it("the store is pure — no React import, no fetch", () => {
    const source = readFileSync(join(__dirname, "railStore.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']react["']/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});

/**
 * world-notify-source §4: `flush`/`onCommit` are RETIRED — the End Turn flush's intent is the mount
 * policy's filter now (`notify-client` §6), so it survives a reload and needs no commit wiring.
 * Proving it here is what makes the retirement a change rather than a deletion.
 */
describe("the End Turn flush is the mount policy, not a store function", () => {
  function feedItem(over: Partial<FeedItem> & { dedupKey: string }): FeedItem {
    return {
      seq: 1,
      rev: 1,
      category: "growth",
      severity: "routine",
      sourceId: "test",
      messageKey: "test.key",
      args: [],
      state: "unread",
      worldId: "w1",
      worldTurn: 4,
      createdUtc: "2026-01-01T00:00:00Z",
      ...over
    };
  }

  it("includes only the most recently resolved turn of that world — the bound, as a filter", () => {
    const ctx = { worldId: "w1", lastResolvedTurn: 5 };
    expect(worldLatestTurn.includes(feedItem({ dedupKey: "older", worldTurn: 4 }), ctx)).toBe(false);
    expect(worldLatestTurn.includes(feedItem({ dedupKey: "this-turn", worldTurn: 5 }), ctx)).toBe(true);
    // Another world's rows are not this rail's business, even on the same turn.
    expect(worldLatestTurn.includes(feedItem({ dedupKey: "other-world", worldId: "w2", worldTurn: 5 }), ctx)).toBe(false);
  });

  it("no commit wiring: the bound moves only when `lastResolvedTurn` moves, so a non-advancing commit changes nothing", () => {
    const ctx = { worldId: "w1", lastResolvedTurn: 5 };
    const rows = [feedItem({ dedupKey: "this-turn", worldTurn: 5 }), feedItem({ dedupKey: "older", worldTurn: 4 })];

    const before = rows.filter((r) => worldLatestTurn.includes(r, ctx)).map((r) => r.dedupKey);
    // The older row flushes by becoming out of range, never by an interaction: 0 clicks per item.
    const afterAdvance = rows
      .filter((r) => worldLatestTurn.includes(r, { ...ctx, lastResolvedTurn: 6 }))
      .map((r) => r.dedupKey);

    expect(before).toEqual(["this-turn"]);
    expect(afterAdvance).toEqual([]);
  });

  it("the store exports no flush and no onCommit", async () => {
    const store = await import("./railStore");
    expect(Object.keys(store)).not.toContain("flush");
    expect(Object.keys(store)).not.toContain("onCommit");
  });
});
