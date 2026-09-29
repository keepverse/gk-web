import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ExpeditionsLayer } from "./ExpeditionsLayer";

function ControlledExpeditionsLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <ExpeditionsLayer open={open} onOpenChange={setOpen} />
    </div>
  );
}

/**
 * T17 — the real, already-shipped expedition system, now reached as a band-2 layer instead of a
 * standalone route. `ExpeditionsPage`'s own hooks are left unmocked, matching T12/T15's
 * precedent: with no live server they resolve into loading/error states harmlessly in jsdom.
 */
describe("ExpeditionsLayer (T17)", () => {
  it("renders the real expeditions page inside the shared band-2 shell", () => {
    renderWithProviders(<ExpeditionsLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("expeditions-layer")).toBeInTheDocument();
    // Both the shared shell's own title and ExpeditionsPage's internal <Page title> read
    // "Expeditions" (same shape T12/T15 already accept for a wrapped legacy page) — two headings.
    expect(screen.getAllByRole("heading", { name: "Expeditions" })).toHaveLength(2);
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledExpeditionsLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("expeditions-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("expeditions-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
