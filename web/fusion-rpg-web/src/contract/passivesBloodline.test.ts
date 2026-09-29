import { describe, expect, it } from "vitest";
import type { TreeResolveReport } from "@/lib/bus";
import { absent, known, pendingWithReason } from "./pending";
import { bloodlineDiscoveryOf, bloodlineReadState, isBloodlineKnown } from "./passivesBloodline";

function tree(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "zomboni-bloodline",
    category: "Species",
    gateState: "wired",
    tierReached: 3,
    tiers: 10,
    aptitudePoints: 12,
    contributingNodeIds: ["n1", "n2"],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 1000,
    focusMilli: 1200,
    excludedNodes: [],
    ...overrides
  };
}

describe("bloodlineDiscoveryOf", () => {
  it("no codex entry at all reads as undiscovered", () => {
    expect(bloodlineDiscoveryOf(undefined)).toBe("undiscovered");
  });

  it("passes seen and discovered through unchanged", () => {
    expect(bloodlineDiscoveryOf("seen")).toBe("seen");
    expect(bloodlineDiscoveryOf("discovered")).toBe("discovered");
  });
});

describe("isBloodlineKnown", () => {
  it("discovered and seen both count as known (CreaturesPage.tsx's own reading)", () => {
    expect(isBloodlineKnown("discovered")).toBe(true);
    expect(isBloodlineKnown("seen")).toBe(true);
  });

  it("undiscovered is not known", () => {
    expect(isBloodlineKnown("undiscovered")).toBe(false);
  });
});

describe("bloodlineReadState", () => {
  it("an undiscovered bloodline is a silhouette even when the report is already known -- the leak case", () => {
    // This is the trust-boundary test: discovery gates the render before the report is ever
    // consulted, so a prefetched/cached report can never leak through an undiscovered bloodline.
    const state = bloodlineReadState("undiscovered", known(tree()));
    expect(state).toEqual({ kind: "silhouette" });
  });

  it("an undiscovered bloodline is a silhouette when the report is pending", () => {
    expect(bloodlineReadState("undiscovered", pendingWithReason("no endpoint yet"))).toEqual({ kind: "silhouette" });
  });

  it("an undiscovered bloodline is a silhouette when the report is absent", () => {
    expect(bloodlineReadState("undiscovered", absent())).toEqual({ kind: "silhouette" });
  });

  it("a discovered bloodline with a pending report is 'pending', never a silhouette", () => {
    const state = bloodlineReadState("discovered", pendingWithReason("no per-creature species-tree endpoint yet"));
    expect(state).toEqual({ kind: "pending", reason: "no per-creature species-tree endpoint yet" });
  });

  it("a discovered bloodline with an absent report is 'empty', never a silhouette", () => {
    expect(bloodlineReadState("discovered", absent())).toEqual({ kind: "empty" });
  });

  it("a discovered bloodline with a known report renders the real tree", () => {
    const t = tree({ treeId: "zomboni-bloodline" });
    expect(bloodlineReadState("discovered", known(t))).toEqual({ kind: "tree", report: t });
  });

  it("a merely-seen bloodline (not yet fully discovered) also renders the real tree", () => {
    const t = tree({ treeId: "imp-bloodline" });
    expect(bloodlineReadState("seen", known(t))).toEqual({ kind: "tree", report: t });
  });
});
