import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNodeSummary, TreeResolveReport } from "@/lib/bus";
import { useToastStack } from "@/shell/toastStack";
import { TraitDetail } from "./TraitDetail";

/**
 * passive-tree-todo.md I7 — Level 3 (spec-tree-surface.md §4, §8). Same fixture convention
 * `PathLattice.test.tsx` already uses.
 */
function tree(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "might",
    category: "primary",
    gateState: "wired",
    tierReached: 2,
    tiers: 10,
    aptitudePoints: 15,
    contributingNodeIds: [],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 1000,
    focusMilli: 1200,
    excludedNodes: [],
    nodes: [],
    ...overrides
  };
}

const ownedNode: TreeNodeSummary = { nodeId: "n-owned", branch: "Off", tier: 1, nodeClass: "Magnitude" };
const availableNode: TreeNodeSummary = { nodeId: "n-available", branch: "Off", tier: 1, nodeClass: "Magnitude" };
const lockedNode: TreeNodeSummary = { nodeId: "n-locked", branch: "Off", tier: 9, nodeClass: "Magnitude" };

function renderDetail(props: Partial<Parameters<typeof TraitDetail>[0]> = {}) {
  const onSaveNodes = vi.fn(async (_nodes: Record<string, number>) => [tree({ contributingNodeIds: ["n-owned"] })]);
  const onBack = vi.fn();
  render(
    <TraitDetail
      node={ownedNode}
      report={tree({ contributingNodeIds: ["n-owned"] })}
      soulLevelByNodeId={{ "n-owned": 3 }}
      onSaveNodes={onSaveNodes}
      isSaving={false}
      onBack={onBack}
      {...props}
    />
  );
  return { onSaveNodes, onBack };
}

describe("TraitDetail — seedsmith-content-standard, content-completeness-passive-tree (2026-09-08)", () => {
  it("renders the real generated name and flavor when the wire sends them", () => {
    renderDetail({
      node: { ...ownedNode, name: "Thickened Marrow", flavor: "The bone grows dense and heavy." }
    });
    expect(screen.getByTestId("passives-trait-name")).toHaveTextContent("Thickened Marrow");
    expect(screen.getByTestId("passives-trait-flavor")).toHaveTextContent("The bone grows dense and heavy.");
  });

  it("falls back to the raw node id and omits the flavor block entirely when neither exists yet", () => {
    renderDetail(); // ownedNode has no name/flavor
    expect(screen.getByTestId("passives-trait-name")).toHaveTextContent(ownedNode.nodeId);
    expect(screen.queryByTestId("passives-trait-flavor")).not.toBeInTheDocument();
  });
});

describe("TraitDetail — three states, one shared cellStateFor", () => {
  it("owned: shows the current depth and a deepen control", () => {
    renderDetail();
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/depth 3/i);
    expect(screen.getByTestId("passives-trait-deepen")).toBeInTheDocument();
  });

  it("available: no deepen control at all", () => {
    renderDetail({
      node: availableNode,
      report: tree({ tierReached: 5 }), // tier 1 <= 5, not owned -> available
      soulLevelByNodeId: {}
    });
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/available to unlock/i);
    expect(screen.queryByTestId("passives-trait-deepen")).not.toBeInTheDocument();
  });

  it("locked: no deepen control at all", () => {
    renderDetail({
      node: lockedNode,
      report: tree({ tierReached: 0 }),
      soulLevelByNodeId: {}
    });
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/locked/i);
    expect(screen.queryByTestId("passives-trait-deepen")).not.toBeInTheDocument();
  });
});

describe("TraitDetail — the deepen control is a stepper, never a slider or a raw NumberInput (PS-8, GG-23/24)", () => {
  it("has no <input type=range> and no bare-id-labelled NumberInput", () => {
    const { container } = render(
      <TraitDetail
        node={ownedNode}
        report={tree({ contributingNodeIds: ["n-owned"] })}
        soulLevelByNodeId={{ "n-owned": 3 }}
        onSaveNodes={vi.fn()}
        isSaving={false}
        onBack={vi.fn()}
      />
    );
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(screen.getByTestId("passives-trait-step-up")).toHaveAttribute("aria-label", "Increase depth");
  });

  it("+1/+10/-1 edit the DRAFT only -- never calls onSaveNodes on their own (§4 rule 3)", async () => {
    const user = userEvent.setup();
    const { onSaveNodes } = renderDetail();

    await user.click(screen.getByTestId("passives-trait-step-up"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("4");

    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("14");

    await user.click(screen.getByTestId("passives-trait-step-down"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("13");

    expect(onSaveNodes).not.toHaveBeenCalled();
  });

  it("never clamps to a maximum -- PS-8, souls are uncapped", async () => {
    const user = userEvent.setup();
    renderDetail({ soulLevelByNodeId: { "n-owned": 999_999 } });
    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("1000009");
  });

  it("clamps only to a legal non-negative integer, same as every other allocation draft", async () => {
    const user = userEvent.setup();
    renderDetail({ soulLevelByNodeId: { "n-owned": 0 } });
    await user.click(screen.getByTestId("passives-trait-step-down"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("0");
  });

  it("Save commits the draft via onSaveNodes as one whole allocation", async () => {
    const user = userEvent.setup();
    const { onSaveNodes } = renderDetail();
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));
    expect(onSaveNodes).toHaveBeenCalledWith({ "n-owned": 4 });
  });

  it("Revert restores the draft without calling onSaveNodes", async () => {
    const user = userEvent.setup();
    const { onSaveNodes } = renderDetail();
    await user.click(screen.getByTestId("passives-trait-step-up"));
    expect(screen.getByTestId("passives-trait-save-row")).toBeInTheDocument();
    await user.click(screen.getByTestId("passives-trait-revert"));
    expect(screen.queryByTestId("passives-trait-save-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("3");
    expect(onSaveNodes).not.toHaveBeenCalled();
  });
});

describe("TraitDetail — D40, all three exclusion forms render from a fixture (test 34/35)", () => {
  it.each([
    ["Nullification", true],
    ["Precedence", false],
    ["Reroute", false]
  ] as const)("form=%s renders the rule, naming the winner, with isInert=%s", (form, isInert) => {
    renderDetail({
      report: tree({
        contributingNodeIds: ["n-owned"],
        excludedNodes: [{ nodeId: "n-owned", form, winnerNodeId: "n-winner", isInert }]
      })
    });
    const print = screen.getByTestId("passives-trait-exclusion");
    expect(print.dataset.form).toBe(form.toLowerCase());
    expect(print.dataset.winner).toBe("n-winner");
    expect(print).toHaveTextContent("n-winner");
    expect(print).toHaveTextContent("n-owned");
  });

  it("a nullified trait renders INERT, never un-unlocked -- it keeps 'owned' state AND carries Not working", () => {
    renderDetail({
      report: tree({
        contributingNodeIds: [],
        excludedNodes: [{ nodeId: "n-owned", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
      })
    });
    // Still "owned" -- D14/D40: the player spent for it, it stays theirs.
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/depth/i);
    const notWorking = screen.getByTestId("passives-trait-not-working");
    expect(notWorking).toHaveTextContent(/not working/i);
    expect(notWorking).toHaveTextContent(/switched off by n-winner/i);
  });

  it("a reroute/precedence exclusion never renders the Not working block -- only nullification stops a trait", () => {
    renderDetail({
      report: tree({
        contributingNodeIds: ["n-owned"],
        excludedNodes: [{ nodeId: "n-owned", form: "Reroute", winnerNodeId: "n-winner", isInert: false }]
      })
    });
    expect(screen.queryByTestId("passives-trait-not-working")).not.toBeInTheDocument();
    expect(screen.getByTestId("passives-trait-exclusion")).toBeInTheDocument();
  });

  it("both sides of the SAME pair render the identical rule sentence naming the identical winner", () => {
    const report = tree({
      contributingNodeIds: ["n-loser", "n-winner"],
      excludedNodes: [{ nodeId: "n-loser", form: "Nullification", winnerNodeId: "n-winner", isInert: true }]
    });
    const { unmount } = render(
      <TraitDetail
        node={{ nodeId: "n-loser", branch: "Off", tier: 1, nodeClass: "Magnitude" }}
        report={report}
        soulLevelByNodeId={{}}
        onSaveNodes={vi.fn()}
        isSaving={false}
        onBack={vi.fn()}
      />
    );
    const loserText = screen.getByTestId("passives-trait-exclusion").textContent;
    const loserWinner = screen.getByTestId("passives-trait-exclusion").dataset.winner;
    unmount();

    render(
      <TraitDetail
        node={{ nodeId: "n-winner", branch: "Off", tier: 1, nodeClass: "Magnitude" }}
        report={report}
        soulLevelByNodeId={{}}
        onSaveNodes={vi.fn()}
        isSaving={false}
        onBack={vi.fn()}
      />
    );
    const winnerText = screen.getByTestId("passives-trait-exclusion").textContent;
    const winnerWinner = screen.getByTestId("passives-trait-exclusion").dataset.winner;

    expect(loserText).toBe(winnerText);
    expect(loserWinner).toBe(winnerWinner);
    expect(loserWinner).toBe("n-winner");
  });
});

describe("TraitDetail — §8 finding toast (GG-16), never a modal", () => {
  it("a save that newly nullifies a trait pushes exactly one toast naming both", async () => {
    useToastStack.getState().clear();
    const user = userEvent.setup();
    const before = tree({ contributingNodeIds: ["n-owned"], excludedNodes: [] });
    const onSaveNodes = vi.fn(async () => [
      tree({
        contributingNodeIds: ["n-owned"],
        excludedNodes: [{ nodeId: "n-other", form: "Nullification", winnerNodeId: "n-owned", isInert: true }]
      })
    ]);
    render(
      <TraitDetail
        node={ownedNode}
        report={before}
        soulLevelByNodeId={{ "n-owned": 3 }}
        onSaveNodes={onSaveNodes}
        isSaving={false}
        onBack={vi.fn()}
      />
    );
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));

    const toasts = useToastStack.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.title).toMatch(/n-other stopped working/i);
    expect(toasts[0]!.message).toMatch(/switched off by n-owned/i);
  });

  it("a save with no new nullification pushes no finding toast", async () => {
    useToastStack.getState().clear();
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });
});

describe("TraitDetail — I8: the lifted-Plan bridge (onDraftChange/onCommitted)", () => {
  it("every stepper edit is mirrored up via onDraftChange, in addition to the local draft", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TraitDetail
        node={ownedNode}
        report={tree({ contributingNodeIds: ["n-owned"] })}
        soulLevelByNodeId={{ "n-owned": 3 }}
        onSaveNodes={vi.fn()}
        isSaving={false}
        onBack={vi.fn()}
        onDraftChange={onDraftChange}
      />
    );
    await user.click(screen.getByTestId("passives-trait-step-up"));
    expect(onDraftChange).toHaveBeenCalledWith("n-owned", 4);
    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(onDraftChange).toHaveBeenCalledWith("n-owned", 14);
  });

  it("onCommitted fires after a successful save, so the lifted Plan can be cleared", async () => {
    const user = userEvent.setup();
    const onCommitted = vi.fn();
    const { onSaveNodes } = renderDetail({ onCommitted });
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));
    expect(onSaveNodes).toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it("neither callback is required -- omitting both behaves exactly as I7 shipped it", async () => {
    const user = userEvent.setup();
    const { onSaveNodes } = renderDetail();
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));
    expect(onSaveNodes).toHaveBeenCalledWith({ "n-owned": 4 });
  });
});

describe("TraitDetail — the back affordance", () => {
  it("calls onBack when clicked", async () => {
    const user = userEvent.setup();
    const { onBack } = renderDetail();
    await user.click(screen.getByTestId("passives-trait-back"));
    expect(onBack).toHaveBeenCalled();
  });
});
