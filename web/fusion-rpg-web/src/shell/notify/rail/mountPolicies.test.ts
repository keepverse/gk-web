import { describe, expect, it } from "vitest";
import { worldLatestTurn } from "./mountPolicies";
import type { FeedItem } from "../feed/feedReducer";

function item(over: Partial<FeedItem> & { dedupKey: string }): FeedItem {
  return {
    seq: 1,
    rev: 1,
    category: "world.test",
    severity: "routine",
    sourceId: "test",
    messageKey: "test.key",
    args: [],
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

describe("worldLatestTurn (notify-client spec §6, ported spec-world-notify.md flush tests)", () => {
  it("selects only items from the world's most recently resolved turn, not an older turn", () => {
    const ctx = { worldId: "w1", lastResolvedTurn: 5 };
    const rMinus1 = item({ dedupKey: "old", worldId: "w1", worldTurn: 4 });
    const r = item({ dedupKey: "new", worldId: "w1", worldTurn: 5 });
    expect(worldLatestTurn.includes(rMinus1, ctx)).toBe(false);
    expect(worldLatestTurn.includes(r, ctx)).toBe(true);
  });

  it("excludes items from a different world entirely", () => {
    const ctx = { worldId: "w1", lastResolvedTurn: 5 };
    expect(worldLatestTurn.includes(item({ dedupKey: "x", worldId: "w2", worldTurn: 5 }), ctx)).toBe(false);
  });

  it("a non-advancing commit (unchanged lastResolvedTurn) leaves the selection the same", () => {
    const ctxBefore = { worldId: "w1", lastResolvedTurn: 5 };
    const ctxAfterNonAdvance = { worldId: "w1", lastResolvedTurn: 5 }; // same currentTurn -> same context
    const r = item({ dedupKey: "r", worldId: "w1", worldTurn: 5 });
    expect(worldLatestTurn.includes(r, ctxBefore)).toBe(worldLatestTurn.includes(r, ctxAfterNonAdvance));
  });
});
