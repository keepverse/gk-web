import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { PactsLayer } from "./PactsLayer";

function ControlledPactsLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <PactsLayer open={open} onOpenChange={setOpen} />
    </div>
  );
}

const mockUsePlayers = vi.fn();
const mockUseCreatureRoster = vi.fn();
const mockUseSpeciesIndex = vi.fn();
const mockUseContracts = vi.fn();
const mockUsePatron = vi.fn();
const mockSetPatronMutateAsync = vi.fn();
const mockPerformRitualMutateAsync = vi.fn();
const mockReleaseContractMutateAsync = vi.fn();
const mockBuySlotMutateAsync = vi.fn();

vi.mock("@/lib/bus", () => ({
  usePlayers: () => mockUsePlayers(),
  useCreatureRoster: () => mockUseCreatureRoster(),
  useSpeciesIndex: () => mockUseSpeciesIndex(),
  // AptitudesLayer (opened by this layer's own "View build" button) mounts AptitudesPage/
  // SpeciesBuildPanel, both of which read from this same module -- stubbed here so opening the
  // nested layer in a test doesn't crash on an undefined hook, matching AptitudesLayer.test.tsx's
  // own fixture shape.
  useAptitudes: () => ({ data: { theta: 100, budget: 300, spent: 0, withinBudget: true, shares: { Might: 0 } } }),
  useSaveAptitudes: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSpeciesAptitudes: () => ({
    data: {
      speciesId: "sp-imp",
      level: 20,
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
  useSpeciesRespecPrice: () => ({
    data: { speciesId: "sp-imp", respecCount: 0, priceResource: "Soul", priceAmount: 50, everRespecced: false }
  }),
  useRespecSpecies: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("@/lib/bus/creatures", () => ({
  newCorrelationId: () => "corr-1"
}));

vi.mock("@/lib/bus/patron", () => ({
  usePatron: () => mockUsePatron(),
  useSetPatron: () => ({ mutateAsync: mockSetPatronMutateAsync })
}));

vi.mock("@/lib/bus/contracts", () => ({
  useContracts: () => mockUseContracts(),
  usePerformRitual: () => ({ mutateAsync: mockPerformRitualMutateAsync }),
  useReleaseContract: () => ({ mutateAsync: mockReleaseContractMutateAsync }),
  useBuyContractSlot: () => ({ mutateAsync: mockBuySlotMutateAsync })
}));

// Same mocking convention as CommandersLayer.test.tsx / CreaturesLayer.test.tsx's own
// navigate-to-a-route assertions: keep everything else react-router-dom really provides
// (renderWithProviders' MemoryRouter included), stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const contentCreature = {
  instanceId: "d1",
  bound: true,
  deployable: true,
  loyalty: 840,
  rank: "trusted",
  personality: "stoic",
  upkeepPerDay: 5
};

const overdueCreature = {
  instanceId: "d2",
  bound: true,
  deployable: false,
  loyalty: 380,
  rank: "insubordinate",
  personality: "cruel",
  upkeepPerDay: 8
};

const roster = {
  items: [
    {
      profile: { instanceId: "d1", speciesId: "sp-imp", rarity: "heirloom", star: 2, elementPrimary: "fire", nickname: null },
      actor: { level: 20 }
    },
    {
      profile: { instanceId: "d2", speciesId: "sp-wraith", rarity: "cultivated", star: 0, elementPrimary: "dark", nickname: null },
      actor: { level: 10 }
    }
  ]
};

const speciesIndex = new Map([
  ["sp-imp", { name: "Imp", side: "zombie", gameTypeId: 1 }],
  ["sp-wraith", { name: "Wraith", side: "zombie", gameTypeId: 2 }]
]);

function setup(opts?: { contracts?: unknown[]; patronInstanceId?: string | null }) {
  mockUsePlayers.mockReturnValue({ data: { currentPlayerId: 1 } });
  mockUseCreatureRoster.mockReturnValue({ data: roster });
  mockUseSpeciesIndex.mockReturnValue(speciesIndex);
  mockUseContracts.mockReturnValue({
    data: {
      contracts: opts?.contracts ?? [contentCreature, overdueCreature],
      capacity: { used: 2, total: 4, purchasedSlots: 0, nextSlotPrice: 500, canBuy: true, maxSlots: 8 },
      dailyTribute: 13,
      deployFloor: 200,
      loyaltyMax: 1000
    }
  });
  mockUsePatron.mockReturnValue({
    data: { patron: opts?.patronInstanceId ? { instanceId: opts.patronInstanceId } : null, switchCostSouls: 100 }
  });
}

describe("PactsLayer (T17)", () => {
  it("shows a loading state while queries are in flight, distinct from empty (GG-17)", () => {
    mockUsePlayers.mockReturnValue({ data: { currentPlayerId: 1 } });
    mockUseSpeciesIndex.mockReturnValue(speciesIndex);
    mockUseCreatureRoster.mockReturnValue({ isLoading: true, data: undefined });
    mockUseContracts.mockReturnValue({ isLoading: true, data: undefined });
    mockUsePatron.mockReturnValue({ data: { patron: null, switchCostSouls: 100 } });
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("pacts-loading")).toBeInTheDocument();
    expect(screen.queryByText("No pacts yet")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry, distinct from empty (GG-17)", async () => {
    const refetchContracts = vi.fn();
    const refetchRoster = vi.fn();
    mockUsePlayers.mockReturnValue({ data: { currentPlayerId: 1 } });
    mockUseSpeciesIndex.mockReturnValue(speciesIndex);
    mockUseCreatureRoster.mockReturnValue({ data: roster, refetch: refetchRoster });
    mockUseContracts.mockReturnValue({ isError: true, data: undefined, refetch: refetchContracts });
    mockUsePatron.mockReturnValue({ data: { patron: null, switchCostSouls: 100 } });
    const user = userEvent.setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("pacts-error")).toBeInTheDocument();

    await user.click(screen.getByText("Retry"));
    expect(refetchContracts).toHaveBeenCalled();
    expect(refetchRoster).toHaveBeenCalled();
  });

  it("shows an empty state with no bound pacts", () => {
    setup({ contracts: [] });
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    expect(screen.getByText("No pacts yet")).toBeInTheDocument();
  });

  // G4 (species-build-todo.md): the empty-state hint already named "the Creatures roster" — the
  // only place a first contract can be bound — but nothing made it reachable. This asserts the
  // action is a real, working link there, not just more specific copy.
  it("G4: the empty state's action navigates to the Creatures roster, where a contract is actually bound", async () => {
    setup({ contracts: [] });
    const user = userEvent.setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);

    const openCreatures = screen.getByTestId("pacts-empty-open-creatures");
    expect(openCreatures).toBeInTheDocument();

    await user.click(openCreatures);
    expect(mockNavigate).toHaveBeenCalledWith("/creatures");
  });

  it("a content pact offers Release, an overdue pact disables Renegotiate with its reason inline and offers Ritual instead", () => {
    setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);

    expect(screen.getByTestId("pact-release-d1")).toBeInTheDocument();
    expect(screen.queryByTestId("pact-renegotiate-d1")).not.toBeInTheDocument();

    const renegotiate = screen.getByTestId("pact-renegotiate-d2");
    expect(renegotiate).toBeDisabled();
    expect(screen.getByTestId("pact-renegotiate-reason-d2")).toHaveTextContent("Insubordinate — perform a pact ritual");
    expect(screen.getByTestId("pact-ritual-d2")).toBeInTheDocument();
  });

  it("Ritual calls the real mutation for the overdue pact's specimen", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    await user.click(screen.getByTestId("pact-ritual-d2"));
    expect(mockPerformRitualMutateAsync).toHaveBeenCalledWith({ playerId: 1, instanceId: "d2", correlationId: "corr-1" });
  });

  it("shows the patron's real aura benefit, and only a non-patron content pact offers Make patron", () => {
    setup({ patronInstanceId: "d1" });
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("pact-aura-d1")).toHaveTextContent("fire power");
    expect(screen.queryByTestId("pact-make-patron-d1")).not.toBeInTheDocument();
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<ControlledPactsLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("pacts-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("pacts-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });

  // T30 (plate 03 §D): side-by-side cards with a colour-tinted portrait, not the earlier vertical
  // stack with no portrait at all.
  it("renders pacts side by side, not stacked, each with a rarity-tinted portrait", () => {
    setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);
    expect(screen.getByTestId("pacts-grid")).toHaveClass("grid-cols-2");

    const portraits = screen.getAllByTestId("pact-portrait");
    expect(portraits).toHaveLength(2);
    // d1 is heirloom (Imp), d2 is cultivated (Wraith) — real profile.rarity on the ten-rung
    // ladder, not a fabricated palette: heirloom (ordinal 6) tints token 4, cultivated (ordinal 3)
    // tints token 2.
    expect(portraits[0]).toHaveClass("border-rarity-4");
    expect(portraits[1]).toHaveClass("border-rarity-2");
    expect(portraits[0]).toHaveTextContent("I"); // first letter of the real display name
  });

  // spec-allocation-surface.md — the chosen entry point (owner, 2026-09-05): "View build" opens
  // AptitudesLayer scoped to THAT row's own species, never a route.
  it("View build opens AptitudesLayer on the Species tab, scoped to that row's own speciesId", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<PactsLayer open onOpenChange={() => {}} />);

    await user.click(screen.getByTestId("pact-view-build-d1"));

    expect(screen.getByTestId("aptitudes-layer")).toBeInTheDocument();
    expect(screen.getByTestId("species-build-panel")).toBeInTheDocument();
    expect(screen.getByTestId("tab-species")).toHaveAttribute("aria-selected", "true");
  });

  // GG-1: opening a nested layer from this one must leave the ORIGINAL stage/layer mounted, its
  // state undisturbed — mirrors the existing "Esc closes without unmounting whatever is behind it"
  // test's own `stage-behind` harness one level up.
  it("GG-1: opening the species build view leaves Pacts (and the stage behind it) mounted, state-identical", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<ControlledPactsLayer />, { withGlobalKeys: true });

    expect(screen.getByTestId("pacts-layer")).toBeInTheDocument();
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();

    await user.click(screen.getByTestId("pact-view-build-d1"));
    expect(screen.getByTestId("aptitudes-layer")).toBeInTheDocument();
    // Pacts itself, and the stage behind it, are both still exactly where they were —
    // opening a nested layer never re-routes or unmounts either.
    expect(screen.getByTestId("pacts-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pact-release-d1")).toBeInTheDocument();
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("aptitudes-layer")).not.toBeInTheDocument());
    // Closing the nested layer returns exactly to Pacts, not further back.
    expect(screen.getByTestId("pacts-layer")).toBeInTheDocument();
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
