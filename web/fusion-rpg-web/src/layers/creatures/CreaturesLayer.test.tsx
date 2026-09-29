import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreaturesLayer } from "./CreaturesLayer";
import { ACTOR_COLLECTION_SEARCH_FIRST_ABOVE } from "@/ui/lawn/lawnPresentationTokens";

function ControlledCreaturesLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <CreaturesLayer open={open} onOpenChange={setOpen} playerId={1} selectedId={null} onSelect={() => {}} />
    </div>
  );
}

const mockUseUniqueActors = vi.fn();
vi.mock("@/lib/bus", () => ({ useUniqueActors: () => mockUseUniqueActors() }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const actors = [
  { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 },
  { instanceId: "a2", playerId: 1, side: "zombie", typeId: 7, phase: "ActiveBound", level: 12, xp: 200, revision: 1 }
];

describe("CreaturesLayer (T10)", () => {
  it("shows a loading state while the query is in flight, distinct from empty (GG-17)", () => {
    mockUseUniqueActors.mockReturnValue({ isLoading: true, data: undefined });
    renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("creatures-loading")).toBeInTheDocument();
    expect(screen.queryByText("No creatures bound yet")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry, distinct from empty (GG-17)", async () => {
    const refetch = vi.fn();
    mockUseUniqueActors.mockReturnValue({ isError: true, data: undefined, refetch });
    const user = userEvent.setup();
    renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("creatures-error")).toBeInTheDocument();
    expect(screen.queryByText("No creatures bound yet")).not.toBeInTheDocument();

    await user.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an empty state with no bound creatures", () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: [] } });
    renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("No creatures bound yet")).toBeInTheDocument();
  });

  it("renders a row per bound creature with side, level and no typeId anywhere", () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
    renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("creatures-item-a1")).toBeInTheDocument();
    expect(screen.getByTestId("creatures-item-a2")).toBeInTheDocument();
    expect(screen.getAllByTestId("actor-level")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/typeId/i);
  });

  it("selecting a row shows its detail card, and re-clicking deselects", async () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
    const user = userEvent.setup();
    let selected: string | null = null;
    const onSelect = vi.fn((id: string | null) => {
      selected = id;
    });
    const { rerender } = renderWithProviders(
      <CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={selected} onSelect={onSelect} />
    );

    await user.click(screen.getByTestId("creatures-item-a1"));
    expect(onSelect).toHaveBeenCalledWith("a1");

    rerender(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId="a1" onSelect={onSelect} />);
    expect(screen.getByTestId("creatures-detail")).toBeInTheDocument();

    await user.click(screen.getByTestId("creatures-item-a1"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("Deploy to the lawn appears only for a Roster-phase creature, and navigates with its instanceId (T22)", async () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId="a2" onSelect={() => {}} />
    );
    // a2 is ActiveBound — already deployed, no Deploy affordance.
    expect(screen.queryByTestId("creatures-deploy")).not.toBeInTheDocument();

    rerender(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId="a1" onSelect={() => {}} />);
    const deploy = screen.getByTestId("creatures-deploy");
    await user.click(deploy);
    expect(mockNavigate).toHaveBeenCalledWith("/lawn?deploy=a1");
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
    const user = userEvent.setup();
    renderWithProviders(<ControlledCreaturesLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("creatures-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("creatures-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });

  // T27 (plate 02 §A/§D, GG-50/GG-51): search/filter/sort, and the three-tier volume model.
  describe("T27 — search, filter, sort and volume tiers", () => {
    it("the side filter narrows the list to real, already-known data (no fabricated name search)", async () => {
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
      const user = userEvent.setup();
      renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
      expect(screen.getByTestId("creatures-item-a1")).toBeInTheDocument();
      expect(screen.getByTestId("creatures-item-a2")).toBeInTheDocument();

      await user.selectOptions(screen.getByTestId("creatures-side"), "zombie");
      expect(screen.queryByTestId("creatures-item-a1")).not.toBeInTheDocument();
      expect(screen.getByTestId("creatures-item-a2")).toBeInTheDocument();
    });

    it("search matches the real fields a row renders (side/level/phase), not a name that doesn't exist yet", async () => {
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
      const user = userEvent.setup();
      renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);

      await user.type(screen.getByTestId("creatures-search"), "lvl 12");
      expect(screen.queryByTestId("creatures-item-a1")).not.toBeInTheDocument();
      expect(screen.getByTestId("creatures-item-a2")).toBeInTheDocument();
    });

    it("a search/filter with no matches shows a distinct no-match state, not the unfiltered list or the empty-roster state", async () => {
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
      const user = userEvent.setup();
      renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);

      await user.type(screen.getByTestId("creatures-search"), "lvl 999");
      expect(screen.getByTestId("creatures-no-match")).toBeInTheDocument();
      expect(screen.queryByText("No creatures bound yet")).not.toBeInTheDocument();
    });

    it("sort reorders the rendered list by level", async () => {
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
      const user = userEvent.setup();
      renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);

      // default: level-desc — a2 (12) before a1 (5).
      let rows = screen.getAllByTestId(/^creatures-item-/);
      expect(rows.map((r) => r.dataset.testid)).toEqual(["creatures-item-a2", "creatures-item-a1"]);

      await user.selectOptions(screen.getByTestId("creatures-sort"), "level-asc");
      rows = screen.getAllByTestId(/^creatures-item-/);
      expect(rows.map((r) => r.dataset.testid)).toEqual(["creatures-item-a1", "creatures-item-a2"]);
    });

    it("above 240, the grid starts empty (search-first) until a search or filter narrows it — GG-50's third tier", async () => {
      const many = Array.from({ length: ACTOR_COLLECTION_SEARCH_FIRST_ABOVE + 1 }, (_, i) => ({
        instanceId: `m${i}`,
        playerId: 1,
        side: i % 2 === 0 ? "plant" : "zombie",
        typeId: i + 1,
        phase: "Roster",
        level: 1 + (i % 60),
        xp: 0,
        revision: 1
      }));
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: many } });
      const user = userEvent.setup();
      renderWithProviders(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);

      expect(screen.getByTestId("creatures-search-first")).toBeInTheDocument();
      expect(screen.queryByTestId("creatures-list")).not.toBeInTheDocument();

      await user.selectOptions(screen.getByTestId("creatures-side"), "zombie");
      expect(screen.queryByTestId("creatures-search-first")).not.toBeInTheDocument();
    });

    it("search/filter/sort state survives the layer closing and reopening within the session (GG-51)", async () => {
      mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
      const user = userEvent.setup();
      // `rerender` reuses the same `CreaturesLayer` element/component instance across the `open`
      // prop flipping — exactly what `SanctumStage.tsx`'s `mountedLayers` gate does in the real app
      // (a layer, once opened, stays mounted; only `open` toggles PanelShell's own visibility).
      const { rerender } = renderWithProviders(
        <CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />
      );

      await user.selectOptions(screen.getByTestId("creatures-side"), "zombie");
      await user.selectOptions(screen.getByTestId("creatures-sort"), "level-asc");
      expect(screen.queryByTestId("creatures-item-a1")).not.toBeInTheDocument();

      rerender(<CreaturesLayer open={false} onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);
      rerender(<CreaturesLayer open onOpenChange={() => {}} playerId={1} selectedId={null} onSelect={() => {}} />);

      expect(screen.getByTestId("creatures-side")).toHaveValue("zombie");
      expect(screen.getByTestId("creatures-sort")).toHaveValue("level-asc");
      expect(screen.queryByTestId("creatures-item-a1")).not.toBeInTheDocument();
    });
  });
});
