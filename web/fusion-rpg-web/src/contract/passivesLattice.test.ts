import { describe, expect, it } from "vitest";
import type { TreeNodeSummary, TreeResolveReport } from "@/lib/bus";
import {
  branchesOf,
  cellStateFor,
  GATELESS_CONDITION_TEXT,
  isConditionPresentation,
  lockedTierReason,
  scrollTargetTier,
  tierDistance,
  tierRequirement,
  tierRows
} from "./passivesLattice";

/** Same fixture convention `passivesYours.test.ts`/`passivesBrowse.test.ts` already use. */
function tree(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "might",
    category: "primary",
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
    nodes: [],
    ...overrides
  };
}

/** 40 real cells: 2 branches x 10 tiers x 2 nodes-per-slot (B1's own shape -- "40 nodes, 20 per
 * branch"). Matches `TreeNodeSummaryDto`'s wire shape exactly. */
function fortyNodes(treeSlug = "might"): TreeNodeSummary[] {
  const out: TreeNodeSummary[] = [];
  for (let tier = 1; tier <= 10; tier++) {
    for (const branch of ["Off", "Def"]) {
      for (const n of [0, 1]) {
        out.push({
          nodeId: `skill.${treeSlug}-${branch.toLowerCase()}-t${tier}-n${n}`,
          branch,
          tier,
          nodeClass: "Magnitude"
        });
      }
    }
  }
  return out;
}

describe("tierRequirement", () => {
  it("reproduces TierGate.Reached's own formula: reqScalePoints * t*(t+1)/2", () => {
    // spec-tree-surface.md §13's own worked ladder, reqScalePoints=5: t=1:5, t=2:15, t=3:30.
    expect(tierRequirement(1, 5)).toBe(5);
    expect(tierRequirement(2, 5)).toBe(15);
    expect(tierRequirement(3, 5)).toBe(30);
  });
});

describe("tierDistance", () => {
  it("computes need/have/short per actor from the report's own aptitudePoints, never a stated constant", () => {
    const d = tierDistance(9, tree({ aptitudePoints: 175 }), 5);
    expect(d.need).toBe(9 * 10 * 5 / 2); // 225
    expect(d.have).toBe(175);
    expect(d.short).toBe(50);
  });

  it("floors short at 0 once the tier is reached", () => {
    const d = tierDistance(1, tree({ aptitudePoints: 999 }), 5);
    expect(d.short).toBe(0);
  });
});

describe("lockedTierReason -- test 9, both routes, one table", () => {
  it("names both routes when a lender exists (§7.2 part 4)", () => {
    const text = lockedTierReason({ short: 5, need: 180, pathName: "might", lenderPathName: "fortitude" });
    expect(text).toContain("180 aptitude points");
    expect(text).toContain("5 more in might");
    expect(text).toContain("5 more in fortitude");
    expect(text).toMatch(/,\s*or\s*/);
  });

  it("names only the one real route when there is no lender", () => {
    const text = lockedTierReason({ short: 5, need: 180, pathName: "might", lenderPathName: null });
    expect(text).toContain("5 more in might");
    expect(text).not.toMatch(/,\s*or\s*/);
  });

  it("never renders the bare word 'points' -- always 'aptitude points' (§4.1, test 33)", () => {
    const text = lockedTierReason({ short: 5, need: 180, pathName: "might", lenderPathName: "fortitude" });
    expect(text).not.toMatch(/(?<!aptitude )\bpoints\b/);
  });
});

describe("cellStateFor", () => {
  const node: TreeNodeSummary = { nodeId: "skill.might-off-t3-n0", branch: "Off", tier: 3, nodeClass: "Magnitude" };

  it("owned wins even if the gate has since closed below this tier (D11/D12 invalidation, still 'owned' at the cell level)", () => {
    const t = tree({ tierReached: 0, invalidNodeIds: [node.nodeId] });
    expect(cellStateFor(node, t)).toBe("owned");
  });

  it("available when not owned and the tier is reached", () => {
    const t = tree({ tierReached: 3 });
    expect(cellStateFor(node, t)).toBe("available");
  });

  it("locked when not owned and the tier is not reached", () => {
    const t = tree({ tierReached: 2 });
    expect(cellStateFor(node, t)).toBe("locked");
  });

  it("an excluded node (nullified or not) still counts as owned", () => {
    const t = tree({ excludedNodes: [{ nodeId: node.nodeId, form: "Nullification", winnerNodeId: "x", isInert: true }] });
    expect(cellStateFor(node, t)).toBe("owned");
  });
});

describe("tierRows -- GG-61, all 40 cells, no windowing", () => {
  it("groups every enabled node into its own (tier, branch) slot across all 10 tiers", () => {
    const rows = tierRows(tree({ nodes: fortyNodes(), tiers: 10 }), {});
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.cells.length === 4)).toBe(true); // 2 branches x 2 nodes-per-slot
    expect(rows.reduce((n, r) => n + r.cells.length, 0)).toBe(40);
  });

  it("an owned node reads its soul level from soulLevelByNodeId, defaulting to 0 when absent (B5 §1.1)", () => {
    const nodeId = "skill.might-off-t1-n0";
    const t = tree({ nodes: [{ nodeId, branch: "Off", tier: 1, nodeClass: "Magnitude" }], contributingNodeIds: [nodeId] });
    const [row] = tierRows(t, {});
    expect(row!.cells[0]!.state).toBe("owned");
    expect(row!.cells[0]!.soulLevel).toBe(0);

    const [rowWithSouls] = tierRows(t, { [nodeId]: 6 });
    expect(rowWithSouls!.cells[0]!.soulLevel).toBe(6);
  });
});

describe("branchesOf", () => {
  it("reads the real branch labels from the wire, sorted, never hardcoded", () => {
    expect(branchesOf(fortyNodes())).toEqual(["Def", "Off"]);
  });
});

describe("scrollTargetTier -- test 5, never tier 1 for a player with real depth", () => {
  it("targets the actor's own reached tier when they have gone deeper than 1", () => {
    expect(scrollTargetTier(tree({ tierReached: 6, tiers: 10 }))).toBe(6);
  });

  it("a fresh actor with no depth legitimately starts at tier 1 -- not a violation of the rule", () => {
    expect(scrollTargetTier(tree({ tierReached: 0, tiers: 10 }))).toBe(1);
  });

  it("never targets a tier beyond the tree's own tier count", () => {
    expect(scrollTargetTier(tree({ tierReached: 99, tiers: 10 }))).toBe(10);
  });
});

describe("isConditionPresentation -- §9.1, read from gateState, never inferred from a zero", () => {
  it("a wired tree at tier 0 is a distance, not a condition", () => {
    expect(isConditionPresentation(tree({ gateState: "wired", tierReached: 0 }))).toBe(false);
  });

  it("an unproduced tree is always a condition, regardless of tierReached", () => {
    expect(isConditionPresentation(tree({ gateState: "unproduced" }))).toBe(true);
  });
});

describe("GATELESS_CONDITION_TEXT -- one shared sentence with PathBrowse's own gate-less row", () => {
  it("is the exact sentence, not a second hand-authored copy", () => {
    expect(GATELESS_CONDITION_TEXT).toBe("nothing in the world teaches this yet.");
  });
});
