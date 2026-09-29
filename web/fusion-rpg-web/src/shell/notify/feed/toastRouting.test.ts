import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeLiveBatchToToasts } from "./toastRouting";
import { clearChannelSettingsForTests, setChannel } from "../channelSettings";
import { useToastStack } from "@/shell/toastStack";
import type { NotificationItem } from "../catalog";
import type { FeedState } from "./feedReducer";

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

function item(over: Partial<NotificationItem> & { dedupKey: string }): NotificationItem {
  return {
    seq: 1,
    rev: 1,
    category: "toastRouting.test.category",
    severity: "routine",
    sourceId: "test",
    messageKey: "test.key",
    args: [],
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

const emptyFeed: Pick<FeedState, "byKey"> = { byKey: {} };

describe("routeLiveBatchToToasts (notify-client spec §4)", () => {
  afterEach(() => {
    clearChannelSettingsForTests();
    useToastStack.getState().clear();
  });

  it("a category set to off never toasts, Critical included", () => {
    setChannel("toastRouting.test.category", "off");
    routeLiveBatchToToasts([item({ dedupKey: "k1", severity: "critical" })], emptyFeed);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("a category set to rail never toasts", () => {
    setChannel("toastRouting.test.category", "rail");
    routeLiveBatchToToasts([item({ dedupKey: "k1" })], emptyFeed);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("a category set to toast pushes one toast, with severity carried through", () => {
    setChannel("toastRouting.test.category", "toast");
    routeLiveBatchToToasts([item({ dedupKey: "k1", severity: "important" })], emptyFeed);
    const toasts = useToastStack.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.severity).toBe("important");
    expect(toasts[0]!.category).toBe("toastRouting.test.category");
  });

  it("an item already held in the feed before this batch does not re-toast", () => {
    setChannel("toastRouting.test.category", "toast");
    const feedWithItem: Pick<FeedState, "byKey"> = {
      byKey: { k1: item({ dedupKey: "k1" }) }
    };
    routeLiveBatchToToasts([item({ dedupKey: "k1" })], feedWithItem);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("of a mixed batch, only the not-yet-held item toasts", () => {
    setChannel("toastRouting.test.category", "toast");
    const feedWithOne: Pick<FeedState, "byKey"> = {
      byKey: { held: item({ dedupKey: "held" }) }
    };
    routeLiveBatchToToasts(
      [item({ dedupKey: "held" }), item({ dedupKey: "fresh" })],
      feedWithOne
    );
    expect(useToastStack.getState().toasts).toHaveLength(1);
  });
});
