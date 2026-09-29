import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { SupplyView } from "@/contract/types";
import { SupplyPanel } from "./SupplyPanel";

function supplyView(overrides: Partial<SupplyView> = {}): SupplyView {
  return {
    ok: true,
    reason: "The bandage held.",
    decrementContainerId: "c-1",
    decision: pendingWithReason("test"),
    ...overrides
  };
}

describe("SupplyPanel (D5.7, spec-delve-stage.md §7 — what the party carries that can be used here)", () => {
  it("a successful outcome renders its own real, authored reason verbatim", () => {
    render(<SupplyPanel supply={known(supplyView({ ok: true, reason: "The bandage held." }))} />);
    expect(screen.getByTestId("delve-supply-outcome")).toHaveTextContent("The bandage held.");
  });

  it("a refused outcome renders distinctly from a successful one", () => {
    const { rerender } = render(<SupplyPanel supply={known(supplyView({ ok: true }))} />);
    expect(screen.getByTestId("delve-supply-outcome").className).toMatch(/text-ok/);

    rerender(<SupplyPanel supply={known(supplyView({ ok: false, reason: "Nothing left to use." }))} />);
    expect(screen.getByTestId("delve-supply-outcome")).toHaveTextContent("Nothing left to use.");
    expect(screen.getByTestId("delve-supply-outcome").className).toMatch(/text-bad/);
  });

  it("never renders decrementContainerId — an internal id, not player content", () => {
    render(<SupplyPanel supply={known(supplyView({ decrementContainerId: "c-marker-777" }))} />);
    const root = screen.getByTestId("delve-panel-supply");
    expect(root.textContent ?? "").not.toMatch(/c-marker-777/);
  });

  it("a pending supply (a room is selected, nothing composes it yet) renders its own real reason", () => {
    render(<SupplyPanel supply={pendingWithReason("What your supplies can do here isn't shown yet")} />);
    expect(screen.getByTestId("delve-supply-fallback")).toHaveTextContent(
      "What your supplies can do here isn't shown yet"
    );
  });

  it("an absent supply (no room selected) renders its own honest, distinct copy", () => {
    render(<SupplyPanel supply={absent()} />);
    expect(screen.getByTestId("delve-supply-fallback")).toHaveTextContent("Pick a room first.");
  });
});
