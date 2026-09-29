import { describe, expect, it } from "vitest";
import { passiveTreeLatticeFixture, passiveTreePathBrowseFixture } from "./passive-tree-volume";

/**
 * I1: the part of the volume-fixture harness that is real and checkable *today*, with no UI to
 * render it against yet (I4's `PathBrowse.tsx` and I6's `PathLattice.tsx` don't exist — see
 * `../passive-tree-volume.spec.ts` for the scaffolded, currently-skipped render assertions that
 * consume this same module once those land). These tests assert the fixture generator's own
 * output, which is genuinely load-bearing: a wrong count or a malformed entry here would silently
 * invalidate every volume test written against it later.
 */
describe("passiveTreePathBrowseFixture", () => {
  it.each([10, 100, 1000])("produces exactly %i entries", (count) => {
    expect(passiveTreePathBrowseFixture(count)).toHaveLength(count);
  });

  it("every entry has a stable id and a gateState from the closed §9.1 set", () => {
    const entries = passiveTreePathBrowseFixture(50);
    const ids = new Set(entries.map((e) => e.pathId));
    expect(ids.size).toBe(50);
    for (const entry of entries) {
      expect(["wired", "unproduced"]).toContain(entry.gateState);
    }
  });

  it("includes both gate states, so a volume test exercises the collapsed bucket too (§9.1 rule 3)", () => {
    const entries = passiveTreePathBrowseFixture(10);
    expect(entries.some((e) => e.gateState === "unproduced")).toBe(true);
    expect(entries.some((e) => e.gateState === "wired")).toBe(true);
  });
});

describe("passiveTreeLatticeFixture", () => {
  it("is fixed at 40 real TreeNodeSummary-shaped nodes regardless of caller — GG-61, §2.3, §14 test 4", () => {
    expect(passiveTreeLatticeFixture()).toHaveLength(40);
  });

  it("covers all 10 tiers with no gaps, 4 nodes per tier (2 branches x 2 nodes-per-slot, B1's shape)", () => {
    const nodes = passiveTreeLatticeFixture();
    const tiers = new Set(nodes.map((n) => n.tier));
    expect(tiers.size).toBe(10);
    expect(Math.min(...tiers)).toBe(1);
    expect(Math.max(...tiers)).toBe(10);
    for (let tier = 1; tier <= 10; tier++) {
      expect(nodes.filter((n) => n.tier === tier)).toHaveLength(4);
    }
  });

  it("every node id is unique and carries a real (branch, tier) slot", () => {
    const nodes = passiveTreeLatticeFixture();
    expect(new Set(nodes.map((n) => n.nodeId)).size).toBe(40);
    expect(new Set(nodes.map((n) => n.branch))).toEqual(new Set(["Off", "Def"]));
  });
});
