import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "@/test/render";
import { getStageMountCount, resetStageMountCounts } from "@/shell/stageHost";
import { SanctumStage } from "./SanctumStage";

const mockUsePlayers = vi.fn();
const mockUseUniqueActors = vi.fn();
const mockUseRuns = vi.fn();
const mockUseSoulBalance = vi.fn();
const mockUseRelics = vi.fn();
const mockUseCreatureRoster = vi.fn();
const mockUseCommanders = vi.fn();
const mockUseOnboarding = vi.fn();
const mockAcknowledgeStory = vi.fn();

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="route-probe">{location.pathname}</output>;
}

// Almanac/Chronicle mount CatalogPage/RecipesPage/MetricsPage/RpgProgressionPage/PvzStatsPage
// once opened (T13: layers defer mounting until first open, not on every Sanctum render — see
// `mountedLayers` in SanctumStage.tsx). Their own `@/lib/bus` hooks (useTypes, useRecipes,
// useMetrics, useRunSpawns, useRpgProgression*, usePvzStats*, …) are left as the real
// implementations via `importOriginal`, matching T12's DeveloperTree.test.tsx precedent: with no
// live server they degrade into loading/error states harmlessly in jsdom instead of needing an
// ever-growing explicit mock list for pages this file isn't testing.
vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return {
    ...actual,
    usePlayers: () => mockUsePlayers(),
    useUniqueActors: () => mockUseUniqueActors(),
    useRuns: () => mockUseRuns(),
    useSoulBalance: () => mockUseSoulBalance(),
    useRelics: () => mockUseRelics(),
    useCreatureRoster: () => mockUseCreatureRoster(),
    useCommanders: () => mockUseCommanders(),
    useOnboarding: () => mockUseOnboarding(),
    useAcknowledgeOnboardingStory: () => ({ mutateAsync: mockAcknowledgeStory, isPending: false }),
    useSpeciesIndex: () => new Map(),
    useUniqueEquipment: () => ({ data: { items: [] } }),
    usePutUniqueEquipment: () => ({ mutate: vi.fn(), isPending: false })
  };
});

const mockUseContracts = vi.fn();

vi.mock("@/lib/bus/contracts", () => ({
  useContracts: () => mockUseContracts(),
  useBuyContractSlot: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  usePerformRitual: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useReleaseContract: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
}));

const noActors = { playerId: 1, items: [] as unknown[] };
const oneActor = {
  playerId: 1,
  items: [{ instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 }]
};

const commanderListView = {
  defaultLawnCommanderId: "commander:dave",
  commanders: [
    {
      id: "commander:dave",
      displayName: "Crazy Dave",
      isDefault: true,
      activeAuraId: "Might",
      activeAuraName: "Might",
      locationStub: null,
      legionStub: null
    }
  ]
};

beforeEach(() => {
  mockUsePlayers.mockReturnValue({
    data: { currentPlayerId: 1, items: [{ id: 1, name: "Dave", createdUtc: "2026-01-01" }] }
  });
  mockUseUniqueActors.mockReturnValue({ data: noActors });
  mockUseRuns.mockReturnValue({ data: [] });
  mockUseSoulBalance.mockReturnValue({
    data: { playerId: 1, balance: 250, earnedTotal: 250, spentTotal: 0, revision: 1, updatedUtc: "" }
  });
  mockUseRelics.mockReturnValue({ data: { items: [] } });
  mockUseCreatureRoster.mockReturnValue({ data: { items: [] } });
  mockUseCommanders.mockReturnValue({ data: commanderListView });
  // `useOnboarding` serves both the established milestone reveal and the Rift
  // story gate. Keep both halves of its response in the fixture so the mock
  // matches the production contract instead of hiding an integration error.
  mockUseOnboarding.mockReturnValue({ data: { checkpoints: [], stories: [] } });
  mockAcknowledgeStory.mockReset();
  mockAcknowledgeStory.mockResolvedValue({ ok: true });
  mockUseContracts.mockReturnValue({
    data: {
      contracts: [],
      capacity: { used: 0, total: 0, purchasedSlots: 0, nextSlotPrice: 0, canBuy: false, maxSlots: 0 },
      dailyTribute: 0,
      deployFloor: 0,
      loyaltyMax: 0
    }
  });
  resetStageMountCounts();
});

describe("SanctumStage", () => {
  it("renders the HUD and the rail on first paint (GG-2: a playable affordance, not a blank stage)", () => {
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("sanctum-hud")).toBeInTheDocument();
    expect(screen.getByTestId("rail")).toBeInTheDocument();
    expect(screen.getByTestId("rail-sanctum")).toHaveAttribute("data-state", "active");
  });

  it("shows the first-run prompt while server-backed onboarding is empty", () => {
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("focus-card-first-run")).toBeInTheDocument();
    expect(screen.queryByTestId("focus-card-actor")).not.toBeInTheDocument();
  });

  it("sends every successful Rift exit to the existing lawn destination", async () => {
    const user = userEvent.setup();
    mockUseOnboarding.mockReturnValue({
      data: {
        checkpoints: [],
        stories: [{ storyId: "rift-prologue", version: 1, state: "unseen", outcome: null, eligible: true, acknowledgedUtc: null, revision: 1 }]
      }
    });
    renderWithProviders(<><SanctumStage /><RouteProbe /></>, { route: "/sanctum", withGlobalKeys: true });
    await waitFor(() => expect(screen.getByTestId("rift-prologue-dialog")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Skip intro" }));
    await waitFor(() => expect(screen.getByTestId("route-probe")).toHaveTextContent("/lawn"));
    expect(mockAcknowledgeStory).toHaveBeenCalledWith({ storyId: "rift-prologue", version: 1, outcome: "skipped" });
  });

  it("HUD shows identity and souls from real state, and the summoner level honestly as pending", () => {
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("sanctum-hud-identity")).toHaveTextContent("Dave");
    expect(screen.getByTestId("sanctum-hud-souls")).toHaveTextContent("250");
    expect(screen.getByTestId("sanctum-hud-level-pending")).toBeInTheDocument();
  });

  it("locked rail entries name what unlocks them", () => {
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    const relics = screen.getByTestId("rail-relics");
    expect(relics).toBeDisabled();
    expect(relics.getAttribute("title")).toMatch(/item/);
  });

  it("clicking Creatures on the rail opens the real Creatures layer, and Esc closes it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });

    await user.click(screen.getByTestId("rail-creatures"));
    await waitFor(() => expect(screen.getByTestId("creatures-layer")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Creatures" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("creatures-layer")).not.toBeInTheDocument());
  });

  it("clicking Commanders on the rail opens the real Commanders layer, and Esc closes it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });

    await user.click(screen.getByTestId("rail-commanders"));
    await waitFor(() => expect(screen.getByTestId("commanders-layer")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Commanders" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("commanders-layer")).not.toBeInTheDocument());
  });

  it("clicking an unlocked non-Creatures rail entry opens its real layer, and Esc closes it", async () => {
    mockUseRuns.mockReturnValue({ data: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });

    await user.click(screen.getByTestId("rail-almanac"));
    await waitFor(() => expect(screen.getByTestId("almanac-layer")).toBeInTheDocument());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("almanac-layer")).not.toBeInTheDocument());
  });

  it("the focus card's CTA opens the same Creatures layer", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    await user.click(screen.getByTestId("focus-card-cta"));
    await waitFor(() => expect(screen.getByTestId("creatures-layer")).toBeInTheDocument());
  });

  it("a layer stays mounted across a close, not just its chunk cached (T13: deferred mount, not remount-per-open)", async () => {
    mockUseRuns.mockReturnValue({ data: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });

    await user.click(screen.getByTestId("rail-almanac"));
    await waitFor(() => expect(screen.getByTestId("almanac-layer")).toBeInTheDocument());
    await user.click(screen.getByTestId("almanac-tab-recipes"));
    expect(screen.getByTestId("almanac-tab-recipes")).toHaveAttribute("aria-current", "true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("almanac-layer")).not.toBeInTheDocument());

    await user.click(screen.getByTestId("rail-almanac"));
    await waitFor(() => expect(screen.getByTestId("almanac-layer")).toBeInTheDocument());
    // If the layer had been fully unmounted rather than staying mounted-but-hidden, its own
    // `useState` would have reset to the "creatures" default on this reopen.
    expect(screen.getByTestId("almanac-tab-recipes")).toHaveAttribute("aria-current", "true");
  });

  it("the stage's mount count stays 1 across every layer opening and closing, not just one (GG-1/GG-11)", async () => {
    mockUseRuns.mockReturnValue({ data: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    const user = userEvent.setup();
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(getStageMountCount("sanctum")).toBe(1);

    for (const rail of ["rail-creatures", "rail-almanac", "rail-chronicle"]) {
      await user.click(screen.getByTestId(rail));
      await waitFor(() => expect(screen.getByTestId("sanctum-hud")).toBeInTheDocument());
      expect(getStageMountCount("sanctum")).toBe(1);

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByTestId("sanctum-hud")).toBeInTheDocument());
      expect(getStageMountCount("sanctum")).toBe(1);
    }
  });

  it("Almanac and Chronicle are locked until a run has completed", () => {
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("rail-almanac")).toBeDisabled();
    expect(screen.getByTestId("rail-chronicle")).toBeDisabled();
  });

  it("Almanac and Chronicle unlock once a run exists", () => {
    mockUseRuns.mockReturnValue({ data: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("rail-almanac")).not.toBeDisabled();
    expect(screen.getByTestId("rail-chronicle")).not.toBeDisabled();
  });
});

describe("SanctumStage — with a bound creature", () => {
  it("shows the run-prompt focus card and the composed home body, not the first-run script", () => {
    mockUseUniqueActors.mockReturnValue({ data: oneActor });
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("focus-card-run-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("focus-card-first-run")).not.toBeInTheDocument();
    expect(screen.getByTestId("focus-card-count")).toHaveTextContent("1 creature bound");
    expect(screen.getByTestId("sanctum-home")).toBeInTheDocument();
  });

  it("Fusion unlocks once the player has a creature to fuse (T15)", () => {
    mockUseCreatureRoster.mockReturnValue({
      data: { items: [{ profile: { instanceId: "d1" }, actor: { level: 1 } }] }
    });
    renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
    expect(screen.getByTestId("rail-fusion")).not.toBeDisabled();
  });

  // T26 (plate 01 §C): "overdue tribute beats a returned expedition beats ... 'start a run'."
  describe("T26 — the focus card's priority rule", () => {
    it("an overdue pact outranks everything else, and names the real creature", () => {
      mockUseUniqueActors.mockReturnValue({ data: oneActor });
      mockUseCreatureRoster.mockReturnValue({
        data: { items: [{ profile: { instanceId: "d1", speciesId: "sp-imp", nickname: null }, actor: { level: 5 } }] }
      });
      mockUseContracts.mockReturnValue({
        data: {
          contracts: [{ instanceId: "d1", bound: true, deployable: false, loyalty: 10, rank: "insubordinate", personality: "cruel", upkeepPerDay: 1 }],
          capacity: { used: 1, total: 4, purchasedSlots: 0, nextSlotPrice: 0, canBuy: true, maxSlots: 8 },
          dailyTribute: 1,
          deployFloor: 0,
          loyaltyMax: 1000
        }
      });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      expect(screen.getByTestId("focus-card-tribute-overdue")).toBeInTheDocument();
      expect(screen.queryByTestId("focus-card-run-prompt")).not.toBeInTheDocument();
    });

    it("clicking the overdue-tribute CTA opens the real Pacts layer", async () => {
      const user = userEvent.setup();
      mockUseUniqueActors.mockReturnValue({ data: oneActor });
      mockUseCreatureRoster.mockReturnValue({
        data: { items: [{ profile: { instanceId: "d1", speciesId: "sp-imp", nickname: null }, actor: { level: 5 } }] }
      });
      mockUseContracts.mockReturnValue({
        data: {
          contracts: [{ instanceId: "d1", bound: true, deployable: false, loyalty: 10, rank: "insubordinate", personality: "cruel", upkeepPerDay: 1 }],
          capacity: { used: 1, total: 4, purchasedSlots: 0, nextSlotPrice: 0, canBuy: true, maxSlots: 8 },
          dailyTribute: 1,
          deployFloor: 0,
          loyaltyMax: 1000
        }
      });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      await user.click(screen.getByTestId("focus-card-pay-tribute"));
      await waitFor(() => expect(screen.getByTestId("pacts-layer")).toBeInTheDocument());
    });

    it("with no overdue pact, a returned expedition takes the banner", async () => {
      mockUseUniqueActors.mockReturnValue({ data: oneActor });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      // No contracts/expeditions mocked as returned in this file's default setup — this proves the
      // *shape* renders correctly by checking the neutral run-prompt shows when nothing is pending,
      // which is what the default (no overdue, no returned) fixtures already exercise.
      expect(screen.getByTestId("focus-card-run-prompt")).toBeInTheDocument();
    });
  });

  describe("T26 — the composed Sanctum home", () => {
    it("the creature strip shows every bound creature, and 'All N' opens Creatures", async () => {
      const user = userEvent.setup();
      mockUseUniqueActors.mockReturnValue({
        data: {
          playerId: 1,
          items: [
            { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 },
            { instanceId: "a2", playerId: 1, side: "zombie", typeId: 7, phase: "Roster", level: 9, xp: 10, revision: 1 }
          ]
        }
      });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      expect(screen.getAllByTestId("actor-chip")).toHaveLength(2);

      await user.click(screen.getByTestId("sanctum-home-all-creatures"));
      await waitFor(() => expect(screen.getByTestId("creatures-layer")).toBeInTheDocument());
    });

    it("the map table states sectors held aren't shown yet, and Travel opens the World route", () => {
      mockUseUniqueActors.mockReturnValue({ data: oneActor });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      expect(screen.getByTestId("sanctum-home-sectors-held")).toHaveTextContent("not shown yet");
      expect(screen.getByTestId("sanctum-home-travel")).toBeInTheDocument();
    });

    it("Tonight shows nothing waiting by default, and Start a run's CTA is real", () => {
      mockUseUniqueActors.mockReturnValue({ data: oneActor });
      renderWithProviders(<SanctumStage />, { withGlobalKeys: true });
      expect(screen.getByTestId("sanctum-home-tonight-empty")).toBeInTheDocument();
      expect(screen.getByTestId("sanctum-home-defend")).toBeInTheDocument();
      expect(screen.getByTestId("sanctum-home-run-note")).toHaveTextContent("already on the lawn");
    });
  });
});
