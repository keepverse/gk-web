import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { ActionsTab } from "./ActionsTab";

const enableMutate = vi.fn();
const disableMutate = vi.fn();
const setLoadoutMutate = vi.fn();
const discardUnlockMutate = vi.fn();

type UpkeepFixture = { resourceId: string; amountMin: number; amountMax: number; when: string };
let catalogData:
  | { items: { auraId: string; aptitudeId: string; upkeep: UpkeepFixture[] }[] }
  | undefined = {
  items: [
    { auraId: "Might", aptitudeId: "Might", upkeep: [] },
    { auraId: "Fortitude", aptitudeId: "Fortitude", upkeep: [] }
  ]
};
let runtimeData:
  | { activeAuraIds: string[]; equippedAuraIds: string[]; maxActiveAuras: number }
  | undefined = { activeAuraIds: [], equippedAuraIds: ["Might"], maxActiveAuras: 1 };

// A30 (T69/T70): the real held/equipped action set, mirroring the aura fixtures' own shape.
let loadoutData: { instanceId: string; actionIds: string[]; heldActionIds: string[] } | undefined = {
  instanceId: "a1",
  actionIds: ["action.strike"],
  heldActionIds: ["action.guard", "action.strike"]
};

vi.mock("@/lib/bus/aura", () => ({
  useAuraCatalog: () => ({ data: catalogData, isLoading: catalogData === undefined }),
  useAuraRuntime: () => ({ data: runtimeData, isLoading: runtimeData === undefined }),
  useEnableAura: () => ({ mutate: enableMutate, isPending: false }),
  useDisableAura: () => ({ mutate: disableMutate, isPending: false })
}));

vi.mock("@/lib/bus/action", () => ({
  useActionLoadout: () => ({ data: loadoutData, isLoading: loadoutData === undefined }),
  useSetLoadout: () => ({ mutate: setLoadoutMutate, isPending: false }),
  useDiscardUnlock: () => ({ mutate: discardUnlockMutate, isPending: false })
}));

function actorView(): ActorView {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

describe("ActionsTab", () => {
  beforeEach(() => {
    enableMutate.mockReset();
    disableMutate.mockReset();
    setLoadoutMutate.mockReset();
    discardUnlockMutate.mockReset();
    catalogData = {
      items: [
        { auraId: "Might", aptitudeId: "Might", upkeep: [] },
        { auraId: "Fortitude", aptitudeId: "Fortitude", upkeep: [] }
      ]
    };
    runtimeData = { activeAuraIds: [], equippedAuraIds: ["Might"], maxActiveAuras: 1 };
    loadoutData = { instanceId: "a1", actionIds: ["action.strike"], heldActionIds: ["action.guard", "action.strike"] };
  });

  it("an equipped-but-inactive aura shows the Equipped badge and an Enable button", () => {
    render(<ActionsTab data={actorView()} />);
    expect(screen.getByTestId("aura-slot-Might-badge")).toHaveTextContent("Equipped");
    expect(screen.getByTestId("aura-slot-Might-toggle")).toHaveTextContent("Enable");
  });

  it("a real aura not in the loadout renders locked with a real reason, never a generic string", () => {
    render(<ActionsTab data={actorView()} />);
    const fortitude = screen.getByTestId("aura-slot-Fortitude");
    expect(fortitude).toHaveAttribute("title", expect.stringContaining("Not equipped"));
    expect(screen.queryByTestId("aura-slot-Fortitude-toggle")).not.toBeInTheDocument();
  });

  it("clicking Enable calls the enable mutation with the real aura id", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("aura-slot-Might-toggle"));
    expect(enableMutate).toHaveBeenCalledWith("Might", expect.anything());
  });

  it("enabling at the cap names the aura that switched off (GG-55)", () => {
    runtimeData = { activeAuraIds: ["Fortitude"], equippedAuraIds: ["Might", "Fortitude"], maxActiveAuras: 1 };
    render(<ActionsTab data={actorView()} />);

    fireEvent.click(screen.getByTestId("aura-slot-Might-toggle"));
    const [, options] = enableMutate.mock.calls[0] as [string, { onSuccess: (r: unknown) => void }];
    act(() => {
      options.onSuccess({ playerId: 1, enabledAuraId: "Might", evictedAuraId: "Fortitude", activeAuraIds: ["Might"] });
    });

    expect(screen.getByTestId("aura-slot-Fortitude-refusal")).toHaveTextContent(/Might took its slot/);
  });

  it("a refusal names which reason, not a generic failure (GG-55)", () => {
    runtimeData = { activeAuraIds: [], equippedAuraIds: [], maxActiveAuras: 1 };
    catalogData = { items: [{ auraId: "Might", aptitudeId: "Might", upkeep: [] }] };
    // "Might" renders locked (not equipped) so there is no toggle to click here directly; instead
    // exercise the refusal path on an equipped aura whose enable call the server refuses.
    runtimeData = { activeAuraIds: [], equippedAuraIds: ["Might"], maxActiveAuras: 1 };
    render(<ActionsTab data={actorView()} />);

    fireEvent.click(screen.getByTestId("aura-slot-Might-toggle"));
    const [, options] = enableMutate.mock.calls[0] as [string, { onError: (e: unknown) => void }];
    act(() => {
      options.onError(new Error("AlreadyActive"));
    });

    expect(screen.getByTestId("aura-slot-Might-refusal")).toHaveTextContent("Already active");
  });

  it("a real authored upkeep cost is visible before committing (spec-aura-surface.md §2.1)", () => {
    catalogData = {
      items: [{ auraId: "Might", aptitudeId: "Might", upkeep: [{ resourceId: "stamina", amountMin: 5, amountMax: 5, when: "PerTick" }] }]
    };
    render(<ActionsTab data={actorView()} />);
    expect(screen.getByTestId("aura-slot-Might-upkeep")).toHaveTextContent("5 stamina per tick");
  });

  it("renders nothing for upkeep when no cost is authored yet, never a fabricated number", () => {
    render(<ActionsTab data={actorView()} />);
    expect(screen.queryByTestId("aura-slot-Might-upkeep")).not.toBeInTheDocument();
  });

  it("shows an honest loading state before catalog/runtime/loadout data arrives", () => {
    catalogData = undefined;
    render(<ActionsTab data={actorView()} />);
    expect(screen.getByTestId("actions-tab-loading")).toBeInTheDocument();
  });

  // ---- A30 (T70): the real regular-action grid ----

  it("a specimen with 2 held, 1 equipped action shows 2 real slots with the correct equip state per slot", () => {
    render(<ActionsTab data={actorView()} />);
    expect(screen.getByTestId("action-slot-action.strike-badge")).toHaveTextContent("Equipped");
    expect(screen.getByTestId("action-slot-action.guard-badge")).toHaveTextContent("Held");
    expect(screen.queryByTestId("actions-tab-placeholder")).not.toBeInTheDocument();
  });

  it("PLACEHOLDER_ACTIONS is gone -- no locked-slot testids remain in the DOM", () => {
    render(<ActionsTab data={actorView()} />);
    expect(screen.queryByTestId(/^locked-slot-/)).not.toBeInTheDocument();
  });

  it("equipping a held-not-equipped action calls the mutation with it added", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("action-slot-action.guard-toggle"));
    expect(setLoadoutMutate).toHaveBeenCalledWith(["action.strike", "action.guard"], expect.anything());
  });

  it("unequipping an equipped action calls the mutation with it removed", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("action-slot-action.strike-toggle"));
    expect(setLoadoutMutate).toHaveBeenCalledWith([], expect.anything());
  });

  it("an equip rejection (6th slot / category error) renders a real refusal note, not a generic failure", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("action-slot-action.guard-toggle"));
    const [, options] = setLoadoutMutate.mock.calls[0] as [string[], { onError: (e: unknown) => void }];
    act(() => {
      options.onError(new Error("LoadoutFull"));
    });
    expect(screen.getByTestId("action-slot-action.guard-refusal")).toHaveTextContent(/Loadout is full/);
  });

  it("discarding a held unlock requires a confirm interaction before the mutation fires", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("action-slot-action.guard-discard"));

    expect(discardUnlockMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("actions-tab-discard-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("actions-tab-discard-confirm-confirm"));
    expect(discardUnlockMutate).toHaveBeenCalledWith("action.guard", expect.anything());
  });

  it("cancelling the discard confirm never fires the mutation", () => {
    render(<ActionsTab data={actorView()} />);
    fireEvent.click(screen.getByTestId("action-slot-action.guard-discard"));
    fireEvent.click(screen.getByTestId("actions-tab-discard-confirm-cancel"));
    expect(discardUnlockMutate).not.toHaveBeenCalled();
  });

  it("no held actions renders an honest empty state, not a fabricated grid", () => {
    loadoutData = { instanceId: "a1", actionIds: [], heldActionIds: [] };
    render(<ActionsTab data={actorView()} />);
    expect(screen.getByTestId("actions-tab-actions-empty")).toBeInTheDocument();
  });
});
