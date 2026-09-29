import { describe, expect, it } from "vitest";
import { applyItems, applyStateChange, initialFeedState, resetForPlayer } from "./feedReducer";
import type { FeedState } from "./feedReducer";
import type { NotificationItem } from "../catalog";

function item(over: Partial<NotificationItem> & { seq: number; rev: number; dedupKey: string }): NotificationItem {
  return {
    category: "test.category",
    severity: "routine",
    sourceId: "test",
    messageKey: "test.key",
    args: [],
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

describe("feedReducer (notify-client spec §2, R-N5)", () => {
  it("resetForPlayer starts a fresh, empty, loading feed for the given save (F1/F3 key-set edge)", () => {
    const s = resetForPlayer(7);
    expect(s).toEqual({ playerId: 7, byKey: {}, maxRev: 0, status: "loading" });
  });

  it("applyItems dedups on dedupKey and keeps the higher rev regardless of order", () => {
    const base = resetForPlayer(1);
    const older = item({ seq: 1, rev: 5, dedupKey: "k1", state: "unread" });
    const newer = item({ seq: 1, rev: 9, dedupKey: "k1", state: "dismissed" });

    const a = applyItems(applyItems(base, [older], 1), [newer], 1);
    const b = applyItems(applyItems(base, [newer], 1), [older], 1);

    expect(Object.keys(a.byKey)).toEqual(["k1"]);
    expect(a.byKey.k1!.state).toBe("dismissed");
    expect(a.maxRev).toBe(9);
    expect(a).toEqual(b); // order-free (push-then-GET vs GET-then-push land the same)
  });

  it("applyItems ignores a batch for a save other than the one held (F7)", () => {
    const base = resetForPlayer(1);
    const result = applyItems(base, [item({ seq: 1, rev: 1, dedupKey: "k1" })], 2);
    expect(result).toBe(base);
  });

  it("applyItems sets status to ready", () => {
    const base: FeedState = { ...initialFeedState, playerId: 1, status: "loading" };
    const result = applyItems(base, [item({ seq: 1, rev: 1, dedupKey: "k1" })], 1);
    expect(result.status).toBe("ready");
  });

  it("applyStateChange updates a held item's state and rev, and bumps maxRev", () => {
    const withItem = applyItems(resetForPlayer(1), [item({ seq: 5, rev: 1, dedupKey: "k1", state: "unread" })], 1);
    const result = applyStateChange(withItem, { playerId: 1, state: "read", changes: [{ seq: 5, rev: 2 }] });
    expect(result.byKey.k1!.state).toBe("read");
    expect(result.byKey.k1!.rev).toBe(2);
    expect(result.maxRev).toBe(2);
  });

  it("applyStateChange for a seq never held drops the change and does not advance maxRev", () => {
    const base = resetForPlayer(1);
    const result = applyStateChange(base, { playerId: 1, state: "read", changes: [{ seq: 999, rev: 42 }] });
    expect(result).toEqual(base);
  });

  it("applyStateChange for another save is a no-op", () => {
    const withItem = applyItems(resetForPlayer(1), [item({ seq: 5, rev: 1, dedupKey: "k1" })], 1);
    const result = applyStateChange(withItem, { playerId: 2, state: "dismissed", changes: [{ seq: 5, rev: 2 }] });
    expect(result).toBe(withItem);
  });

  it("a page fetched before a dismiss and applied after its state-change event leaves the item dismissed", () => {
    const withItem = applyItems(resetForPlayer(1), [item({ seq: 5, rev: 1, dedupKey: "k1", state: "unread" })], 1);
    const afterDismiss = applyStateChange(withItem, { playerId: 1, state: "dismissed", changes: [{ seq: 5, rev: 2 }] });
    // The stale page result (still rev 1, unread) arrives after the dismiss's event — the higher
    // rev already held must win, so the row stays dismissed.
    const stalePage = applyItems(afterDismiss, [item({ seq: 5, rev: 1, dedupKey: "k1", state: "unread" })], 1);
    expect(stalePage.byKey.k1!.state).toBe("dismissed");
    expect(stalePage.byKey.k1!.rev).toBe(2);
  });
});
