import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PassivesTab } from "./PassivesTab";
import type { PassiveTreeState } from "@/lib/bus";
import { useToastStack } from "@/shell/toastStack";

/**
 * passive-tree-todo.md I3 — Level 0 ("Yours", spec-tree-surface.md §2.2/§4.1/§8). Replaces the old
 * placeholder test (`PassivesTab` used to render four static `LockedGridSlot`s; it now reads real
 * data from three already-shipped queries), mocking `@/lib/bus` the same way `AptitudesPage.test.tsx`
 * does rather than standing up a real query client.
 */

// I8: `PassivesTab` reads/writes a `?plan=` URL param (GG-8). jsdom's `window.location`/`history`
// persist across tests in the SAME file, so without a reset here a plan written by one test would
// leak into the next test's fresh mount as a stale initial Plan -- reset before every test, at file
// scope, so no individual `describe` block below has to remember to do it itself.
beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

const readyTree: PassiveTreeState = {
  playerId: 1,
  catalogRevision: 1,
  soulLevelByNodeId: { "skill.might-off-t1-n0": 0 },
  trees: [
    {
      treeId: "might",
      category: "primary",
      gateState: "wired",
      tierReached: 2,
      tiers: 10,
      aptitudePoints: 15,
      contributingNodeIds: ["skill.might-off-t1-n0"],
      invalidNodeIds: ["skill.might-off-t2-n0"],
      lenderTreeId: null,
      herfindahlMilli: 1000,
      focusMilli: 1200,
      excludedNodes: [
        { nodeId: "skill.might-off-t1-n1", form: "Nullification", winnerNodeId: "skill.fortitude-off-t1-n0", isInert: true },
        // A reroute exclusion is NOT "not working" -- only nullification (isInert) stops a trait (§8).
        { nodeId: "skill.might-def-t1-n0", form: "Reroute", winnerNodeId: "skill.fortitude-def-t1-n0", isInert: false }
      ],
      // I6/I7 -- structural (branch, tier) identity for every enabled node, real cells to click into.
      nodes: [
        { nodeId: "skill.might-off-t1-n0", branch: "Off", tier: 1, nodeClass: "Magnitude" },
        { nodeId: "skill.might-off-t1-n1", branch: "Off", tier: 1, nodeClass: "Magnitude" },
        { nodeId: "skill.might-off-t2-n0", branch: "Off", tier: 2, nodeClass: "Magnitude" },
        { nodeId: "skill.might-def-t1-n0", branch: "Def", tier: 1, nodeClass: "Magnitude" },
        // Not owned, tier <= tierReached(2) -- "available". Not owned, tier > tierReached -- "locked".
        { nodeId: "skill.might-off-t1-n2", branch: "Off", tier: 1, nodeClass: "Magnitude" },
        { nodeId: "skill.might-off-t3-n0", branch: "Off", tier: 3, nodeClass: "Magnitude" }
      ]
    },
    {
      treeId: "fortitude",
      category: "primary",
      gateState: "wired",
      tierReached: 0,
      tiers: 10,
      aptitudePoints: 0,
      contributingNodeIds: [],
      invalidNodeIds: [],
      lenderTreeId: null,
      herfindahlMilli: 1000,
      focusMilli: 1200,
      excludedNodes: []
    }
  ],
  skillPointsBudget: 50,
  skillPointsSpent: 12,
  skillPointsAvailable: 38
};

const emptyTree: PassiveTreeState = {
  ...readyTree,
  trees: readyTree.trees.map((t) => ({ ...t, contributingNodeIds: [], invalidNodeIds: [], excludedNodes: [] }))
};

const aptitudesData = { theta: 100, budget: 300, spent: 100, withinBudget: true, shares: {} };
const soulsData = { playerId: 1, balance: 777, earnedTotal: 1000, spentTotal: 223, revision: 1, updatedUtc: "" };

let treeState: { data: PassiveTreeState | undefined; isLoading: boolean; isError: boolean };
let aptitudesState: { data: typeof aptitudesData | undefined; isLoading: boolean; isError: boolean };
let soulsState: { data: typeof soulsData | undefined; isLoading: boolean; isError: boolean };
const refetch = vi.fn();
// I7 -- Level 3's save path. Defaults to echoing the request's own tree back unchanged (no new
// exclusion fires); individual tests override this to prove the §8 "finding" toast.
const saveTreeNodesMutateAsync = vi.fn(async () => readyTree);
// I8's follow-up (§7.2 part 5) -- the preview endpoint's own mutation. Defaults to echoing the
// committed tree back unchanged (a no-op hypothetical); individual tests override this to prove a
// real close/open sentence renders.
const previewTreeMutateAsync = vi.fn(async () => readyTree);

vi.mock("@/lib/bus", () => ({
  usePlayers: () => ({ data: { currentPlayerId: 1 } }),
  usePassiveTree: () => ({ ...treeState, refetch }),
  useAptitudes: () => ({ ...aptitudesState, refetch }),
  useSoulBalance: () => ({ ...soulsState, refetch }),
  useSaveTreeNodes: () => ({ mutateAsync: saveTreeNodesMutateAsync, isPending: false }),
  usePreviewTree: () => ({ mutateAsync: previewTreeMutateAsync, isPending: false })
}));

describe("PassivesTab — Level 0 (Yours)", () => {
  beforeEach(() => {
    refetch.mockReset();
    saveTreeNodesMutateAsync.mockReset();
    saveTreeNodesMutateAsync.mockResolvedValue(readyTree);
    previewTreeMutateAsync.mockReset();
    previewTreeMutateAsync.mockResolvedValue(readyTree);
    treeState = { data: readyTree, isLoading: false, isError: false };
    aptitudesState = { data: aptitudesData, isLoading: false, isError: false };
    soulsState = { data: soulsData, isLoading: false, isError: false };
  });

  it("renders a loading state before any of the three queries has data", () => {
    treeState = { data: undefined, isLoading: true, isError: false };
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-loading")).toBeInTheDocument();
  });

  it("renders an error banner with a real retry action when a query fails", () => {
    aptitudesState = { data: undefined, isLoading: false, isError: true };
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("the empty state on a fresh actor is real content naming the aptitude budget, never a blank panel", () => {
    treeState = { data: emptyTree, isLoading: false, isError: false };
    render(<PassivesTab />);
    const empty = screen.getByTestId("passives-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toMatch(/200 aptitude points/i); // budget(300) - spent(100)
    expect(empty.textContent).toMatch(/pick a path/i);
    expect(screen.getByTestId("passives-browse-affordance")).toBeInTheDocument();
    expect(screen.queryByTestId("passives-invested")).not.toBeInTheDocument();
  });

  it("the empty state still renders the unspent currencies (GG-17: content, never hidden)", () => {
    treeState = { data: emptyTree, isLoading: false, isError: false };
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-currencies")).toBeInTheDocument();
  });

  it("renders invested paths with their tier progress, never the un-invested one", () => {
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-invested-might")).toHaveTextContent(/tier 2 of 10/i);
    expect(screen.queryByTestId("passives-invested-fortitude")).not.toBeInTheDocument();
  });

  it("names the three currencies distinctly -- never the bare word 'points' for two of them", () => {
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-currency-aptitude")).toHaveTextContent(/200 aptitude points.*opens a tier/i);
    expect(screen.getByTestId("passives-currency-skill")).toHaveTextContent(/38 skill points.*buys a trait/i);
    expect(screen.getByTestId("passives-currency-souls")).toHaveTextContent(/777 souls.*deepens a trait/i);
  });

  it("renders the Focus line read from the report, never re-derived", () => {
    render(<PassivesTab />);
    // herfindahlMilli 1000 -> H=1 -> 1/H=1 effective path; focusMilli 1200 -> x1.20
    expect(screen.getByTestId("passives-focus")).toHaveTextContent(/about 1 path/i);
    expect(screen.getByTestId("passives-focus")).toHaveTextContent(/×1\.20/);
  });

  it("the not-working count is exactly the invalid-plus-nullified union, never the reroute exclusion", () => {
    render(<PassivesTab />);
    const count = screen.getByTestId("passives-not-working-count");
    expect(count).toHaveTextContent(/2 of your traits are not working/i);
  });

  it("clicking the count filters to exactly those traits -- no more, no fewer", () => {
    render(<PassivesTab />);
    expect(screen.queryByTestId("passives-not-working-list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("passives-not-working-count"));
    const list = screen.getByTestId("passives-not-working-list");
    expect(list.children).toHaveLength(2);
    expect(screen.getByTestId("passives-not-working-skill.might-off-t2-n0")).toHaveTextContent(/gate.*closed/i);
    expect(screen.getByTestId("passives-not-working-skill.might-off-t1-n1")).toHaveTextContent(
      /switched off by skill\.fortitude-off-t1-n0/i
    );
    // The reroute exclusion never appears -- only nullification (isInert) is "not working".
    expect(screen.queryByTestId("passives-not-working-skill.might-def-t1-n0")).not.toBeInTheDocument();
  });

  it("does not render the not-working line at all when nothing is broken", () => {
    treeState = { data: emptyTree, isLoading: false, isError: false };
    render(<PassivesTab />);
    expect(screen.queryByTestId("passives-not-working")).not.toBeInTheDocument();
  });
});

/**
 * passive-tree-todo.md I4 — Level 1 ("All paths"). §2.2: "Levels 0 and 1 are tabs inside the
 * Passives tab, not pushes" -- these tests exercise the inner sub-tab bar this task adds, and the
 * GG-51 query-persistence contract (§2.2's own "query state belongs to the layer and survives
 * closing it"), mirroring `CreaturesLayer.test.tsx`'s own T27 GG-51 test shape.
 */
describe("PassivesTab — Level 1 (All paths)", () => {
  beforeEach(() => {
    refetch.mockReset();
    saveTreeNodesMutateAsync.mockReset();
    saveTreeNodesMutateAsync.mockResolvedValue(readyTree);
    previewTreeMutateAsync.mockReset();
    previewTreeMutateAsync.mockResolvedValue(readyTree);
    treeState = { data: readyTree, isLoading: false, isError: false };
    aptitudesState = { data: aptitudesData, isLoading: false, isError: false };
    soulsState = { data: soulsData, isLoading: false, isError: false };
  });

  it("the sub-tab bar opens on Yours by default, and switches to the browse", async () => {
    const user = userEvent.setup();
    render(<PassivesTab />);
    expect(screen.getByTestId("passives-invested")).toBeInTheDocument();
    expect(screen.queryByTestId("passives-path-browse")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("passives-sub-tab-all"));
    expect(screen.getByTestId("passives-path-browse")).toBeInTheDocument();
    expect(screen.queryByTestId("passives-invested")).not.toBeInTheDocument();
  });

  it("the browse renders a card for every real tree, ordered with invested first", async () => {
    const user = userEvent.setup();
    render(<PassivesTab />);
    await user.click(screen.getByTestId("passives-sub-tab-all"));
    const cards = screen.getAllByTestId(/^path-card-/);
    expect(cards.map((c) => c.dataset.testid)).toEqual(["path-card-might", "path-card-fortitude"]);
  });

  it("the empty-state's browse affordance switches to the All-paths sub-tab", async () => {
    treeState = { data: emptyTree, isLoading: false, isError: false };
    const user = userEvent.setup();
    render(<PassivesTab />);
    await user.click(screen.getByTestId("passives-browse-affordance"));
    expect(screen.getByTestId("passives-path-browse")).toBeInTheDocument();
  });

  it("GG-51 -- the browse's search text survives the sub-tab flipping away and back", async () => {
    const user = userEvent.setup();
    render(<PassivesTab />);
    await user.click(screen.getByTestId("passives-sub-tab-all"));
    await user.type(screen.getByTestId("path-browse-search"), "for");
    expect(screen.queryByTestId("path-card-might")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("passives-sub-tab-yours"));
    expect(screen.queryByTestId("passives-path-browse")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("passives-sub-tab-all"));

    expect(screen.getByTestId("path-browse-search")).toHaveValue("for");
    expect(screen.queryByTestId("path-card-might")).not.toBeInTheDocument();
    expect(screen.getByTestId("path-card-fortitude")).toBeInTheDocument();
  });

  it("GG-51 -- the browse's query survives the whole actor sheet re-rendering while this tab stays open", () => {
    // Simulates `CommandersLayer.tsx`'s own real lifecycle: the sheet's `open` prop toggles a Radix
    // Dialog's visibility, but `ActorPanel` (and whichever tab body it currently renders) never
    // unmounts as a result -- `rerender`ing the SAME `PassivesTab` element proves the query a plain
    // `useState` here already holds survives that, exactly as `CreaturesLayer.test.tsx`'s own GG-51
    // test proves for its own layer.
    const { rerender } = render(<PassivesTab />);
    fireEvent.click(screen.getByTestId("passives-sub-tab-all"));
    fireEvent.change(screen.getByTestId("path-browse-category"), { target: { value: "primary" } });

    rerender(<PassivesTab />);

    expect(screen.getByTestId("passives-path-browse")).toBeInTheDocument();
    expect(screen.getByTestId("path-browse-category")).toHaveValue("primary");
  });
});

/**
 * passive-tree-todo.md I7 — Level 3 (spec-tree-surface.md §4, §8). Opening a cell pushes into the
 * trait detail via the SAME `openTreeId`/`setOpenTreeId` push-state pattern Level 1 -> Level 2
 * already uses, one level deeper (`openNodeId`/`setOpenNodeId`) -- these tests exercise the whole
 * push chain end to end: Level 0 -> Level 2 (via the invested-path link) -> Level 3 (via a cell) ->
 * back to Level 2 -> back to Level 0.
 */
describe("PassivesTab — Level 3 (the trait)", () => {
  beforeEach(() => {
    refetch.mockReset();
    saveTreeNodesMutateAsync.mockReset();
    saveTreeNodesMutateAsync.mockResolvedValue(readyTree);
    previewTreeMutateAsync.mockReset();
    previewTreeMutateAsync.mockResolvedValue(readyTree);
    treeState = { data: readyTree, isLoading: false, isError: false };
    aptitudesState = { data: aptitudesData, isLoading: false, isError: false };
    soulsState = { data: soulsData, isLoading: false, isError: false };
  });

  async function openMightThenNode(user: ReturnType<typeof userEvent.setup>, nodeId: string) {
    render(<PassivesTab />);
    await user.click(within(screen.getByTestId("passives-invested-might")).getByRole("button"));
    await user.click(screen.getByTestId(`lattice-cell-${nodeId}`));
  }

  it("clicking a lattice cell opens Level 3 for that exact node", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n0");
    expect(screen.getByTestId("passives-trait-detail")).toHaveTextContent("skill.might-off-t1-n0");
  });

  it("Level 3's back button returns to Level 2, not all the way to Level 0", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n0");
    await user.click(screen.getByTestId("passives-trait-back"));
    expect(screen.getByTestId("passives-lattice")).toBeInTheDocument();
    expect(screen.queryByTestId("passives-trait-detail")).not.toBeInTheDocument();
  });

  it("an owned trait shows a stepper (never a slider, never a raw NumberInput) that edits the draft", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n0");
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/depth 0/i);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByTestId("passives-trait-detail").querySelector('input[type="range"]')).toBeNull();

    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("10");
    // Nothing saved yet -- editing a draft never calls the mutation on its own (§4 rule 3).
    expect(saveTreeNodesMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("passives-trait-save")).toBeInTheDocument();
  });

  it("an available (not-yet-bought) cell opens Level 3 with no deepen control", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n2");
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/available to unlock/i);
    expect(screen.queryByTestId("passives-trait-deepen")).not.toBeInTheDocument();
  });

  it("a locked (tier not reached) cell opens Level 3 with no deepen control", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t3-n0");
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/locked/i);
    expect(screen.queryByTestId("passives-trait-deepen")).not.toBeInTheDocument();
  });

  it("an invalidated node (gate closed after purchase, D11/D12) still counts as owned and keeps its control", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t2-n0");
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/depth/i);
    expect(screen.getByTestId("passives-trait-deepen")).toBeInTheDocument();
  });

  it("a nullified trait renders INERT (Not working), never un-unlocked, and names the winner", async () => {
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n1");
    expect(screen.getByTestId("passives-trait-state")).toHaveTextContent(/depth/i); // still owned
    const notWorking = screen.getByTestId("passives-trait-not-working");
    expect(notWorking).toHaveTextContent(/not working/i);
    expect(notWorking).toHaveTextContent(/switched off by skill\.fortitude-off-t1-n0/i);
  });

  it("both sides of an exclusion print the rule and name the identical winner (D40, test 34)", async () => {
    const user = userEvent.setup();
    // The loser's own card:
    await openMightThenNode(user, "skill.might-off-t1-n1");
    const loserPrint = screen.getByTestId("passives-trait-exclusion");
    expect(loserPrint.dataset.winner).toBe("skill.fortitude-off-t1-n0");
    const loserText = loserPrint.textContent;

    await user.click(screen.getByTestId("passives-trait-back"));
    // A reroute pair's own two cards -- names the same winner on both, form included.
    await user.click(screen.getByTestId("lattice-cell-skill.might-def-t1-n0"));
    const rerouteLoserPrint = screen.getByTestId("passives-trait-exclusion");
    expect(rerouteLoserPrint.dataset.form).toBe("reroute");
    expect(rerouteLoserPrint.dataset.winner).toBe("skill.fortitude-def-t1-n0");

    expect(loserText).toContain("skill.fortitude-off-t1-n0");
  });

  it("the §8 finding is a toast, not a modal: saving a change that newly nullifies a trait names both", async () => {
    useToastStack.getState().clear();
    saveTreeNodesMutateAsync.mockResolvedValue({
      ...readyTree,
      trees: readyTree.trees.map((t) =>
        t.treeId === "might"
          ? {
              ...t,
              excludedNodes: [
                ...t.excludedNodes,
                { nodeId: "skill.might-off-t2-n0", form: "Nullification", winnerNodeId: "skill.might-off-t1-n0", isInert: true }
              ]
            }
          : t
      )
    });
    const user = userEvent.setup();
    await openMightThenNode(user, "skill.might-off-t1-n0");
    await user.click(screen.getByTestId("passives-trait-step-up"));
    await user.click(screen.getByTestId("passives-trait-save"));

    expect(saveTreeNodesMutateAsync).toHaveBeenCalledTimes(1);
    // Never a modal -- the finding lands in the SAME shared toast stack every other mutation's
    // result already uses (GG-16), not a dialog this module would have to invent (bandGuard's own
    // real-tree scan already proves no DialogShell exists anywhere in this module).
    const toasts = useToastStack.getState().toasts;
    expect(toasts.some((t) => /skill\.might-off-t2-n0 stopped working/i.test(t.title))).toBe(true);
    expect(toasts.some((t) => /switched off by skill\.might-off-t1-n0/i.test(t.message ?? ""))).toBe(true);
  });
});

/**
 * passive-tree-todo.md I8 — "The Plan object" (spec-tree-surface.md §5.1, §5.2, §5.3, §7.2). The Plan
 * is lifted to THIS component's own scope (never TraitDetail's), so it survives navigating between
 * Level 1/2/3, and round-trips through the `?plan=` URL param (GG-8) so it also survives an unmount +
 * fresh remount (the same thing a page reload or a bookmark does).
 */
describe("PassivesTab — I8: the Plan", () => {
  const treeWithUnlockCost: PassiveTreeState = {
    ...readyTree,
    unlockCostFirstPoints: 5,
    unlockCostStepPoints: 1,
    // I9 (spec-tree-surface.md §6) -- the real tuning dial, same values `PassiveTreeEndpointsTests.cs`'s
    // own `Tuning()` fixture uses (Concentration(1200, 500)), so the Plan preview's Focus line can
    // mirror the engine's own formula for these tests.
    concentrationFmaxMilli: 1200,
    concentrationWMilli: 500
  };

  beforeEach(() => {
    refetch.mockReset();
    saveTreeNodesMutateAsync.mockReset();
    saveTreeNodesMutateAsync.mockResolvedValue(readyTree);
    previewTreeMutateAsync.mockReset();
    previewTreeMutateAsync.mockResolvedValue(readyTree);
    treeState = { data: treeWithUnlockCost, isLoading: false, isError: false };
    aptitudesState = { data: aptitudesData, isLoading: false, isError: false };
    soulsState = { data: soulsData, isLoading: false, isError: false };
  });

  async function openMightLattice(user: ReturnType<typeof userEvent.setup>) {
    render(<PassivesTab />);
    await user.click(within(screen.getByTestId("passives-invested-might")).getByRole("button"));
  }

  it("renders no Plan panel while nothing is pending", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    expect(screen.queryByTestId("passives-plan-panel")).not.toBeInTheDocument();
  });

  it("Unlock quotes the real next price and adds the node to the Plan, three numbers, never one node's price alone", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    // owned count 1 (skill.might-off-t1-n0) -> the very next unlock is the 2nd node: 5 + 1*1 = 6.
    expect(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2")).toHaveTextContent(/unlock.*6 skill points/i);

    await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));

    const panel = screen.getByTestId("passives-plan-panel");
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId("plan-trait-count")).toHaveTextContent("1 new trait");
    // Cumulative(2) - Cumulative(1) = (2*5 + 1*2*1/2) - (1*5 + 0) = 11 - 5 = 6.
    expect(screen.getByTestId("plan-skill-points")).toHaveTextContent("6 skill points");
    expect(screen.getByTestId("plan-souls")).toHaveTextContent("0 souls"); // disclosed gap, not fabricated
  });

  it("no Plan panel and no Unlock price when the wire carries no unlock-cost rates (honest, not fabricated)", async () => {
    treeState = { data: readyTree, isLoading: false, isError: false }; // no unlockCostFirstPoints
    const user = userEvent.setup();
    await openMightLattice(user);
    expect(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2")).toHaveTextContent(/^unlock$/i);
    await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
    expect(screen.queryByTestId("passives-plan-panel")).not.toBeInTheDocument();
  });

  it("a Plan outlives Level 3's own panel -- a deepen edit survives closing the trait and reopening it", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0")); // owned, depth 0
    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("10");

    // Close Level 3 (back to the lattice) WITHOUT saving.
    await user.click(screen.getByTestId("passives-trait-back"));
    expect(screen.getByTestId("passives-lattice")).toBeInTheDocument();

    // Reopen the SAME trait -- I7 alone would have reset to depth 0 here (a fresh local draft
    // re-seeded from the raw server value); the lifted Plan is what keeps 10.
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0"));
    expect(screen.getByTestId("passives-trait-planned-depth")).toHaveTextContent("10");
  });

  it("GG-8: the Plan round-trips through the URL -- a fresh mount picks up a pending edit", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0"));
    await user.click(screen.getByTestId("passives-trait-step-up-10"));

    expect(window.location.search).toContain("plan=");
    expect(decodeURIComponent(window.location.search)).toContain("skill.might-off-t1-n0=10");

    // A fresh mount (simulating a reload/bookmark) with the SAME URL already in place.
    render(<PassivesTab />);
    const freshInstances = screen.getAllByTestId("passives-tab");
    const latest = freshInstances[freshInstances.length - 1]!;
    // The fresh instance starts at Level 0/1 (no push state survives a real reload) but its OWN Plan
    // seed already carries the pending edit, provable via the Plan panel's own price.
    expect(within(latest).getByTestId("passives-plan-panel")).toBeInTheDocument();
  });

  it("Revert plan clears every pending edit, removes the URL param, and closes any open panel", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0"));
    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(window.location.search).toContain("plan=");

    await user.click(screen.getByTestId("passives-plan-revert"));

    expect(screen.queryByTestId("passives-plan-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("passives-trait-detail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("passives-lattice")).not.toBeInTheDocument(); // back to Level 0/1
    expect(window.location.search).not.toContain("plan=");
  });

  it("a successful Save clears the Plan (the whole pending set, §4 rule 3)", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0"));
    await user.click(screen.getByTestId("passives-trait-step-up-10"));
    expect(screen.getByTestId("passives-plan-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("passives-trait-save"));

    expect(saveTreeNodesMutateAsync).toHaveBeenCalledTimes(1);
    expect(window.location.search).not.toContain("plan=");
  });

  it("I9: the Plan preview's Focus line reads the draft, moving as new nodes/depth are added", async () => {
    const user = userEvent.setup();
    await openMightLattice(user);

    // Owned so far: skill.might-off-t1-n0 at depth 0 -- one tree, one node, zero soul levels.
    // Unlocking a SECOND node in the same tree: H_nodes([2])=1000 (still one tree), H_souls([0])=0
    // (sum still zero) -> blend(1000,0,500)=500 -> F=1100 -> "about 2 paths", x1.10.
    await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
    const afterUnlock = screen.getByTestId("plan-focus");
    expect(afterUnlock).toHaveTextContent(/about 2 paths/i);
    expect(afterUnlock).toHaveTextContent(/×1\.10/);

    // Deepening the FIRST node to soul level 10: H_nodes unchanged (still 2 nodes, 1 tree) but
    // H_souls([10]) is now 1000 (a single tree's own soul-level group, sum=10) -> blend(1000,1000,500)
    // =1000 -> F=1200 -> "about 1 path", x1.20. Both halves of the line moved together.
    await user.click(screen.getByTestId("lattice-cell-skill.might-off-t1-n0"));
    await user.click(screen.getByTestId("passives-trait-step-up-10"));

    const afterDeepen = screen.getByTestId("plan-focus");
    expect(afterDeepen).toHaveTextContent(/about 1 path/i);
    expect(afterDeepen).toHaveTextContent(/×1\.20/);
  });

  it("I9: no Focus preview line when the wire carries no concentration tuning yet (honest, not fabricated)", async () => {
    treeState = {
      data: { ...treeWithUnlockCost, concentrationFmaxMilli: undefined, concentrationWMilli: undefined },
      isLoading: false,
      isError: false
    };
    const user = userEvent.setup();
    await openMightLattice(user);
    await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
    expect(screen.getByTestId("passives-plan-panel")).toBeInTheDocument(); // the price still renders...
    expect(screen.queryByTestId("plan-focus")).not.toBeInTheDocument(); // ...but never a fabricated Focus line
  });

  it("§7.2 part 2: the tier row names exactly one lender, the number equals its own share, never a sum", async () => {
    treeState = {
      data: {
        ...treeWithUnlockCost,
        trees: treeWithUnlockCost.trees.map((t) =>
          t.treeId === "might" ? { ...t, aptitudePoints: 175, ownAptitudePoints: 55, lenderTreeId: "fortitude" } : t
        )
      },
      isLoading: false,
      isError: false
    };
    const user = userEvent.setup();
    await openMightLattice(user);
    const sources = screen.getByTestId("tier-sources-1");
    expect(sources).toHaveTextContent("55 from might");
    expect(sources).toHaveTextContent("120 lent by fortitude");
  });

  // I8's follow-up (spec-tree-surface.md §7.2 part 5) -- "the draft preview reports what a change
  // would close." The tool is only meaningful once a hypothetical aptitude delta CAN be tried, so
  // these reuse the same Plan/lattice fixtures above with a non-empty aptitude wallet.
  describe("I8's follow-up: 'what would this close' preview", () => {
    it("renders no tool at all when the aptitude wallet is empty (honest absence, never fabricated)", async () => {
      const user = userEvent.setup();
      await openMightLattice(user); // aptitudesData.shares is {} by this block's own default
      await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
      expect(screen.getByTestId("passives-plan-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("passives-plan-close-preview")).not.toBeInTheDocument();
    });

    it("runs the hypothetical through the real preview endpoint and renders the highest-value closing sentence", async () => {
      aptitudesState = {
        data: { ...aptitudesData, shares: { Might: 10, Fortitude: 20 } },
        isLoading: false,
        isError: false
      };
      // The committed report's own "might" contributes exactly skill.might-off-t1-n0 (readyTree's
      // fixture) -- the preview reports it newly invalid, and drops tierReached, closing a tier.
      previewTreeMutateAsync.mockResolvedValue({
        ...treeWithUnlockCost,
        trees: treeWithUnlockCost.trees.map((t) =>
          t.treeId === "might" ? { ...t, tierReached: 1, invalidNodeIds: ["skill.might-off-t1-n0"] } : t
        )
      });

      const user = userEvent.setup();
      await openMightLattice(user);
      await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2")); // dirty -- the Plan panel exists

      expect(screen.getByTestId("passives-plan-close-preview")).toBeInTheDocument();
      const select = screen.getByTestId("plan-preview-aptitude-select") as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual(["Might", "Fortitude"]);

      fireEvent.change(select, { target: { value: "Might" } });
      fireEvent.change(screen.getByTestId("plan-preview-delta-input"), { target: { value: "-10" } });
      await user.click(screen.getByTestId("plan-preview-run"));

      // The draft's OWN whole node set (the merged view, including the pending unlock) travels with
      // the hypothetical -- never just the committed set, and never re-derived client-side.
      expect(previewTreeMutateAsync).toHaveBeenCalledWith({
        playerId: 1,
        body: {
          nodes: { "skill.might-off-t1-n0": 0, "skill.might-off-t1-n2": 0 },
          aptitudeDelta: { Might: -10 }
        }
      });

      const sentence = await screen.findByTestId("plan-preview-sentence");
      expect(sentence).toHaveTextContent("Closes a tier in might");
      expect(sentence).toHaveTextContent("1 of your traits would stop working");
    });

    it("clicking Preview with the untouched default selection still runs (the visible default matches what's sent)", async () => {
      aptitudesState = {
        data: { ...aptitudesData, shares: { Might: 10, Fortitude: 20 } },
        isLoading: false,
        isError: false
      };
      previewTreeMutateAsync.mockResolvedValue(treeWithUnlockCost); // a no-op hypothetical

      const user = userEvent.setup();
      await openMightLattice(user);
      await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));

      // Never touch the Select -- it visibly defaults to the first aptitude id ("Might").
      await user.click(screen.getByTestId("plan-preview-run"));

      expect(previewTreeMutateAsync).toHaveBeenCalledTimes(1);
      const call = previewTreeMutateAsync.mock.calls[0]![0] as { body: { aptitudeDelta: Record<string, number> } };
      expect(call.body.aptitudeDelta).toEqual({ Might: 0 });
      await screen.findByTestId("plan-preview-sentence");
      expect(screen.getByTestId("plan-preview-sentence")).toHaveTextContent("Nothing would change.");
    });

    it("a rejected preview (e.g. the endpoint's own aptitudeDelta.wouldGoNegative refusal) renders as an error, never a fabricated sentence", async () => {
      aptitudesState = {
        data: { ...aptitudesData, shares: { Might: 10 } },
        isLoading: false,
        isError: false
      };
      previewTreeMutateAsync.mockRejectedValue(new Error("aptitudeDelta.wouldGoNegative"));

      const user = userEvent.setup();
      await openMightLattice(user);
      await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
      await user.click(screen.getByTestId("plan-preview-run"));

      const error = await screen.findByTestId("plan-preview-error");
      expect(error).toHaveTextContent("aptitudeDelta.wouldGoNegative");
      expect(screen.queryByTestId("plan-preview-sentence")).not.toBeInTheDocument();
    });

    it("Revert plan clears a stale preview result along with the rest of the draft", async () => {
      aptitudesState = {
        data: { ...aptitudesData, shares: { Might: 10 } },
        isLoading: false,
        isError: false
      };
      previewTreeMutateAsync.mockResolvedValue({
        ...treeWithUnlockCost,
        trees: treeWithUnlockCost.trees.map((t) => (t.treeId === "might" ? { ...t, tierReached: 0 } : t))
      });

      const user = userEvent.setup();
      await openMightLattice(user);
      await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n2"));
      await user.click(screen.getByTestId("plan-preview-run"));
      await screen.findByTestId("plan-preview-sentence");

      await user.click(screen.getByTestId("passives-plan-revert"));
      expect(screen.queryByTestId("passives-plan-panel")).not.toBeInTheDocument();
    });
  });
});
