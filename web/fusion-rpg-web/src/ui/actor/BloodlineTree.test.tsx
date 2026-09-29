import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TreeResolveReport } from "@/lib/bus";
import { absent, known, pendingWithReason } from "@/contract/pending";
import { BloodlineTree } from "./BloodlineTree";

/**
 * passive-tree-todo.md I5 — Level 0b's read route (spec-tree-surface.md §3, §9). Verification named
 * by the todo itself: "a fixture actor with one discovered and one undiscovered bloodline renders
 * both states."
 */

function bloodlineReport(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "zomboni-bloodline",
    category: "Species",
    gateState: "wired",
    tierReached: 4,
    tiers: 10,
    aptitudePoints: 40,
    contributingNodeIds: ["n1", "n2", "n3"],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 1000,
    focusMilli: 1200,
    excludedNodes: [],
    ...overrides
  };
}

// The named fixture: one actor, two creatures, one discovered bloodline and one undiscovered one.
const fixtureActor = {
  discoveredCreature: {
    speciesName: "Zomboni Sr.",
    discovery: "discovered" as const,
    report: known(bloodlineReport({ treeId: "zomboni-bloodline", tierReached: 4 }))
  },
  undiscoveredCreature: {
    speciesName: "Gargantuar Prime",
    discovery: "undiscovered" as const,
    report: known(bloodlineReport({ treeId: "gargantuar-bloodline", tierReached: 9 }))
  }
};

describe("BloodlineTree — the discovered state", () => {
  it("renders the real tree card, named to the species", () => {
    const c = fixtureActor.discoveredCreature;
    render(<BloodlineTree speciesName={c.speciesName} discovery={c.discovery} report={c.report} />);

    expect(screen.getByTestId("bloodline-tree")).toBeInTheDocument();
    expect(screen.getByTestId("bloodline-tree")).toHaveTextContent(/Zomboni Sr\./);
    expect(screen.getByTestId("bloodline-tree")).toHaveTextContent(/bloodline/);
    expect(screen.getByTestId("path-card-zomboni-bloodline")).toBeInTheDocument();
    expect(screen.getByTestId("path-card-zomboni-bloodline")).toHaveTextContent(/tier 4 of 10/);
    expect(screen.queryByTestId("bloodline-silhouette")).not.toBeInTheDocument();
  });

  it("a merely-seen (not fully discovered) creature also renders the real tree", () => {
    render(
      <BloodlineTree
        speciesName="Imp"
        discovery="seen"
        report={known(bloodlineReport({ treeId: "imp-bloodline" }))}
      />
    );
    expect(screen.getByTestId("path-card-imp-bloodline")).toBeInTheDocument();
  });
});

describe("BloodlineTree — the undiscovered state (§9's silhouette)", () => {
  it("renders a silhouette only, never the real tree contents", () => {
    const c = fixtureActor.undiscoveredCreature;
    render(<BloodlineTree speciesName={c.speciesName} discovery={c.discovery} report={c.report} />);

    expect(screen.getByTestId("bloodline-silhouette")).toBeInTheDocument();
    expect(screen.getByTestId("bloodline-silhouette")).toHaveTextContent("???");
    expect(screen.getByTestId("bloodline-silhouette")).toHaveTextContent(/undiscovered/i);
  });

  it("never leaks the species name, tree id, or tier data even though a real report was supplied", () => {
    const c = fixtureActor.undiscoveredCreature;
    render(<BloodlineTree speciesName={c.speciesName} discovery={c.discovery} report={c.report} />);

    // The report handed in DOES carry real content (tierReached: 9, treeId "gargantuar-bloodline") --
    // this is the leak test: discovery gates the render before the report is ever consulted.
    expect(screen.queryByTestId("bloodline-tree")).not.toBeInTheDocument();
    expect(screen.queryByTestId("path-card-gargantuar-bloodline")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gargantuar Prime/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tier 9/)).not.toBeInTheDocument();
  });

  it("stays a silhouette even when the report is still pending or absent", () => {
    const { unmount } = render(
      <BloodlineTree speciesName="Gargantuar Prime" discovery="undiscovered" report={pendingWithReason("loading")} />
    );
    expect(screen.getByTestId("bloodline-silhouette")).toBeInTheDocument();
    unmount();

    render(<BloodlineTree speciesName="Gargantuar Prime" discovery="undiscovered" report={absent()} />);
    expect(screen.getByTestId("bloodline-silhouette")).toBeInTheDocument();
  });
});

describe("BloodlineTree — the two non-silhouette edge states", () => {
  it("a discovered bloodline whose report hasn't loaded yet shows a loading state, not a silhouette", () => {
    render(
      <BloodlineTree speciesName="Zomboni Sr." discovery="discovered" report={pendingWithReason("loading bloodline…")} />
    );
    expect(screen.getByTestId("bloodline-pending")).toBeInTheDocument();
    expect(screen.queryByTestId("bloodline-silhouette")).not.toBeInTheDocument();
  });

  it("a discovered bloodline with no report on file shows an empty state, not a silhouette", () => {
    render(<BloodlineTree speciesName="Zomboni Sr." discovery="discovered" report={absent()} />);
    expect(screen.getByTestId("bloodline-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("bloodline-silhouette")).not.toBeInTheDocument();
  });
});
