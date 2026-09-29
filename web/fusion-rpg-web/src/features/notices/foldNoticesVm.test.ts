import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { foldNoticesVm, type NoticesInput } from "./foldNoticesVm";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";
import { clearTargetActionResolversForTests } from "@/shell/notify/targetActions";
import type { NotificationItem } from "@/shell/notify/catalog";

// This environment's default window.localStorage is incomplete (channelSettings.test.ts's own
// note) — stub a real in-memory Storage before each test (renderNotification never reads it
// directly, but resolveTargetAction/registerTargetActionResolver do not either; kept for parity
// with every other notify test file so a future dependency does not silently break here).
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

afterEach(() => {
  clearChannelSettingsForTests();
  clearTargetActionResolversForTests();
});

function item(over: Partial<NotificationItem> & { seq: number; dedupKey: string; category: string }): NotificationItem {
  return {
    rev: over.seq,
    severity: "routine",
    sourceId: "test",
    messageKey: "test.key",
    args: [],
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

const CATALOG = {
  categories: [
    { id: "growth", displayName: "Growth" },
    { id: "supply.change", displayName: "Supply status" },
    { id: "silenced.category", displayName: "Silenced" }
  ]
};

function baseInput(over: Partial<NoticesInput> = {}): NoticesInput {
  return {
    selected: null,
    catalog: CATALOG,
    channels: { growth: "rail", "supply.change": "toast", "silenced.category": "off" },
    feed: { byKey: {} },
    history: [],
    ...over
  };
}

describe("foldNoticesVm (notify-centre spec §2 step 4, Testing 1)", () => {
  it("lists every registered category, including one with zero rows and one routed off", () => {
    const vm = foldNoticesVm(baseInput());
    expect(vm.categories.map((c) => c.id)).toEqual(["growth", "supply.change", "silenced.category"]);
    const silenced = vm.categories.find((c) => c.id === "silenced.category")!;
    expect(silenced.channel).toBe("off");
    expect(silenced.unread).toBe(0);
  });

  it("selects the first category when nothing was ever chosen", () => {
    const vm = foldNoticesVm(baseInput());
    expect(vm.selected).toBe("growth");
  });

  it("respects an explicit selection", () => {
    const vm = foldNoticesVm(baseInput({ selected: "supply.change" }));
    expect(vm.selected).toBe("supply.change");
  });

  it("counts unread per category from the live feed", () => {
    const vm = foldNoticesVm(
      baseInput({
        feed: {
          byKey: {
            a: item({ seq: 1, dedupKey: "a", category: "growth", state: "unread" }),
            b: item({ seq: 2, dedupKey: "b", category: "growth", state: "read" }),
            c: item({ seq: 3, dedupKey: "c", category: "supply.change", state: "unread" })
          }
        }
      })
    );
    expect(vm.categories.find((c) => c.id === "growth")!.unread).toBe(1);
    expect(vm.categories.find((c) => c.id === "supply.change")!.unread).toBe(1);
  });

  it("rows are newest first (seq desc)", () => {
    const vm = foldNoticesVm(
      baseInput({
        selected: "growth",
        history: [
          item({ seq: 1, dedupKey: "a", category: "growth" }),
          item({ seq: 3, dedupKey: "c", category: "growth" }),
          item({ seq: 2, dedupKey: "b", category: "growth" })
        ]
      })
    );
    expect(vm.rows.map((r) => r.seq)).toEqual([3, 2, 1]);
  });

  it("every row's text comes from renderNotification, and no id appears in it", () => {
    const vm = foldNoticesVm(
      baseInput({
        selected: "growth",
        history: [
          item({
            seq: 1,
            dedupKey: "a",
            category: "growth",
            messageKey: "world.turn-entry",
            args: [
              {
                name: "entry",
                kind: "domainToken",
                value: { kind: "event", subject: "s-x", detail: "growth.pulse:3", sectorId: "s-x" }
              }
            ]
          })
        ]
      })
    );
    expect(vm.rows[0]!.title.length).toBeGreaterThan(0);
    expect(vm.rows[0]!.body.length).toBeGreaterThan(0);
    expect(vm.rows[0]!.title).not.toContain("growth");
    expect(vm.rows[0]!.body).not.toContain("growth");
  });

  it("only rows of the selected category are returned", () => {
    const vm = foldNoticesVm(
      baseInput({
        selected: "growth",
        history: [
          item({ seq: 1, dedupKey: "a", category: "growth" }),
          item({ seq: 2, dedupKey: "b", category: "supply.change" })
        ]
      })
    );
    expect(vm.rows.map((r) => r.dedupKey)).toEqual(["a"]);
  });

  it("merges the live feed with history, deduped on dedupKey, the higher rev winning", () => {
    const stale = item({ seq: 1, dedupKey: "a", category: "growth", rev: 1, state: "unread" });
    const fresh = item({ seq: 1, dedupKey: "a", category: "growth", rev: 2, state: "dismissed" });
    const vm = foldNoticesVm(
      baseInput({
        selected: "growth",
        history: [stale],
        feed: { byKey: { a: fresh } }
      })
    );
    expect(vm.rows).toHaveLength(1);
    expect(vm.rows[0]!.state).toBe("dismissed");
  });

  it("no category registered means no selection and no rows", () => {
    const vm = foldNoticesVm(baseInput({ catalog: { categories: [] } }));
    expect(vm.selected).toBeNull();
    expect(vm.rows).toEqual([]);
  });
});
