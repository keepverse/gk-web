import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ChronicleLayer } from "./ChronicleLayer";

function ControlledChronicleLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <ChronicleLayer open={open} onOpenChange={setOpen} />
    </div>
  );
}

/**
 * T19 — plate 05 §C/§E: "/runs, /rpg-progression and /pvz-stats become tabs of one Chronicle."
 * `MetricsPage`/`RpgProgressionPage`/`PvzStatsPage` are unchanged (same T12/T15/T17 wrap pattern)
 * and left unmocked here, matching `DeveloperTree.test.tsx`'s precedent: with no live server they
 * resolve into their own loading/error states harmlessly in jsdom.
 */
describe("ChronicleLayer (T19)", () => {
  it("opens on the Runs tab by default and switching tabs swaps the surface", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChronicleLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("chronicle-surface-runs")).toBeInTheDocument();

    await user.click(screen.getByTestId("chronicle-tab-growth"));
    await waitFor(() => expect(screen.getByTestId("chronicle-surface-growth")).toBeInTheDocument());
    expect(screen.queryByTestId("chronicle-surface-runs")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("chronicle-tab-pvz-stats"));
    await waitFor(() => expect(screen.getByTestId("chronicle-surface-pvz-stats")).toBeInTheDocument());
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledChronicleLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("chronicle-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("chronicle-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
