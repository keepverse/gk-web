import { describe, expect, it } from "vitest";
import type { TreeResolveReport } from "@/lib/bus";
import { exclusionPrintFor, exclusionRuleText, newlyInertFindings, traitNotWorking } from "./passivesTrait";

/** Same fixture convention `passivesLattice.test.ts`/`passivesYours.test.ts` already use. */
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

describe("traitNotWorking -- delegates to passivesYours.notWorkingTraits, never a second predicate", () => {
  it("reads a nullified node the same way Level 0's count does", () => {
    const t = tree({
      excludedNodes: [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
    });
    expect(traitNotWorking("might", "n-loser", t)).toEqual({
      treeId: "might",
      nodeId: "n-loser",
      reason: "nullified",
      winnerNodeId: "n-winner"
    });
  });

  it("a reroute or precedence exclusion is never 'not working' -- only nullification stops a trait", () => {
    const t = tree({
      excludedNodes: [
        { nodeId: "n-reroute", form: "Reroute", winnerNodeId: "n-winner", isInert: false },
        { nodeId: "n-precedence", form: "Precedence", winnerNodeId: "n-winner", isInert: false }
      ]
    });
    expect(traitNotWorking("might", "n-reroute", t)).toBeUndefined();
    expect(traitNotWorking("might", "n-precedence", t)).toBeUndefined();
  });

  it("an invalidated (gate-closed) node reads as not-working with no winner", () => {
    const t = tree({ invalidNodeIds: ["n-invalid"] });
    expect(traitNotWorking("might", "n-invalid", t)).toEqual({ treeId: "might", nodeId: "n-invalid", reason: "invalid" });
  });
});

describe("exclusionRuleText -- all three D40 forms render a real, distinct sentence", () => {
  it("nullification names the loser as the one that stops", () => {
    expect(exclusionRuleText("nullification", "winner", "loser")).toMatch(/loser is the one that stops/);
  });

  it("precedence names the winner as taking precedence", () => {
    expect(exclusionRuleText("precedence", "winner", "loser")).toMatch(/winner takes precedence/);
  });

  it("reroute names the loser's skill points moving to the winner -- never the bare word 'points' (I10, §15)", () => {
    expect(exclusionRuleText("reroute", "winner", "loser")).toMatch(/loser's skill points reroute to winner/);
  });

  it("every form's sentence is distinct -- never the same string for two forms", () => {
    const texts = new Set(
      (["nullification", "precedence", "reroute"] as const).map((f) => exclusionRuleText(f, "w", "l"))
    );
    expect(texts.size).toBe(3);
  });
});

describe("exclusionPrintFor -- both sides read the SAME winner (test 34), all three D40 forms", () => {
  it.each(["Nullification", "Precedence", "Reroute"] as const)(
    "form=%s: the loser's and the winner's own print name the identical winner id and an identical rule sentence",
    (wireForm) => {
      const t = tree({
        excludedNodes: [{ nodeId: "n-loser", form: wireForm, winnerNodeId: "n-winner", isInert: wireForm === "Nullification" }]
      });

      const loserSide = exclusionPrintFor("n-loser", t);
      const winnerSide = exclusionPrintFor("n-winner", t);

      expect(loserSide).not.toBeNull();
      expect(winnerSide).not.toBeNull();
      // The named winner is the identical string on both sides.
      expect(loserSide!.otherNodeId).toBe("n-winner");
      expect(winnerSide!.otherNodeId).toBe("n-loser");
      expect(loserSide!.isWinner).toBe(false);
      expect(winnerSide!.isWinner).toBe(true);
      // The rule sentence itself is byte-identical on both cards -- never two hand-authored strings.
      expect(loserSide!.ruleText).toBe(winnerSide!.ruleText);
      expect(loserSide!.ruleText).toContain("n-winner");
      expect(loserSide!.ruleText).toContain("n-loser");
    }
  );

  it("isInert is only ever true on nullification, matching the wire's own isInert flag", () => {
    const t = tree({
      excludedNodes: [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
    });
    expect(exclusionPrintFor("n-loser", t)!.isInert).toBe(true);
  });

  it("a node in neither role prints nothing", () => {
    const t = tree({
      excludedNodes: [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
    });
    expect(exclusionPrintFor("n-bystander", t)).toBeNull();
  });
});

describe("newlyInertFindings -- the §8 'finding' toast's own diff, pure", () => {
  it("reports a node that became inert between before and after, naming its winner", () => {
    const before = [tree({ treeId: "might", excludedNodes: [] })];
    const after = [
      tree({
        treeId: "might",
        excludedNodes: [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
      })
    ];
    expect(newlyInertFindings(before, after)).toEqual([{ treeId: "might", nodeId: "n-loser", winnerNodeId: "n-winner" }]);
  });

  it("does not re-report a node that was already inert before the save", () => {
    const excludedNodes = [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }];
    const before = [tree({ treeId: "might", excludedNodes })];
    const after = [tree({ treeId: "might", excludedNodes })];
    expect(newlyInertFindings(before, after)).toEqual([]);
  });

  it("never reports a reroute/precedence exclusion -- only isInert ones", () => {
    const before = [tree({ treeId: "might", excludedNodes: [] })];
    const after = [
      tree({
        treeId: "might",
        excludedNodes: [{ nodeId: "n-loser", form: "Reroute", winnerNodeId: "n-winner", isInert: false }]
      })
    ];
    expect(newlyInertFindings(before, after)).toEqual([]);
  });

  it("scopes by treeId -- the same node id newly inert in a different tree still counts", () => {
    const before = [tree({ treeId: "a", excludedNodes: [] }), tree({ treeId: "b", excludedNodes: [] })];
    const after = [
      tree({ treeId: "a", excludedNodes: [] }),
      tree({ treeId: "b", excludedNodes: [{ nodeId: "n1", form: "Nullification", winnerNodeId: "n2", isInert: true }] })
    ];
    expect(newlyInertFindings(before, after)).toEqual([{ treeId: "b", nodeId: "n1", winnerNodeId: "n2" }]);
  });
});
