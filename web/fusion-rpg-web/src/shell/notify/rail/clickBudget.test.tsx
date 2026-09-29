import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toasts } from "@/shell/Toasts";
import { useToastStack } from "@/shell/toastStack";
import { NotifyRail } from "./NotifyRail";
import type { RailItem } from "./railStore";
import { railItemsFrom } from "./railItems";
import { worldLatestTurn } from "./mountPolicies";
import type { FeedItem, FeedState } from "@/shell/notify/feed/feedReducer";
import { initialFeedState } from "@/shell/notify/feed/feedReducer";
import { ChannelControl } from "./ChannelControl";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";

/**
 * world-stage W89 (spec-world-notify.md §7) — the per-turn click budget, counted rather than
 * asserted in prose, against Endless Legend's own audited four-clicks-per-notification. Each row
 * exercises the pieces W84-88 already built directly (`NotifyRail`/`Toasts`/`ChannelControl`) —
 * there is no keyframe→category translator yet (that is `world-playback`'s own table, unmodified by
 * this program so far), so the fixtures here are hand-built rail items and toasts standing in for
 * what a real turn would eventually produce, not a live-translated report.
 */

// This environment's default window.localStorage is incomplete — stub a real in-memory Storage.
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
  useToastStack.getState().clear();
});

afterEach(() => {
  clearChannelSettingsForTests();
});

const noop = () => {};

/** A feed row for the two "0 clicks" rows: the bound these assert is the mount policy's filter. */
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

function feedWith(items: FeedItem[]): FeedState {
  const byKey: Record<string, FeedItem> = {};
  for (const i of items) byKey[i.dedupKey] = i;
  return { ...initialFeedState, playerId: 1, byKey, status: "ready" };
}

describe("The per-turn click budget (world-stage W89, spec §7)", () => {
  it("row 1: acknowledging one routine event costs 0 clicks — the turn's own bound retires it", () => {
    // The turn ending is the one action the whole feed rides on: the mount policy shows only the
    // most recently resolved turn, so no per-item interaction is ever needed (the retired
    // `onCommit` flush is this filter now — world-notify-source §4).
    const feed = feedWith([feedItem({ dedupKey: "r-1", category: "growth", worldTurn: 4 })]);
    expect(railItemsFrom(feed, worldLatestTurn, { worldId: "w1", lastResolvedTurn: 4 })).toHaveLength(1);
    expect(railItemsFrom(feed, worldLatestTurn, { worldId: "w1", lastResolvedTurn: 5 })).toHaveLength(0);
  });

  it("row 2: acting on one important event costs 1 click — the toast's own action button", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    useToastStack.getState().push({
      tone: "warn",
      title: "Ash Waste will release next turn",
      category: "loam.release",
      action: { label: "View sector", run }
    });
    render(<Toasts />);

    await user.click(screen.getByTestId("toast-action")); // exactly one interaction
    expect(run).toHaveBeenCalledTimes(1);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("row 3: clearing a feed of several items costs 0 per-item clicks — one resolved turn ends them all", () => {
    const feed = feedWith([
      feedItem({ dedupKey: "a", category: "growth", worldTurn: 4 }),
      feedItem({ dedupKey: "b", category: "intel.new", worldTurn: 4, state: "read" }),
      feedItem({ dedupKey: "c", category: "supply.change", worldTurn: 4 })
    ]);
    expect(railItemsFrom(feed, worldLatestTurn, { worldId: "w1", lastResolvedTurn: 4 }).map((i) => i.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
    // Zero calls to `dismiss`, and no End Turn button: the next resolved turn is out of range.
    expect(railItemsFrom(feed, worldLatestTurn, { worldId: "w1", lastResolvedTurn: 5 })).toEqual([]);
  });

  it("row 4: changing how a category notifies costs 1 click — on the notification that annoyed you", async () => {
    const user = userEvent.setup();
    render(
      <>
        <NotifyRail
          items={[
            {
              id: "r-1",
              dedupKey: "r-1",
              seq: 1,
              category: "battle.result",
              severity: "routine",
              title: "A skirmish resolved",
              body: "",
              state: "opened",
              worldId: "w1",
              worldTurn: 4,
              blocking: false
            }
          ]}
          onOpen={noop}
          onDismiss={noop}
          onUndoDismiss={noop}
        />
        {/* Settings-list stand-in, reading the same store as the notification above. */}
        <ChannelControl category="battle.result" />
      </>
    );

    await user.click(screen.getAllByRole("button", { name: "Toast" })[0]!); // exactly one interaction

    for (const button of screen.getAllByRole("button", { name: "Toast" })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }
  });
});
