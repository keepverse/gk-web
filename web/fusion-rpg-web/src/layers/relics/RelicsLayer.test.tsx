import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { RelicsLayer } from "./RelicsLayer";

function ControlledRelicsLayer() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div data-testid="stage-behind">Sanctum content</div>
      <RelicsLayer open={open} onOpenChange={setOpen} playerId={1} />
    </div>
  );
}

const mockUseUniqueActors = vi.fn();
const mockUseRelics = vi.fn();
const mockUseUniqueEquipment = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/lib/bus", () => ({
  useUniqueActors: () => mockUseUniqueActors(),
  useRelics: () => mockUseRelics(),
  useUniqueEquipment: () => mockUseUniqueEquipment(),
  usePutUniqueEquipment: () => ({ mutate: mockMutate, isPending: false })
}));

const actors = [
  { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 }
];

const relics = [
  {
    id: "relic.ashen_reliquary",
    name: "Ashen Reliquary",
    rarity: 4,
    slot: "weapon",
    description: "A reliquary warm to the touch. Channels raw offense.",
    effectId: "fx.passive_atk_flat"
  },
  {
    id: "relic.sunworn_charm",
    name: "Sunworn Charm",
    rarity: 2,
    slot: "weapon",
    description: "A sun-bleached charm, favoring survival over aggression.",
    effectId: "fx.shield_grant"
  },
  {
    id: "relic.tidewrack_band",
    name: "Tidewrack Band",
    rarity: 3,
    slot: "armor",
    description: "Salt-crusted band pulled from a flooded lawn.",
    effectId: "fx.cold_on_hit"
  }
];

function setup(opts?: { equipped?: { slot: string; itemId: string }[] }) {
  mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: actors } });
  mockUseRelics.mockReturnValue({ data: { items: relics } });
  mockUseUniqueEquipment.mockReturnValue({ data: { items: opts?.equipped ?? [] } });
}

describe("RelicsLayer (T14)", () => {
  it("shows a loading state while queries are in flight, distinct from empty (GG-17)", () => {
    mockUseUniqueActors.mockReturnValue({ isLoading: true, data: undefined });
    mockUseRelics.mockReturnValue({ data: { items: relics } });
    mockUseUniqueEquipment.mockReturnValue({ data: { items: [] } });
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("relics-loading")).toBeInTheDocument();
    expect(screen.queryByText("No creatures bound yet")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry, distinct from empty (GG-17)", async () => {
    const refetchActors = vi.fn();
    const refetchRelics = vi.fn();
    mockUseUniqueActors.mockReturnValue({ isError: true, data: undefined, refetch: refetchActors });
    mockUseRelics.mockReturnValue({ data: { items: relics }, refetch: refetchRelics });
    mockUseUniqueEquipment.mockReturnValue({ data: { items: [] } });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("relics-error")).toBeInTheDocument();

    await user.click(screen.getByText("Retry"));
    expect(refetchActors).toHaveBeenCalled();
    expect(refetchRelics).toHaveBeenCalled();
  });

  it("shows an empty state with no bound creatures — nothing to equip a relic to yet", () => {
    mockUseUniqueActors.mockReturnValue({ data: { playerId: 1, items: [] } });
    mockUseRelics.mockReturnValue({ data: { items: relics } });
    mockUseUniqueEquipment.mockReturnValue({ data: { items: [] } });
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByText("No creatures bound yet")).toBeInTheDocument();
  });

  it("Held tab lists the real seeded catalog, and marks the one already equipped", () => {
    setup({ equipped: [{ slot: "weapon", itemId: "relic.sunworn_charm" }] });
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);
    expect(screen.getByTestId("relics-row-relic.ashen_reliquary")).toBeInTheDocument();
    expect(screen.getByTestId("relics-row-relic.sunworn_charm")).toHaveTextContent("equipped");
    expect(screen.getByTestId("relics-row-relic.tidewrack_band")).not.toHaveTextContent("equipped");
  });

  it("selecting a held relic in the same slot as the equipped one shows a swap comparison", async () => {
    setup({ equipped: [{ slot: "weapon", itemId: "relic.sunworn_charm" }] });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("relics-row-relic.ashen_reliquary"));
    const compare = screen.getByTestId("relics-compare");
    expect(compare).toHaveTextContent("Swapping Sunworn Charm → Ashen Reliquary");
    expect(screen.getByTestId("relics-equip-btn")).toBeInTheDocument();
  });

  it("selecting a held relic for an empty slot says so honestly rather than inventing a swap", async () => {
    setup({ equipped: [] });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("relics-row-relic.tidewrack_band"));
    expect(screen.getByTestId("relics-compare")).toHaveTextContent("nothing in that slot yet");
  });

  it("selecting the already-equipped relic itself says so honestly instead of a self-swap, and hides Equip", async () => {
    setup({ equipped: [{ slot: "weapon", itemId: "relic.ashen_reliquary" }] });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("relics-row-relic.ashen_reliquary"));
    expect(screen.getByTestId("relics-compare")).toHaveTextContent("Ashen Reliquary is already equipped");
    expect(screen.queryByTestId("relics-equip-btn")).not.toBeInTheDocument();
  });

  it("Equip calls the real mutation with the actor, the relic's own slot, and the relic id", async () => {
    setup({ equipped: [] });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("relics-row-relic.ashen_reliquary"));
    await user.click(screen.getByTestId("relics-equip-btn"));
    expect(mockMutate).toHaveBeenCalledWith({ instanceId: "a1", slot: "weapon", itemId: "relic.ashen_reliquary" });
  });

  it("the Equipped tab lists only filled slots, and Storage is honestly not-tracked-yet", async () => {
    setup({ equipped: [{ slot: "weapon", itemId: "relic.sunworn_charm" }] });
    const user = userEvent.setup();
    renderWithProviders(<RelicsLayer open onOpenChange={() => {}} playerId={1} />);

    await user.click(screen.getByTestId("relics-tab-equipped"));
    expect(screen.getByTestId("relics-equipped-list")).toHaveTextContent("Sunworn Charm");

    await user.click(screen.getByTestId("relics-tab-storage"));
    expect(screen.getByText("Storage isn't tracked yet")).toBeInTheDocument();
  });

  it("Esc closes it without unmounting whatever is behind it", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<ControlledRelicsLayer />, { withGlobalKeys: true });
    expect(screen.getByTestId("relics-layer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("relics-layer")).not.toBeInTheDocument());
    expect(screen.getByTestId("stage-behind")).toBeInTheDocument();
  });
});
