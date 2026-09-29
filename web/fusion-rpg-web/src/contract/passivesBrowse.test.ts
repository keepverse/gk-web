import { describe, expect, it } from "vitest";
import type { TreeResolveReport } from "@/lib/bus";
import {
  bucketFor,
  filterPathBrowse,
  gatelessCount,
  gatelessPaths,
  isSpeciesTree,
  orderPathBrowse
} from "./passivesBrowse";

function tree(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "might",
    category: "Primary",
    gateState: "wired",
    tierReached: 0,
    tiers: 10,
    aptitudePoints: 0,
    contributingNodeIds: [],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 0,
    focusMilli: 1000,
    excludedNodes: [],
    ...overrides
  };
}

describe("bucketFor", () => {
  it("invested wins over every other signal", () => {
    const t = tree({ treeId: "might", contributingNodeIds: ["n1"], lenderTreeId: "fortitude" });
    expect(bucketFor(t, new Set(["might"]), new Set())).toBe("invested");
  });

  it("a non-invested tree with a lenderTreeId is a stance mate (D28/CrossUnlock.Lender)", () => {
    const t = tree({ treeId: "fortitude", lenderTreeId: "might" });
    expect(bucketFor(t, new Set(["might"]), new Set())).toBe("stanceMate");
  });

  it("an elemental tree matching the actor's own element is elementMatch", () => {
    const t = tree({ treeId: "fire", category: "Elemental", lenderTreeId: null });
    expect(bucketFor(t, new Set(), new Set(["fire"]))).toBe("elementMatch");
  });

  it("category comparison is case-insensitive -- the wire ships PascalCase (TreeCategory.ToString())", () => {
    const t = tree({ treeId: "fire", category: "Elemental" });
    expect(bucketFor(t, new Set(), new Set(["fire"]))).toBe("elementMatch");
  });

  it("a status-category tree never matches elementMatch even if its id is in elementIds", () => {
    const t = tree({ treeId: "poison", category: "Status" });
    expect(bucketFor(t, new Set(), new Set(["poison"]))).toBe("other");
  });

  it("everything else falls to other", () => {
    const t = tree({ treeId: "onslaught" });
    expect(bucketFor(t, new Set(), new Set())).toBe("other");
  });
});

describe("orderPathBrowse (§2.2 Level 1 default order)", () => {
  it("orders invested -> stance mates -> element match -> everything else", () => {
    const invested = tree({ treeId: "might", contributingNodeIds: ["n1"] });
    const stanceMate = tree({ treeId: "fortitude", lenderTreeId: "might" });
    const elementMatch = tree({ treeId: "fire", category: "Elemental" });
    const other = tree({ treeId: "onslaught" });
    const ordered = orderPathBrowse([other, elementMatch, stanceMate, invested], ["fire"]);
    expect(ordered.map((t) => t.treeId)).toEqual(["might", "fortitude", "fire", "onslaught"]);
  });

  // Test 30 (spec-tree-surface.md §14): "Gateless_paths_collapse_into_one_row_and_sort_last" -- 27
  // of 39 behind one expandable row; all wired paths render above it.
  it("test 30 -- gate-less paths never appear in the ordered list, wired paths only", () => {
    const wired = tree({ treeId: "might" });
    const gateless = tree({ treeId: "poison", category: "Status", gateState: "unproduced" });
    const ordered = orderPathBrowse([wired, gateless]);
    expect(ordered.map((t) => t.treeId)).toEqual(["might"]);
  });

  it("a gate-less tree never competes for invested/stanceMate/elementMatch placement either", () => {
    // Even a gate-less tree that WOULD otherwise read as invested/element-matching is excluded --
    // §9.1's collapse is unconditional on gateState, not conditioned on any other bucket signal.
    const gatelessInvested = tree({
      treeId: "poison",
      category: "Status",
      gateState: "unproduced",
      contributingNodeIds: ["n1"]
    });
    expect(orderPathBrowse([gatelessInvested])).toEqual([]);
  });
});

describe("gatelessPaths / gatelessCount", () => {
  // Test 32: "gateState_comes_from_the_report_never_from_a_zero" -- a wired path with zero
  // allocation still renders as wired; only the `gateState` field decides.
  it("test 32 -- a wired path with zero aptitude points is not gate-less", () => {
    const wiredButUnspent = tree({ treeId: "might", gateState: "wired", aptitudePoints: 0, tierReached: 0 });
    expect(gatelessPaths([wiredButUnspent])).toEqual([]);
  });

  it("test 32 -- an unproduced path is gate-less regardless of any node/point field", () => {
    const unproduced = tree({
      treeId: "poison",
      category: "Status",
      gateState: "unproduced",
      aptitudePoints: 999,
      tierReached: 5
    });
    expect(gatelessPaths([unproduced])).toHaveLength(1);
  });

  // Test 36: "The_gateless_bucket_count_is_read_never_typed" -- flip one path's gateState to
  // wired: the collapsed row's count drops by one, with no other change.
  it("test 36 -- flipping one path's gateState from unproduced to wired drops the count by exactly one", () => {
    const trees = [
      tree({ treeId: "might" }),
      tree({ treeId: "fire", category: "Elemental", gateState: "unproduced" }),
      tree({ treeId: "poison", category: "Status", gateState: "unproduced" })
    ];
    expect(gatelessCount(trees)).toBe(2);

    const flipped = trees.map((t) => (t.treeId === "fire" ? { ...t, gateState: "wired" as const } : t));
    expect(gatelessCount(flipped)).toBe(1);
    // no other change: the now-wired tree's own other fields are untouched.
    expect(flipped.find((t) => t.treeId === "fire")).toMatchObject({ treeId: "fire", category: "Elemental" });
  });

  it("today's real proportion (roughly a third) is a fixture property, not asserted here as a constant", () => {
    // Guards against hardcoding "27" anywhere in this module -- gatelessCount is a live count.
    expect(gatelessCount([])).toBe(0);
  });
});

// Test 31: "A_gateless_path_is_counted_in_nothing" -- absent from the not-working count, any locked
// total, the Focus denominator and Level 0. This module produces none of those totals itself (they
// live in passivesYours.ts and already iterate `tree.data.trees` directly); the guarantee this
// module owes is narrower and mechanical: a gate-less tree is invisible to `orderPathBrowse` and to
// `bucketFor`-driven counts, so nothing built on top of `orderPathBrowse` can double-count it.
describe("test 31 -- a gate-less path is invisible to the ordered/bucketed view", () => {
  it("orderPathBrowse's own length excludes gate-less trees entirely", () => {
    const trees = [
      tree({ treeId: "might" }),
      tree({ treeId: "fire", category: "Elemental", gateState: "unproduced" })
    ];
    expect(orderPathBrowse(trees)).toHaveLength(1);
  });

  it("filtering the ordered list can never resurface a gate-less tree", () => {
    const trees = [tree({ treeId: "poison", category: "Status", gateState: "unproduced" })];
    const ordered = orderPathBrowse(trees);
    expect(filterPathBrowse(ordered, { searchText: "poison", category: "all" })).toEqual([]);
  });
});

// Test 6 (spec-tree-surface.md §14): "Species_trees_never_enter_the_browse -- 879 is never a
// collection anywhere." PassiveTreeEndpoints.cs:95 already keeps species trees off the wire, but
// this module owns its own guard rather than trusting the wire payload alone (passive-tree-todo.md
// I5's own scope: "if it doesn't already [exclude species], that's a real gap in THIS task's scope").
describe("I5 -- species trees never enter the browse (§3)", () => {
  it("isSpeciesTree reads the category field, case-insensitively", () => {
    expect(isSpeciesTree(tree({ category: "Species" }))).toBe(true);
    expect(isSpeciesTree(tree({ category: "species" }))).toBe(true);
    expect(isSpeciesTree(tree({ category: "Primary" }))).toBe(false);
  });

  it("orderPathBrowse drops a species tree even if it would otherwise read as invested", () => {
    const bloodline = tree({ treeId: "zomboni-bloodline", category: "Species", contributingNodeIds: ["n1"] });
    const shared = tree({ treeId: "might" });
    expect(orderPathBrowse([bloodline, shared]).map((t) => t.treeId)).toEqual(["might"]);
  });

  it("a species tree never surfaces via bucketFor either, for any bucket signal", () => {
    const bloodline = tree({
      treeId: "zomboni-bloodline",
      category: "Species",
      contributingNodeIds: ["n1"],
      lenderTreeId: "might"
    });
    expect(orderPathBrowse([bloodline], [])).toEqual([]);
  });

  it("a species tree never collapses into the gate-less row either, even if unproduced", () => {
    const bloodline = tree({ treeId: "zomboni-bloodline", category: "Species", gateState: "unproduced" });
    expect(gatelessPaths([bloodline])).toEqual([]);
    expect(gatelessCount([bloodline])).toBe(0);
  });

  it("filtering the ordered list can never resurface a species tree", () => {
    const trees = [tree({ treeId: "zomboni-bloodline", category: "Species" })];
    const ordered = orderPathBrowse(trees);
    expect(filterPathBrowse(ordered, { searchText: "zomboni", category: "all" })).toEqual([]);
  });
});

describe("filterPathBrowse", () => {
  it("search matches the tree id", () => {
    const trees = [tree({ treeId: "might" }), tree({ treeId: "fortitude" })];
    expect(filterPathBrowse(trees, { searchText: "for", category: "all" }).map((t) => t.treeId)).toEqual(["fortitude"]);
  });

  it("category filter is case-insensitive against the wire's PascalCase category", () => {
    const trees = [tree({ treeId: "fire", category: "Elemental" }), tree({ treeId: "might", category: "Primary" })];
    expect(filterPathBrowse(trees, { searchText: "", category: "elemental" }).map((t) => t.treeId)).toEqual(["fire"]);
  });

  it("search and category compose", () => {
    const trees = [
      tree({ treeId: "fire", category: "Elemental" }),
      tree({ treeId: "ice", category: "Elemental" }),
      tree({ treeId: "might", category: "Primary" })
    ];
    expect(filterPathBrowse(trees, { searchText: "ice", category: "elemental" }).map((t) => t.treeId)).toEqual(["ice"]);
  });

  it("an empty query returns every tree unchanged", () => {
    const trees = [tree({ treeId: "might" }), tree({ treeId: "fortitude" })];
    expect(filterPathBrowse(trees, { searchText: "", category: "all" })).toEqual(trees);
  });
});
