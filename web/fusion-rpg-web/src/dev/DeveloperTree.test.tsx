import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DEV_SURFACES, DeveloperTree } from "./DeveloperTree";

// The nine real pages inside the tree are unchanged from v1 (T12 only changes how they're
// reached) and already fetch real data via react-query; in jsdom with no live server those
// requests simply fail into each page's own loading/error state rather than crashing, so no
// bus mocking is needed here — this is a real smoke test of the tree shell around them.

describe("DeveloperTree (T12)", () => {
  it("declares the developer surfaces including the scene-switch POC tab", () => {
    expect(DEV_SURFACES.map((s) => s.id).sort()).toEqual(
      [
        "almanac-dump",
        // item-content module `atom-preview` (T9) — the container preview surface.
        "atom-preview",
        "cheats",
        "icon-dump",
        "phaser-scene-poc",
        "pvz-activity",
        "runs",
        "sim",
        "stats",
        "status"
      ].sort()
    );
  });

  it("opens on the Status tab by default and switching tabs swaps the surface", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeveloperTree open onOpenChange={() => {}} />, { withGlobalKeys: true });
    expect(screen.getByTestId("dev-tree-surface-status")).toBeInTheDocument();

    await user.click(screen.getByTestId("dev-tree-tab-cheats"));
    await waitFor(() => expect(screen.getByTestId("dev-tree-surface-cheats")).toBeInTheDocument());
    expect(screen.queryByTestId("dev-tree-surface-status")).not.toBeInTheDocument();
  });

  it("opens directly on a requested initial tab", () => {
    renderWithProviders(<DeveloperTree open onOpenChange={() => {}} initialTab="runs" />, { withGlobalKeys: true });
    expect(screen.getByTestId("dev-tree-surface-runs")).toBeInTheDocument();
  });

  it("obeys the shared shell: Esc closes it like any other band-2 layer", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(<DeveloperTree open onOpenChange={onOpenChange} />, { withGlobalKeys: true });
    expect(screen.getByTestId("dev-tree")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
