import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { AlmanacLayer } from "./AlmanacLayer";

function ControlledAlmanacLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <AlmanacLayer open={open} onOpenChange={setOpen} />
    </div>
  );
}

const mockUseTypes = vi.fn();
const mockUseRecipes = vi.fn();

vi.mock("@/lib/bus", () => ({
  useTypes: () => mockUseTypes(),
  useRecipes: () => mockUseRecipes()
}));

/**
 * T19 — plate 05 §A/§E: "/types and /recipes become Almanac tabs." `CatalogPage`/`RecipesPage`
 * are unchanged (same T12/T15/T17 wrap-a-real-page pattern) — this is a smoke test of the tab
 * shell around them, not a re-test of their own already-covered rendering.
 */
describe("AlmanacLayer (T19)", () => {
  it("opens on the Creatures (Types) tab by default and switching tabs swaps the surface", async () => {
    mockUseTypes.mockReturnValue({ data: [] });
    mockUseRecipes.mockReturnValue({ data: [] });
    const user = userEvent.setup();
    renderWithProviders(<AlmanacLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("almanac-surface-creatures")).toBeInTheDocument();

    await user.click(screen.getByTestId("almanac-tab-recipes"));
    await waitFor(() => expect(screen.getByTestId("almanac-surface-recipes")).toBeInTheDocument());
    expect(screen.queryByTestId("almanac-surface-creatures")).not.toBeInTheDocument();
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    mockUseTypes.mockReturnValue({ data: [] });
    mockUseRecipes.mockReturnValue({ data: [] });
    const user = userEvent.setup();
    renderWithProviders(<ControlledAlmanacLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("almanac-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("almanac-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
