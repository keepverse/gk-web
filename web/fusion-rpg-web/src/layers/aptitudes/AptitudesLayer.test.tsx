import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AptitudesLayer } from "./AptitudesLayer";

vi.mock("@/lib/bus", () => ({
  usePlayers: () => ({ data: { currentPlayerId: 1 } }),
  useAptitudes: () => ({ data: { theta: 100, budget: 300, spent: 0, withinBudget: true, shares: { Might: 0 } } }),
  useSaveAptitudes: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSpeciesAptitudes: () => ({
    data: {
      speciesId: "fumeshroom",
      level: 21,
      budget: 1000,
      spent: 1000,
      withinBudget: true,
      hasOverride: false,
      shares: { Might: 500 },
      baseline: { Might: 500 }
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  }),
  useSpeciesRespecPrice: () => ({ data: { speciesId: "fumeshroom", respecCount: 0, priceResource: "Soul", priceAmount: 50, everRespecced: false } }),
  useRespecSpecies: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("@/lib/bus/creatures", () => ({
  newCorrelationId: () => "corr-1"
}));

vi.mock("@/lib/bus/aptitudePresets", () => ({
  probeAptitudePresetsApi: vi.fn(async () => true),
  useAptitudePresetActive: () => ({ data: { presetId: null }, isLoading: false })
}));

describe("AptitudesLayer", () => {
  it("with no speciesId, opens on the Commander tab and names the missing selection on the Species tab", async () => {
    const user = userEvent.setup();
    render(<AptitudesLayer open onOpenChange={() => {}} />);

    expect(screen.getByTestId("aptitude-input-Might")).toBeInTheDocument(); // Commander tab's own content

    await user.click(screen.getByTestId("tab-species"));
    expect(screen.getByTestId("species-build-no-selection")).toBeInTheDocument();
  });

  it("opening with a speciesId goes straight to the Species tab for that species", () => {
    render(<AptitudesLayer open onOpenChange={() => {}} speciesId="fumeshroom" />);
    expect(screen.getByTestId("species-build-panel")).toBeInTheDocument();
    expect(screen.getByTestId("tab-species")).toHaveAttribute("aria-selected", "true");
  });

  it("switching to a DIFFERENT species while open re-opens straight to that species' tab", () => {
    const { rerender } = render(<AptitudesLayer open onOpenChange={() => {}} speciesId="fumeshroom" />);
    expect(screen.getByTestId("species-build-panel")).toBeInTheDocument();

    rerender(<AptitudesLayer open onOpenChange={() => {}} speciesId="peashooter" />);
    expect(screen.getByTestId("tab-species")).toHaveAttribute("aria-selected", "true");
  });
});
