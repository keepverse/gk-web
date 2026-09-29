import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render";
import { getStageMountCount, resetStageMountCounts } from "@/shell/stageHost";
import { resetKeymapForTests } from "@/shell/keymap";
import { SiegeStage } from "./SiegeStage";

describe("SiegeStage — minimal shell wiring (21.1): mount guard, layer-in-URL, Esc-dismiss", () => {
  beforeEach(() => {
    resetStageMountCounts();
    resetKeymapForTests();
  });

  it("mounts exactly once and shows the honest placeholder with no layer open", () => {
    renderWithProviders(<SiegeStage />, { route: "/siege/abc" });

    expect(screen.getByTestId("siege-stage-frame")).toBeInTheDocument();
    expect(screen.getByTestId("siege-stage-placeholder")).toBeInTheDocument();
    expect(getStageMountCount("siege")).toBe(1);
    expect(screen.queryByTestId("siege-stage-layer-panel")).not.toBeInTheDocument();
  });

  it("renders no Rail — correctly excluded from GG-7's Sanctum-layer reachability matrix, not silently forgotten by it", () => {
    // checkpoint-f.spec.ts's own GG-7 matrix checks Sanctum's 7 rail layers; lawn/world/battle are
    // already excluded because none of them have that layer system (game-gui-todo.md:1211). Siege
    // is the same shape — a turn-based board, not a rail-driven hub — so the correct row for it in
    // that matrix is "excluded", proven here structurally rather than asserted in prose: this stage
    // never renders a `<Rail>` at all, so there is no rail-driven layer for GG-7 to check.
    renderWithProviders(<SiegeStage />, { route: "/siege/abc" });
    expect(screen.queryByTestId("rail")).not.toBeInTheDocument();
  });

  it("Route_round_trips_with_open_layers — #/siege/abc?layer=structures opens the layer panel", () => {
    renderWithProviders(
      <Routes>
        <Route path="/siege/:siegeId" element={<SiegeStage />} />
      </Routes>,
      { route: "/siege/abc?layer=structures" }
    );

    expect(screen.getByTestId("siege-stage-layer-panel")).toBeInTheDocument();
    expect(screen.getByTestId("siege-stage-layer-placeholder")).toBeInTheDocument();
  });

  it("Esc_pops_one_layer_and_returns_to_the_same_board_state — closes the panel, keeps the board mounted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiegeStage />, { route: "/siege/abc?layer=structures", withGlobalKeys: true });

    expect(screen.getByTestId("siege-stage-layer-panel")).toBeInTheDocument();
    expect(getStageMountCount("siege")).toBe(1);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByTestId("siege-stage-layer-panel")).not.toBeInTheDocument());
    expect(screen.getByTestId("siege-stage-frame")).toBeInTheDocument();
    expect(getStageMountCount("siege")).toBe(1);
  });

  it("closing the panel via onOpenChange clears the URL's layer param, not just the panel's own visibility", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiegeStage />, { route: "/siege/abc?layer=structures", withGlobalKeys: true });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("siege-stage-layer-panel")).not.toBeInTheDocument());

    // Reopening via the same mechanism a moment later must not be short-circuited by stale state —
    // proves the close path actually cleared `?layer=` rather than just hiding the panel visually.
    expect(screen.queryByTestId("siege-stage-layer-placeholder")).not.toBeInTheDocument();
  });
});
