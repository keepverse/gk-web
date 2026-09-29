import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FusionLayer } from "./FusionLayer";

function ControlledFusionLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <FusionLayer open={open} onOpenChange={setOpen} />
    </div>
  );
}

/**
 * T15 — the real, already-shipped Creature fusion lab, now reached as a band-2 layer instead of a
 * standalone route. `FusionPage`'s own hooks (creatures/expeditions/fusion/patron modules) are left
 * unmocked here, matching T12's `DeveloperTree.test.tsx` precedent: with no live server they
 * resolve into their own loading/error states harmlessly in jsdom rather than crashing — this is
 * a smoke test of the shell around the page, not a re-test of the page's own already-covered
 * behavior (`fusionView.test.ts`, the Core/Data/E2E suites named in spec-creature-fusion.md).
 */
describe("FusionLayer (T15)", () => {
  it("renders the real fusion lab inside the shared band-2 shell", () => {
    renderWithProviders(<FusionLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("fusion-layer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fusion" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fusion Lab" })).toBeInTheDocument();
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledFusionLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("fusion-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("fusion-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
