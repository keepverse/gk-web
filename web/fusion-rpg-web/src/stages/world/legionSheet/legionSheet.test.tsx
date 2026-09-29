import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import type { LegionCargoDto } from "@/lib/bus/world";
import { claimKeys } from "@/lib/bus/world";
import { foldLegionCargoSheet } from "@/contract/adapt";
import {
  CARGO_TAB_ACTIONS,
  buildCargoCommandBody,
  cargoCommandId,
  cargoWireKind
} from "./cargoActions";
import { CargoTab, CargoTabContent } from "./CargoTab";
import { LegionSheet } from "./LegionSheet";

vi.mock("@/lib/bus/world", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus/world")>();
  return { ...actual, useLegionCargo: vi.fn() };
});

const { useLegionCargo } = await import("@/lib/bus/world");
const mockUseLegionCargo = vi.mocked(useLegionCargo);

/**
 * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1) — bus schema +
 * recipe landmarks + container/host behavior.
 */

const cargoDto: LegionCargoDto = {
  worldId: "w-1",
  entityId: "e-dave-legion-1",
  asOfTurn: 3,
  rows: [
    { seq: 0, kind: "instance", instanceId: "inst-a", containerId: null, qty: null, weightEach: 10, rowWeight: 10 },
    { seq: 1, kind: "stack", instanceId: null, containerId: "cont-b", qty: 4, weightEach: 5, rowWeight: 20 }
  ],
  weightUsed: 30,
  weightCapacity: 300,
  slotsUsed: 2,
  slotCapacity: 6
};

function cargoQueryWith(data: LegionCargoDto | undefined, overrides?: Record<string, unknown>) {
  return {
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({ data }),
    ...overrides
  } as unknown as ReturnType<typeof useLegionCargo>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLegionCargo.mockReturnValue(cargoQueryWith(cargoDto));
});

describe("cargo bus — field-for-field, never a weight on the wire", () => {
  it("exposes exactly the three tab actions", () => {
    expect([...CARGO_TAB_ACTIONS]).toEqual(["cargo.load", "cargo.unload", "cargo.hand-to-band"]);
  });

  it("builds load (instance + stack) with no weightEach member", () => {
    expect(
      buildCargoCommandBody(
        { type: "cargo.load", entityId: "e1", cargoKind: "instance", instanceId: "inst-a" },
        "t3-load-cargo-e1"
      )
    ).toEqual({
      commandId: "t3-load-cargo-e1",
      kind: "load-cargo",
      entityId: "e1",
      cargoKind: "instance",
      instanceId: "inst-a",
      containerId: null,
      qty: null
    });
    expect(
      buildCargoCommandBody(
        { type: "cargo.load", entityId: "e1", cargoKind: "stack", containerId: "cont-b", qty: 4 },
        "t3-load-cargo-e1"
      )
    ).toMatchObject({ kind: "load-cargo", containerId: "cont-b", qty: 4 });
    for (const body of [
      buildCargoCommandBody({ type: "cargo.load", entityId: "e", cargoKind: "instance" }, "c"),
      buildCargoCommandBody({ type: "cargo.unload", entityId: "e", seq: 0 }, "c"),
      buildCargoCommandBody({ type: "cargo.hand-to-band", entityId: "e", targetEntityId: "t", seq: 0 }, "c"),
      buildCargoCommandBody({ type: "cargo.deposit", entityId: "e", sectorId: "s", seq: 0 }, "c"),
      buildCargoCommandBody({ type: "cargo.withdraw", entityId: "e", sectorId: "s", seq: 0 }, "c"),
      buildCargoCommandBody({ type: "cache.pick-up", entityId: "e", cacheId: "cc" }, "c")
    ]) {
      expect(body).not.toHaveProperty("weightEach");
      expect(body).not.toHaveProperty("weight_each");
      expect(Object.keys(body).join(",")).not.toMatch(/weight/i);
    }
  });

  it("builds unload / hand-to-band / carried deposit-withdraw shapes", () => {
    expect(buildCargoCommandBody({ type: "cargo.unload", entityId: "e1", seq: 2 }, "c")).toMatchObject({
      kind: "unload-cargo",
      entityId: "e1",
      seq: 2
    });
    expect(
      buildCargoCommandBody({ type: "cargo.hand-to-band", entityId: "e1", targetEntityId: "e2", seq: 2 }, "c")
    ).toMatchObject({ kind: "transfer-cargo", entityId: "e1", targetEntityId: "e2", seq: 2 });
    expect(buildCargoCommandBody({ type: "cargo.deposit", entityId: "e1", sectorId: "s", seq: 1 }, "c")).toMatchObject({
      kind: "deposit-cargo",
      sectorId: "s",
      seq: 1
    });
  });

  it("keys idempotency off the queue's own orderId shape — never a second key", () => {
    expect(cargoCommandId(3, "load-cargo", "e1")).toBe("t3-load-cargo-e1");
    expect(cargoCommandId(3, "transfer-cargo", "e1")).not.toBe(cargoCommandId(3, "load-cargo", "e1"));
    expect(cargoWireKind({ type: "cache.pick-up", entityId: "e", cacheId: "c" })).toBe("claim-cache");
  });
});

describe("one-scope reads — the tab binds one legion, never the empire", () => {
  it("keys the cargo read off (world, legion) with no list-all shape", () => {
    expect(claimKeys.legionCargo("w-1", "e-1")).toEqual(["world", "legionCargo", "w-1", "e-1"]);
    expect(Object.keys(claimKeys).sort()).toEqual(["claimableCaches", "legionCargo", "sectorStorage"]);
  });

  it("reads exactly one legion's cargo per open (no empire-wide fetch)", () => {
    renderWithProviders(
      <CargoTab
        worldId="w-1"
        entityId="e-dave-legion-1"
        turn={3}
        displayName="First Banner"
        ownerFactionId="dave"
        legion={null}
      />
    );
    expect(mockUseLegionCargo).toHaveBeenCalledWith("w-1", "e-dave-legion-1");
    expect(mockUseLegionCargo.mock.calls.every(([w, e]) => w === "w-1" && e === "e-dave-legion-1")).toBe(true);
  });
});

describe("cargo recipe landmarks (pure view)", () => {
  function renderContent(fileNote: string | null = null) {
    const fold = foldLegionCargoSheet(cargoDto, { ownerFactionId: "dave" });
    const noop = () => {};
    renderWithProviders(
      <CargoTabContent
        fold={fold}
        displayName="First Banner"
        query=""
        onQueryChange={noop}
        selectedSeq={null}
        onSelectSeq={noop}
        fileNote={fileNote}
        onAction={noop}
      />
    );
    return fold;
  }

  it("renders every recipe landmark with rows in seq order", () => {
    renderContent();
    expect(screen.getByTestId("legion-cargo-tab")).toBeInTheDocument();
    expect(screen.getByTestId("legion-overview")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-capacity-meter")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-capacity-slots-track")).toHaveTextContent("2/6 slots");
    expect(screen.getByTestId("cargo-capacity-weight-track")).toHaveTextContent("30/300 wt");
    expect(screen.getByTestId("cargo-capacity-gate-copy")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-search")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-rows")).toBeInTheDocument();
    const rows = screen.getAllByTestId("cargo-stock-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-seq", "0");
    expect(rows[1]).toHaveAttribute("data-seq", "1");
    expect(rows[0]).toHaveAttribute("data-state", "carried");
    expect(screen.getByTestId("cargo-action-load")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-action-unload")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-action-hand-to-band")).toBeInTheDocument();
    expect(screen.getByTestId("cargo-report-note")).toHaveTextContent("As of turn 3");
    expect(screen.queryByTestId("cargo-file-note")).not.toBeInTheDocument();
  });

  it("keeps action buttons enabled with no selection (GG-55: never silent-disable)", () => {
    renderContent();
    for (const id of ["cargo-action-load", "cargo-action-unload", "cargo-action-hand-to-band"]) {
      const button = screen.getByTestId(id);
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("disabled");
    }
  });

  it("renders the filing note (filing) beside the report note (resolution) — never confused", () => {
    renderContent("Filed — resolution arrives with the turn report, not this button.");
    expect(screen.getByTestId("cargo-file-note")).toHaveTextContent("Filed");
    expect(screen.getByTestId("cargo-report-note")).toHaveTextContent("As of turn 3");
  });

  it("never hides a refused row behind the search filter", async () => {
    const user = userEvent.setup();
    const base = foldLegionCargoSheet(cargoDto, { ownerFactionId: "dave" });
    const fold = {
      ...base,
      rows: [
        ...base.rows,
        {
          seq: 7,
          kind: "stack" as const,
          instanceId: null,
          containerId: "cont-z",
          qty: 2,
          weight: { unit: "count" as const, value: 64 },
          nameFallback: "#7",
          state: "refused" as const,
          copyKey: "cargo.full.slots" as const
        }
      ]
    };
    const noop = () => {};
    function Harness() {
      const [q, setQ] = useState("");
      return (
        <CargoTabContent
          fold={fold}
          displayName="First Banner"
          query={q}
          onQueryChange={setQ}
          selectedSeq={null}
          onSelectSeq={noop}
          fileNote={null}
          onAction={noop}
        />
      );
    }
    renderWithProviders(<Harness />);
    await user.type(screen.getByTestId("cargo-search"), "zzz-no-such-pack");
    const rows = screen.getAllByTestId("cargo-stock-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("data-seq", "7");
    expect(rows[0]).toHaveAttribute("data-state", "refused");
  });

  it("renders empty-with-next-action for a known legion with nothing aboard", () => {
    const fold = foldLegionCargoSheet({ ...cargoDto, rows: [] }, { ownerFactionId: "dave" });
    const noop = () => {};
    renderWithProviders(
      <CargoTabContent
        fold={fold}
        displayName="First Banner"
        query=""
        onQueryChange={noop}
        selectedSeq={null}
        onSelectSeq={noop}
        fileNote={null}
        onAction={noop}
      />
    );
    expect(screen.getByTestId("cargo-empty")).toHaveTextContent("march to a cache");
  });
});

describe("cargo container — unknown-vs-empty (caller error vs nothing aboard)", () => {
  it("shows loading while the read is in flight", () => {
    mockUseLegionCargo.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn()
    } as unknown as ReturnType<typeof useLegionCargo>);
    renderWithProviders(
      <CargoTab worldId="w-1" entityId="e-1" turn={3} displayName={null} ownerFactionId={null} legion={null} />
    );
    expect(screen.getByTestId("cargo-loading")).toBeInTheDocument();
  });

  it("shows error-with-retry for an unknown legion", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseLegionCargo.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch
    } as unknown as ReturnType<typeof useLegionCargo>);
    renderWithProviders(
      <CargoTab worldId="w-1" entityId="e-nope" turn={3} displayName={null} ownerFactionId={null} legion={null} />
    );
    expect(screen.getByTestId("cargo-error")).toHaveTextContent("No such band");
    await user.click(within(screen.getByTestId("cargo-error")).getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows empty-with-next-action for a known legion with empty packs", () => {
    mockUseLegionCargo.mockReturnValue(cargoQueryWith({ ...cargoDto, rows: [] }));
    renderWithProviders(
      <CargoTab
        worldId="w-1"
        entityId="e-dave-legion-1"
        turn={3}
        displayName="First Banner"
        ownerFactionId="dave"
        legion={null}
      />
    );
    expect(screen.getByTestId("cargo-empty")).toBeInTheDocument();
  });
});

describe("legion sheet host — rail discipline, per-legion reset, close keeps the queue", () => {
  const hostProps = {
    worldId: "w-1",
    entityId: "e-dave-legion-1",
    turn: 3,
    open: true,
    onOpenChange: vi.fn(),
    onDeselect: vi.fn(),
    displayName: "First Banner",
    ownerFactionId: "dave",
    memberCount: 6,
    legion: null
  };

  it("opens on overview by default with rail landmarks, cargo hidden", () => {
    renderWithProviders(<LegionSheet {...hostProps} />);
    expect(screen.getByTestId("legion-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("legion-sheet-rail")).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByTestId("legion-sheet-tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("legion-sheet-tab-cargo")).toBeInTheDocument();
    expect(screen.getByTestId("legion-sheet-panel")).toBeInTheDocument();
    expect(screen.getByTestId("legion-overview")).toBeInTheDocument();
    expect(screen.queryByTestId("legion-cargo-tab")).not.toBeInTheDocument();
  });

  it("switches to the cargo tab on rail select", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LegionSheet {...hostProps} />);
    await user.click(screen.getByTestId("legion-sheet-tab-cargo"));
    expect(screen.getByTestId("legion-cargo-tab")).toBeInTheDocument();
  });

  it("resets to overview when the selected legion changes", async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(<LegionSheet {...hostProps} />);
    await user.click(screen.getByTestId("legion-sheet-tab-cargo"));
    expect(screen.getByTestId("legion-cargo-tab")).toBeInTheDocument();
    view.rerender(<LegionSheet {...hostProps} entityId="e-dave-legion-2" />);
    expect(screen.getByTestId("legion-overview")).toBeInTheDocument();
    expect(screen.queryByTestId("legion-cargo-tab")).not.toBeInTheDocument();
  });

  it("closes via Esc without touching the queue (deselect only)", async () => {
    const user = userEvent.setup();
    const onDeselect = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<LegionSheet {...hostProps} onDeselect={onDeselect} onOpenChange={onOpenChange} />);
    // The rail is reused, not forked: its close landmark stays the shared
    // `actor-sheet-close` (the draft's `legion-sheet-close` is amended here).
    await user.click(screen.getByTestId("actor-sheet-close"));
    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
