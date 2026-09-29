import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SectorView, VaultView } from "@/contract/types";
import { VaultBlock } from "./VaultBlock";
import { SectorInspector } from "./SectorInspector";
import { BLOCK_ORDER } from "./blockOrder";
import { emptySector, maximalForces, maximalSector, maximalSlots } from "./fixtures/maximalSector";

const count = (value: number) => ({ unit: "count" as const, value });
const loam = (value: number) => ({ unit: "loamUnits" as const, value });

/**
 * 4D.2a-local sector: `maximalSector` completed with the wonder-wire reads a sibling stream
 * added to `SectorView` without updating that shared fixture (their `ModifierLedger` hunk
 * crashes on the stale shape — pre-existing, unrelated to the vault; this local completion
 * keeps 4D.2a's landmark tests independent of their hunk instead of touching their files).
 */
const sectorWithWonder: SectorView = {
  ...maximalSector,
  loam: {
    ...maximalSector.loam,
    upkeepBreakdown: {
      ...maximalSector.loam.upkeepBreakdown,
      wonderUpkeep: loam(0)
    }
  },
  wonderLiveCountSector: count(0),
  wonderLiveCountEmpire: count(0),
  wonderProductionContribution: loam(0)
};

/** A held sector with a built relic-vault: room for 6 rows, 2 stored. */
const relicVault: VaultView = {
  worldId: "w-1",
  sectorId: "ember-hollow",
  ownerFactionId: "dave",
  asOfTurn: 3,
  rows: [
    { seq: 0, kind: "instance", instanceId: "inst-c", containerId: null, qty: null },
    { seq: 1, kind: "stack", instanceId: null, containerId: "cont-b", qty: 4 }
  ],
  slotsUsed: count(2),
  slotCapacity: count(6),
  slotFraction: 2 / 6,
  room: count(4)
};

function renderInspector(overrides: Partial<Parameters<typeof SectorInspector>[0]> = {}) {
  return render(
    <SectorInspector
      open
      onOpenChange={() => {}}
      sector={sectorWithWonder}
      slots={maximalSlots}
      forces={maximalForces}
      cedeOrderAvailable={false}
      prospected={true}
      {...overrides}
    />
  );
}

describe("VaultBlock — the vault section for a relic-vault sector (plan Task 4D.2a)", () => {
  it("renders room + rows in seq order with the live 'held by X' header", () => {
    render(<VaultBlock vault={relicVault} state="ready" />);
    expect(screen.getByTestId("vault-header")).toHaveTextContent("held by dave");
    const room = screen.getByTestId("vault-room");
    expect(room).toHaveAttribute("data-used", "2");
    expect(room).toHaveAttribute("data-capacity", "6");
    expect(room).toHaveAttribute("data-room", "4");
    const rows = screen.getByTestId("vault-rows");
    const rendered = [...rows.children].map((el) => el.getAttribute("data-testid"));
    expect(rendered).toEqual(["vault-row-0", "vault-row-1"]);
  });

  it("locked (SlotCapacity == 0) names relic-vault; empty with capacity binds phase-empty — never confused", () => {
    const { unmount } = render(
      <VaultBlock
        vault={{ ...relicVault, rows: [], slotsUsed: count(0), slotCapacity: count(0), room: count(0) }}
        state="ready"
      />
    );
    expect(screen.getByTestId("vault-phase-locked")).toHaveTextContent("relic-vault");
    expect(screen.queryByTestId("vault-phase-empty")).not.toBeInTheDocument();
    unmount();

    render(
      <VaultBlock
        vault={{ ...relicVault, rows: [], slotsUsed: count(0), slotCapacity: count(6), room: count(6) }}
        state="ready"
      />
    );
    expect(screen.getByTestId("vault-phase-empty")).toHaveTextContent("send a band with goods");
    expect(screen.queryByTestId("vault-phase-locked")).not.toBeInTheDocument();
  });

  it("loading and error phases render with a retry that fires its callback", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VaultBlock vault={null} state="loading" />);
    expect(screen.getByTestId("vault-phase-loading")).toBeInTheDocument();
    unmount();

    const onRetry = vi.fn();
    render(<VaultBlock vault={null} state="error" error="The vault could not be read." onRetry={onRetry} />);
    expect(screen.getByTestId("vault-phase-error")).toHaveTextContent("The vault could not be read.");
    await user.click(screen.getByTestId("vault-retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("search filters stored stacks without refetching (client filter over the one read)", async () => {
    const user = userEvent.setup();
    render(<VaultBlock vault={relicVault} state="ready" />);
    await user.type(screen.getByTestId("vault-search"), "cont-b");
    expect(screen.queryByTestId("vault-row-0")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-row-1")).toBeInTheDocument();
  });

  it("fires no toast — the block renders with no notify rail and no provider beyond React", () => {
    render(<VaultBlock vault={relicVault} state="ready" />);
    expect(screen.queryByTestId("notify-rail")).not.toBeInTheDocument();
  });
});

describe("SectorInspector — vault slots between forces and warden, verbs join the one cluster", () => {
  it("data-block-order reads ...,forces,vault,warden,... with the nine existing ids in order", () => {
    renderInspector({ vault: relicVault, vaultState: "ready" });
    const container = screen.getByTestId("sector-inspector-blocks");
    expect(container).toHaveAttribute("data-block-order", BLOCK_ORDER.join(","));
    const ids = [...container.children].map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual([...BLOCK_ORDER.map((id) => `inspector-block-${id}`), "inspector-actions"]);
    const order = BLOCK_ORDER.join(",");
    expect(order).toContain("forces,vault,warden");
    // The nine pre-existing ids keep their relative order (append-only discipline).
    const nine = ["identity", "ground", "next-turn", "sector-loam", "territory", "slots", "forces", "warden", "dowsing"];
    let at = -1;
    for (const id of nine) {
      const next = BLOCK_ORDER.indexOf(id as (typeof BLOCK_ORDER)[number]);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });

  it("renders the vault section even before the read answers (loading, never a hole in the order)", () => {
    renderInspector();
    expect(screen.getByTestId("inspector-block-vault")).toBeInTheDocument();
    expect(screen.getByTestId("vault-phase-loading")).toBeInTheDocument();
  });

  it("deposit/withdraw verbs render as two rows in the SAME generic ActionCluster and fire their callbacks", async () => {
    const user = userEvent.setup();
    const onDeposit = vi.fn();
    const onWithdraw = vi.fn();
    renderInspector({
      vault: relicVault,
      vaultState: "ready",
      vaultVerbs: [
        { id: "vault-deposit", label: "Put in", disabledReason: null, onActivate: onDeposit },
        { id: "vault-withdraw", label: "Take out", disabledReason: null, onActivate: onWithdraw }
      ]
    });
    expect(screen.getByTestId("action-cluster")).toBeInTheDocument();
    await user.click(screen.getByTestId("action-button-vault-deposit"));
    expect(onDeposit).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId("action-button-vault-withdraw"));
    expect(onWithdraw).toHaveBeenCalledOnce();
  });

  it("a vault refusal stays visible and disabled (never hidden, GG-55) with real reason text", () => {
    renderInspector({
      vault: relicVault,
      vaultState: "ready",
      vaultVerbs: [{ id: "vault-deposit", label: "Put in", disabledReason: "vault.no-cargo-rows" }]
    });
    expect(screen.getByTestId("action-button-vault-deposit")).toBeDisabled();
    expect(screen.getByTestId("action-reason-vault-deposit").textContent!.length).toBeGreaterThan(0);
  });

  it("the sparse fixture still renders the vault slot honestly", () => {
    renderInspector({
      sector: {
        ...emptySector,
        loam: {
          ...emptySector.loam,
          upkeepBreakdown: { ...emptySector.loam.upkeepBreakdown, wonderUpkeep: loam(0) }
        },
        wonderLiveCountSector: count(0),
        wonderLiveCountEmpire: count(0),
        wonderProductionContribution: loam(0)
      },
      slots: [],
      forces: []
    });
    expect(screen.getByTestId("inspector-block-vault")).toBeInTheDocument();
  });
});
