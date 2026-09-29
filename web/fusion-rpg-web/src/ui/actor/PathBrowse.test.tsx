import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeResolveReport } from "@/lib/bus";
import { EMPTY_PATH_BROWSE_QUERY, type PathBrowseQuery } from "@/contract/passivesBrowse";
import { PathBrowse } from "./PathBrowse";

/**
 * passive-tree-todo.md I4 — Level 1 ("All paths"). `PathBrowse` is a controlled component (the
 * search/category query is owned by `PassivesTab`, GG-51) so these tests drive it with a stateful
 * wrapper the same way `PassivesTab.test.tsx` mocks its own bus hooks — real behavior, no query
 * client needed since this component takes plain props.
 */

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

function Controlled({ trees, elementIds = [] }: { trees: TreeResolveReport[]; elementIds?: string[] }) {
  return <PathBrowse trees={trees} elementIds={elementIds} query={EMPTY_PATH_BROWSE_QUERY} onQueryChange={() => {}} />;
}

describe("PathBrowse — seedsmith-content-standard, passive-tree-identity-content (2026-09-08)", () => {
  it("renders a tree's real generated name and description instead of the raw id", () => {
    render(<Controlled trees={[tree({
      treeId: "ferocity", name: "Unyielding Bastion",
      description: "Rewards those who turn their body into a living fortress."
    })]} />);
    const card = screen.getByTestId("path-card-ferocity");
    expect(card).toHaveTextContent("Unyielding Bastion");
    expect(screen.getByTestId("tree-identity-description")).toHaveTextContent(
      "Rewards those who turn their body into a living fortress.");
  });

  it("falls back to the raw tree id and omits the description line for a tree with no identity yet", () => {
    render(<Controlled trees={[tree({ treeId: "fire" })]} />);
    const card = screen.getByTestId("path-card-fire");
    expect(card).toHaveTextContent("fire");
    expect(screen.queryByTestId("tree-identity-description")).not.toBeInTheDocument();
  });
});

describe("PathBrowse — ordering (§2.2 Level 1, §7.3)", () => {
  it("orders invested -> stance mates -> element match -> everything else", () => {
    const trees = [
      tree({ treeId: "onslaught" }),
      tree({ treeId: "fire", category: "Elemental" }),
      tree({ treeId: "fortitude", lenderTreeId: "might" }),
      tree({ treeId: "might", contributingNodeIds: ["n1"] })
    ];
    render(<Controlled trees={trees} elementIds={["fire"]} />);
    const cards = screen.getAllByTestId(/^path-card-/);
    expect(cards.map((c) => c.dataset.testid)).toEqual([
      "path-card-might",
      "path-card-fortitude",
      "path-card-fire",
      "path-card-onslaught"
    ]);
  });

  it("renders lent-by attribution on a stance-mate card (§7.2)", () => {
    render(<Controlled trees={[tree({ treeId: "fortitude", lenderTreeId: "might" })]} />);
    expect(screen.getByTestId("path-card-fortitude")).toHaveTextContent(/lent by might/i);
  });
});

describe("PathBrowse — the gate-less bucket (§9.1)", () => {
  it("test 30 -- gate-less paths never appear as ordered cards, and collapse into one row that sorts last", () => {
    const trees = [tree({ treeId: "might" }), tree({ treeId: "poison", category: "Status", gateState: "unproduced" })];
    render(<Controlled trees={trees} />);
    expect(screen.queryByTestId("path-card-poison")).not.toBeInTheDocument();
    expect(screen.getByTestId("path-browse-gateless-row")).toBeInTheDocument();
  });

  it("test 36 -- the row's own count is read from the report, never a typed literal", () => {
    const trees = [
      tree({ treeId: "might" }),
      tree({ treeId: "fire", category: "Elemental", gateState: "unproduced" }),
      tree({ treeId: "poison", category: "Status", gateState: "unproduced" })
    ];
    const { rerender } = render(<Controlled trees={trees} />);
    expect(screen.getByTestId("path-browse-gateless-count")).toHaveTextContent("2");

    const flipped = trees.map((t) => (t.treeId === "fire" ? { ...t, gateState: "wired" as const } : t));
    rerender(<Controlled trees={flipped} />);
    expect(screen.getByTestId("path-browse-gateless-count")).toHaveTextContent("1");
    // and the now-wired path re-enters the ordered list, with no other change.
    expect(screen.getByTestId("path-card-fire")).toBeInTheDocument();
  });

  it("expanding the row names the world, never the player -- no requirement, no have-number, no 'coming soon'", async () => {
    const user = userEvent.setup();
    render(<Controlled trees={[tree({ treeId: "poison", category: "Status", gateState: "unproduced" })]} />);
    await user.click(screen.getByTestId("path-browse-gateless-toggle"));
    const row = screen.getByTestId("path-browse-gateless-poison");
    expect(row).toHaveTextContent(/nothing in the world teaches this yet/i);
    expect(row.textContent).not.toMatch(/coming soon|locked|unlock|aptitude points/i);
  });

  it("the row does not render at all when nothing is gate-less", () => {
    render(<Controlled trees={[tree({ treeId: "might" })]} />);
    expect(screen.queryByTestId("path-browse-gateless-row")).not.toBeInTheDocument();
  });
});

describe("PathBrowse — search and category filters (§2.2)", () => {
  function ControlledWithQuery({ trees }: { trees: TreeResolveReport[] }) {
    const [query, setQuery] = useState<PathBrowseQuery>(EMPTY_PATH_BROWSE_QUERY);
    return <PathBrowse trees={trees} elementIds={[]} query={query} onQueryChange={setQuery} />;
  }

  it("search narrows to matching tree ids", async () => {
    const user = userEvent.setup();
    const trees = [tree({ treeId: "might" }), tree({ treeId: "fortitude" })];
    render(<ControlledWithQuery trees={trees} />);
    await user.type(screen.getByTestId("path-browse-search"), "for");
    expect(screen.queryByTestId("path-card-might")).not.toBeInTheDocument();
    expect(screen.getByTestId("path-card-fortitude")).toBeInTheDocument();
  });

  it("category filter narrows to one of the four offered categories (species excluded)", async () => {
    const user = userEvent.setup();
    const trees = [tree({ treeId: "fire", category: "Elemental" }), tree({ treeId: "might", category: "Primary" })];
    render(<ControlledWithQuery trees={trees} />);
    const options = screen.getAllByRole("option", { hidden: true }).map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(["all", "primary", "elemental", "status", "family"]);

    await user.selectOptions(screen.getByTestId("path-browse-category"), "elemental");
    expect(screen.queryByTestId("path-card-might")).not.toBeInTheDocument();
    expect(screen.getByTestId("path-card-fire")).toBeInTheDocument();
  });

  it("a query with no matches shows a distinct no-match state", async () => {
    const user = userEvent.setup();
    render(<ControlledWithQuery trees={[tree({ treeId: "might" })]} />);
    await user.type(screen.getByTestId("path-browse-search"), "zzz-nope");
    expect(screen.getByTestId("path-browse-no-match")).toBeInTheDocument();
  });
});

describe("PathBrowse — volume strategy (GG-50, I4 acceptance: 39 cards render windowed)", () => {
  it("at or below the render-all threshold, every card mounts with no virtualization wrapper", () => {
    const trees = Array.from({ length: 10 }, (_, i) => tree({ treeId: `p${i}` }));
    render(<Controlled trees={trees} />);
    expect(screen.getAllByTestId(/^path-card-/)).toHaveLength(10);
    expect(screen.getByTestId("path-browse-list-static")).toBeInTheDocument();
    expect(screen.queryByTestId("path-browse-list")).not.toBeInTheDocument();
  });

  it("above the threshold (the real 39-path corpus and beyond), the list switches to the virtualized wrapper", () => {
    const trees = Array.from({ length: 39 }, (_, i) => tree({ treeId: `p${i}` }));
    render(<Controlled trees={trees} />);
    expect(screen.getByTestId("path-browse-list")).toHaveAttribute("data-virtualized", "true");
    expect(screen.queryByTestId("path-browse-list-static")).not.toBeInTheDocument();
    // The exact reduced-DOM-count proof (far fewer than N cards actually mounted) needs real layout
    // measurement, which jsdom doesn't provide -- that half of GG-50's contract is proven at the E2E
    // layer (e2e/passive-tree-volume.spec.ts's own 10/100/1000 fixtures), matching how
    // CreaturesLayer's own virtualized path is proven (e2e/volume-fixtures.spec.ts), not in vitest.
  });

  it("holds the same virtualized strategy at 1000 paths -- a stress fixture, not a realistic count", () => {
    const trees = Array.from({ length: 1000 }, (_, i) => tree({ treeId: `p${i}` }));
    expect(() => render(<Controlled trees={trees} />)).not.toThrow();
    expect(screen.getByTestId("path-browse-list")).toHaveAttribute("data-virtualized", "true");
  });
});
