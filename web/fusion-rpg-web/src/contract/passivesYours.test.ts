import { describe, expect, it } from "vitest";
import type { TreeResolveReport } from "@/lib/bus";
import { draftFocusPreview, focusReading, investedTrees, notWorkingTraits } from "./passivesYours";

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
    ...overrides
  };
}

describe("investedTrees", () => {
  it("counts a tree as invested via any of contributing, invalid, or excluded", () => {
    const t1 = tree({ treeId: "a", contributingNodeIds: ["n1"] });
    const t2 = tree({ treeId: "b", invalidNodeIds: ["n2"] });
    const t3 = tree({ treeId: "c", excludedNodes: [{ nodeId: "n3", form: "Nullification", winnerNodeId: "n4", isInert: true }] });
    const t4 = tree({ treeId: "d" }); // nothing owned
    expect(investedTrees([t1, t2, t3, t4]).map((t) => t.treeId)).toEqual(["a", "b", "c"]);
  });

  it("a fresh actor with zero owned nodes anywhere invests in nothing", () => {
    expect(investedTrees([tree(), tree({ treeId: "other" })])).toEqual([]);
  });
});

describe("notWorkingTraits", () => {
  it("unions invalid (gate closed) and nullified (isInert) nodes, never a reroute/precedence exclusion", () => {
    const t = tree({
      treeId: "might",
      invalidNodeIds: ["n-invalid"],
      excludedNodes: [
        { nodeId: "n-nullified", form: "Nullification", winnerNodeId: "n-winner", isInert: true },
        { nodeId: "n-rerouted", form: "Reroute", winnerNodeId: "n-other", isInert: false },
        { nodeId: "n-precedence", form: "Precedence", winnerNodeId: "n-other2", isInert: false }
      ]
    });
    const result = notWorkingTraits([t]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ treeId: "might", nodeId: "n-invalid", reason: "invalid" });
    expect(result).toContainEqual({ treeId: "might", nodeId: "n-nullified", reason: "nullified", winnerNodeId: "n-winner" });
  });

  it("returns an empty list when nothing is broken", () => {
    expect(notWorkingTraits([tree()])).toEqual([]);
  });

  it("sums across every tree, not just the first", () => {
    const a = tree({ treeId: "a", invalidNodeIds: ["n1"] });
    const b = tree({ treeId: "b", invalidNodeIds: ["n2", "n3"] });
    expect(notWorkingTraits([a, b])).toHaveLength(3);
  });
});

describe("focusReading", () => {
  it("returns null when nothing is invested (H undefined over an empty allocation)", () => {
    expect(focusReading([tree({ herfindahlMilli: 0 })])).toBeNull();
  });

  it("reads the multiplier and effective-path count straight from the report, never re-derives H", () => {
    // H=1000milli (all-in on one path) -> 1/H = 1 effective path; focusMilli 1200 -> x1.2
    const reading = focusReading([tree({ herfindahlMilli: 1000, focusMilli: 1200 })]);
    expect(reading).toEqual({ multiplier: 1.2, effectivePaths: 1 });
  });

  it("a two-path-even split reads about 2 effective paths (H=500milli)", () => {
    const reading = focusReading([tree({ herfindahlMilli: 500, focusMilli: 1100 })]);
    expect(reading).toEqual({ multiplier: 1.1, effectivePaths: 2 });
  });

  it("reads whichever tree carries the actor-wide H/F -- every tree gets the identical value server-side", () => {
    const a = tree({ treeId: "a", herfindahlMilli: 0, focusMilli: 1000 });
    const b = tree({ treeId: "b", herfindahlMilli: 1000, focusMilli: 1200 });
    expect(focusReading([a, b])).toEqual({ multiplier: 1.2, effectivePaths: 1 });
  });
});

/**
 * Task I9 (spec-tree-surface.md §6, §5.1 item 2) -- a DRAFT-ONLY mirror of `Concentration.cs`,
 * legitimate only because it is fed the real tuning dial. Every golden value below is copied
 * straight from `tests/FusionRpg.Core.Tests/PassiveTree/tests-PassiveTree/Resolve/
 * ConcentrationTests.cs` (`HerfindahlMilli([40,0,0]) == 1000`, `HerfindahlMilli([5,5]) == 500`,
 * `BlendMilli(1000,0,500) == 500`, `FmaxAppliedMilli(500,1200) == 1100`,
 * `FmaxAppliedMilli(*,1000) == 1000`) -- this proves the TS mirror agrees with the engine's own
 * formula, not just with itself.
 */
function nodesFor(treeId: string, count: number, soulLevel = 0): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < count; i++) out[`skill.${treeId}-off-t1-n${i}`] = soulLevel;
  return out;
}

describe("draftFocusPreview -- a client-side mirror, ONLY for a non-committed draft", () => {
  it("returns null when the draft owns nothing yet (mirrors focusReading's own empty-allocation rule)", () => {
    expect(draftFocusPreview({}, { fmaxMilli: 1200, wMilli: 1000 })).toBeNull();
  });

  it("a pure single-tree draft (H_nodes=1000milli, w=1000 pure-nodes) reads F=Fmax, 1 effective path", () => {
    // Concentration.HerfindahlMilli([40,0,0]) == 1000 -- 40 nodes in ONE tree, none elsewhere.
    const merged = nodesFor("might", 40);
    expect(draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 1000 })).toEqual({
      multiplier: 1.2,
      effectivePaths: 1
    });
  });

  it("two even trees (H_nodes=500milli, w=1000 pure-nodes) reads about 2 effective paths", () => {
    // Concentration.HerfindahlMilli([5,5]) == 500.
    const merged = { ...nodesFor("might", 5), ...nodesFor("fortitude", 5) };
    expect(draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 1000 })).toEqual({
      multiplier: 1.1,
      effectivePaths: 2
    });
  });

  it("blends nodes and souls by wMilli -- BlendMilli(hNodes=1000, hSouls=0, w=500) == 500", () => {
    // Every node at soul level 0 in a single tree: H_nodes=1000 (one tree), H_souls=0 (ΣsoulLevels=0,
    // "zero when Σ=0" -- Concentration's own no-1/n-fallback rule), blended 50/50.
    const merged = nodesFor("might", 40, 0);
    expect(draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 500 })).toEqual({
      multiplier: 1.1,
      effectivePaths: 2
    });
  });

  it("Fmax=1000 removes F byte-identically -- a legal, tested configuration (mirrors the Core test of the same name)", () => {
    const merged = nodesFor("might", 40, 0);
    expect(draftFocusPreview(merged, { fmaxMilli: 1000, wMilli: 500 })).toEqual({
      multiplier: 1.0,
      effectivePaths: 2
    });
  });

  it("a pathological w=0 dial with all-zero soul levels reads a defensive null, never a divide-by-zero", () => {
    // BlendMilli(hNodes=anything, hSouls=0, w=0) == 0 -- H fully determined by souls, which are all
    // zero. A real player has real investment here, but nothing this formula can read a Focus from
    // (mirrors focusReading's own herfindahlMilli > 0 guard) -- disclosed in the function's own doc
    // comment as a defensive mirror, not a case real tuning (wMilli=500) ever reaches.
    const merged = nodesFor("might", 40, 0);
    expect(draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 0 })).toBeNull();
  });

  it("skips a malformed node id rather than throwing", () => {
    const merged = { "not-a-skill-id": 5, ...nodesFor("might", 40, 0) };
    expect(() => draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 1000 })).not.toThrow();
    expect(draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 1000 })).toEqual({
      multiplier: 1.2,
      effectivePaths: 1
    });
  });

  // Test 14 (spec-tree-surface.md §14): "Focus_moves_while_the_draft_is_edited ... Both halves of the
  // line, together." The pure-function proof: moving from one tree to two moves BOTH the effective-
  // path count (1 -> 2) AND the multiplier (×1.20 -> ×1.10) together, from the SAME tuning.
  it("test 14 -- both halves of the line move together as the draft is edited", () => {
    const tuning = { fmaxMilli: 1200, wMilli: 1000 };
    const before = draftFocusPreview(nodesFor("might", 40), tuning);
    const after = draftFocusPreview({ ...nodesFor("might", 20), ...nodesFor("fortitude", 20) }, tuning);

    expect(before).toEqual({ multiplier: 1.2, effectivePaths: 1 });
    expect(after).toEqual({ multiplier: 1.1, effectivePaths: 2 });
    // Explicit "both halves moved" assertion, not just two separate equalities.
    expect(after!.effectivePaths).toBeGreaterThan(before!.effectivePaths);
    expect(after!.multiplier).toBeLessThan(before!.multiplier);
  });

  it("never used for the committed line -- focusReading and draftFocusPreview read disjoint inputs", () => {
    // Structural proof the two functions can never be confused for one another: focusReading takes
    // TreeResolveReport[] (server-resolved), draftFocusPreview takes a plain soul-level map (client
    // merged state) plus the tuning dial. Calling draftFocusPreview on a committed, single-tree,
    // all-owned draft with the SAME dial the server used reproduces focusReading's own answer for
    // that build -- proving the mirror is faithful -- without either function ever reading the
    // other's input shape.
    const merged = nodesFor("might", 40, 0);
    const committed = focusReading([tree({ herfindahlMilli: 1000, focusMilli: 1200 })]);
    const preview = draftFocusPreview(merged, { fmaxMilli: 1200, wMilli: 1000 });
    expect(preview).toEqual(committed);
  });
});
