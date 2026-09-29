import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { createWonderComposerBus } from "@/features/gui-lego/wonderComposerBus";
import { foldWonderComposerVm, type WonderComposerFoldInput } from "@/features/gui-lego/foldWonderComposerVm";
import { WonderComposerContent, type WonderComposerCallbacks } from "./WonderComposer";
import { WONDER_COMPOSER_COPY } from "./copyCatalog";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §Design 8 + Testing strategy) — recipe landmarks
 * + closed bus + copy catalog. The pure content binds the fold output to
 * the draft landmarks; the container's reads file through 4A.2/4A.4 hooks
 * proved over HTTP by those tasks' suites.
 */

function baseInput(overrides?: Partial<WonderComposerFoldInput>): WonderComposerFoldInput {
  const base: WonderComposerFoldInput = {
    structures: [
      {
        structureId: "standing-stones",
        name: "Standing Stones",
        kind: "LoamSource",
        requiredSlotKind: "Rootbed",
        cost: 0,
        yieldMultiplierMilli: 1000,
        buildTurns: 4,
        capacityBonus: 0,
        wonderScope: "Sector",
        wonderRarity: "Common",
        relicCost: 1,
        existenceCap: Number.MAX_SAFE_INTEGER
      },
      {
        structureId: "sunspire-throne",
        name: "Sunspire Throne",
        kind: "Yield",
        requiredSlotKind: "Shrine",
        cost: 0,
        yieldMultiplierMilli: 1000,
        buildTurns: 6,
        capacityBonus: 0,
        wonderScope: "Empire",
        wonderRarity: "Unique",
        relicCost: 3,
        existenceCap: 2
      }
    ],
    slots: [
      { slotIndex: 0, slotTypeId: "Rootbed", state: "Empty", guardState: "Cleared", structureId: null },
      { slotIndex: 1, slotTypeId: "Shrine", state: "Empty", guardState: "Cleared", structureId: null }
    ],
    sector: {
      sectorId: "s-1",
      wonderLiveCountSector: { unit: "count", value: 0 },
      wonderLiveCountEmpire: { unit: "count", value: 1 },
      wonderUpkeep: { unit: "loamUnits", value: 8 }
    },
    reachability: {
      worldId: "w-1",
      entityId: "e-1",
      sectorId: "s-1",
      reachableInstanceIds: ["relic-a", "relic-b", "relic-c"]
    },
    cargoRows: [
      { seq: 0, kind: "instance", instanceId: "relic-a", containerId: null, qty: null, weightEach: 1, rowWeight: 1 }
    ],
    storageRows: [{ seq: 0, kind: "instance", instanceId: "relic-b", containerId: null, qty: null }],
    materials: { needRubble: 0, needIronwork: 0, haveRubble: 0, haveIronwork: 0 },
    ui: {
      searchText: "",
      selectedStructureId: "sunspire-throne",
      pickedInstanceIds: ["relic-a"],
      selectedSlotIndex: 1,
      filedPending: false
    },
    ...overrides
  };
  return base;
}

function callbacks(overrides?: Partial<WonderComposerCallbacks>): WonderComposerCallbacks & Record<string, ReturnType<typeof vi.fn>> {
  return {
    onQueryChange: vi.fn(),
    onSelectWonder: vi.fn(),
    onToggleRelic: vi.fn(),
    onSelectSlot: vi.fn(),
    onConfirmOpen: vi.fn(),
    onConfirmAccept: vi.fn(),
    onConfirmCancel: vi.fn(),
    onRetry: vi.fn(),
    ...overrides
  } as WonderComposerCallbacks & Record<string, ReturnType<typeof vi.fn>>;
}

function renderContent(input = baseInput(), cb = callbacks(), extra?: { confirmOpen?: boolean; fileNote?: string | null; lastRefusalKey?: string | null; query?: string }) {
  const vm = foldWonderComposerVm(input);
  renderWithProviders(
    <WonderComposerContent
      vm={vm}
      query={extra?.query ?? ""}
      confirmOpen={extra?.confirmOpen ?? false}
      fileNote={extra?.fileNote ?? null}
      lastRefusalKey={extra?.lastRefusalKey ?? null}
      cb={cb}
    />
  );
  return { vm, cb };
}

describe("catalog landmarks", () => {
  it("renders both rows price-first with live cap lines and locked teasers as peers", () => {
    renderContent();
    const catalog = screen.getByTestId("wonder-catalog");
    const rows = within(catalog).getAllByTestId("wonder-row");
    // Two buildable rows + five locked teasers (World/Multiverse + three kinds).
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveAttribute("data-structure-id", "standing-stones");
    expect(rows[0]).toHaveAttribute("data-buildable", "true");
    // Common: uncapped line, never a gauge.
    expect(within(rows[0]!).getByTestId("wonder-row-cap-line")).toHaveAttribute("data-cap-state", "uncapped");
    // Unique: live cap line from the fold's numbers.
    const throneCap = within(rows[1]!).getByTestId("wonder-row-cap-line");
    expect(throneCap).toHaveAttribute("data-cap-state", "live");
    expect(throneCap.textContent).toContain("1");
    // Scope/rarity badges declare pack slots, never paint values.
    expect(within(rows[1]!).getByTestId("wonder-row-scope-badge")).toHaveAttribute("data-theme-ref", "wonder-scope.Empire");
    expect(within(rows[1]!).getByTestId("wonder-row-rarity-badge")).toHaveAttribute("data-theme-ref", "wonder-rarity.Unique");
    // Locked teaser peer with reason.
    const teaser = rows.find((r) => r.getAttribute("data-structure-id") === "locked:World")!;
    expect(teaser).toHaveAttribute("data-buildable", "false");
    expect(within(teaser).getByTestId("wonder-row-locked-reason").textContent?.length).toBeGreaterThan(0);
  });

  it("selects a row through the bus callback, never silently", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent();
    const catalog = screen.getByTestId("wonder-catalog");
    await user.click(within(catalog).getAllByTestId("wonder-row")[0]!);
    expect(cb.onSelectWonder).toHaveBeenCalledWith("standing-stones");
  });

  it("searches through the tool-search landmark", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent();
    await user.type(screen.getByTestId("wonder-search"), "sunspire");
    expect(cb.onQueryChange).toHaveBeenCalled();
  });
});

describe("shelf landmarks", () => {
  it("renders the reachable-first shelf with count line and disclosure", () => {
    renderContent(
      baseInput({
        storageRows: [
          { seq: 0, kind: "instance", instanceId: "relic-b", containerId: null, qty: null },
          { seq: 1, kind: "instance", instanceId: "relic-far", containerId: null, qty: null }
        ]
      })
    );
    expect(screen.getByTestId("wonder-shelf-count-line").textContent).toContain("1 of 3");
    const reachable = screen.getByTestId("wonder-shelf-reachable");
    const rows = within(reachable).getAllByTestId("wonder-shelf-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-picked", "true");
    expect(rows[0]).toHaveAttribute("data-where", "legion-cargo");
    expect(rows[1]).toHaveAttribute("data-where", "sector-store");
    const disclosure = screen.getByTestId("wonder-shelf-disclosure");
    expect(within(disclosure).getByText(/out of reach/)).toBeInTheDocument();
  });

  it("toggles a candidate through the bus callback", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent();
    await user.click(within(screen.getByTestId("wonder-shelf-reachable")).getAllByTestId("wonder-shelf-row")[1]!);
    expect(cb.onToggleRelic).toHaveBeenCalledWith("relic-b");
  });

  it("renders the authored empty state, never a blank panel", () => {
    renderContent(
      baseInput({ cargoRows: [], storageRows: [], reachability: { worldId: "w-1", entityId: "e-1", sectorId: "s-1", reachableInstanceIds: [] } })
    );
    expect(screen.getByTestId("wonder-shelf-empty")).toBeInTheDocument();
    expect(screen.getByTestId("wonder-phase-empty")).toBeInTheDocument();
  });
});

describe("slot + cost-plate landmarks", () => {
  it("marks compatible/selected slots and names the wrong-kind blocker", () => {
    renderContent();
    const pick = screen.getByTestId("wonder-slot-pick");
    const options = within(pick).getAllByTestId("wonder-slot-option");
    // sunspire-throne needs Shrine: slot 1 compatible + selected, slot 0 wrong-kind.
    expect(options[0]).toHaveAttribute("data-compatible", "false");
    expect(options[0].textContent).toContain("different ground");
    expect(options[1]).toHaveAttribute("data-compatible", "true");
    expect(options[1]).toHaveAttribute("data-selected", "true");
  });

  it("renders all five cost-plate lines with the shortfall blocker", () => {
    renderContent();
    const plate = screen.getByTestId("wonder-cost-plate");
    expect(plate).toHaveAttribute("data-affordable", "false");
    expect(within(plate).getByTestId("wonder-cost-relic-line")).toBeInTheDocument();
    expect(within(plate).getByTestId("wonder-cost-materials-line")).toBeInTheDocument();
    expect(within(plate).getByTestId("wonder-cost-nights-line")).toBeInTheDocument();
    expect(within(plate).getByTestId("wonder-cost-blessing-line")).toBeInTheDocument();
    expect(within(plate).getByTestId("wonder-cost-upkeep-line")).toBeInTheDocument();
    expect(within(plate).getByTestId("wonder-cost-blocker").textContent).toContain("relic.shortfall");
  });
});

describe("confirm + refusal + lifecycle landmarks", () => {
  it("opens the band-3 confirm naming what leaves, cancellable", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent(baseInput(), callbacks(), { confirmOpen: true });
    const dialog = screen.getByTestId("wonder-confirm-dialog");
    expect(dialog).toHaveAttribute("data-band", "3");
    expect(screen.getByTestId("wonder-confirm-copy")).toBeInTheDocument();
    await user.click(screen.getByTestId("wonder-confirm-cancel"));
    expect(cb.onConfirmCancel).toHaveBeenCalled();
  });

  it("the confirm control answers visibly while blocked (GG-55: never silently disabled)", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent();
    const open = screen.getByTestId("wonder-confirm-open");
    expect(open).toHaveAttribute("data-enabled", "false");
    expect(open).toHaveAttribute("aria-disabled", "true");
    await user.click(open);
    expect(cb.onConfirmOpen).toHaveBeenCalled();
  });

  it("renders each refusal toast with its next action, raw tokens never", () => {
    render(
      <WonderComposerContent
        vm={foldWonderComposerVm(baseInput())}
        query=""
        confirmOpen={false}
        fileNote={null}
        lastRefusalKey="wonder.cap-reached"
        cb={callbacks()}
      />
    );
    const toast = screen.getByTestId("wonder-refusal-toast");
    expect(toast).toHaveAttribute("data-reason", "wonder.cap-reached");
    expect(screen.getByTestId("wonder-refusal-next").textContent?.length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("wonder.cap-reached");
  });

  it("renders GG-15 pending beside the read phase plus the filing note", () => {
    const input = baseInput();
    input.ui.filedPending = true;
    renderContent(input, callbacks(), { fileNote: "Filed — resolution arrives with the turn report, not this button." });
    expect(screen.getByTestId("wonder-phase-pending")).toBeInTheDocument();
    expect(screen.getByTestId("wonder-file-note")).toBeInTheDocument();
  });

  it("renders the error state with retry", async () => {
    const user = userEvent.setup();
    const { cb } = renderContent(baseInput({ reachability: null }));
    await user.click(screen.getByTestId("wonder-retry"));
    expect(cb.onRetry).toHaveBeenCalled();
  });
});

describe("closed bus", () => {
  it("delivers all six events to recipe handlers and no other vocabulary exists", () => {
    const bus = createWonderComposerBus();
    const seen: string[] = [];
    const off = bus.onAny((event) => seen.push(event));
    bus.emit("wonder-composer.search.set", { text: "x" });
    bus.emit("wonder-composer.wonder.select", { structureId: "s" });
    bus.emit("wonder-composer.relic.toggle", { instanceId: "i" });
    bus.emit("wonder-composer.slot.select", { slotIndex: 0 });
    bus.emit("wonder-composer.confirm", {});
    bus.emit("wonder-composer.retry", {});
    expect(seen).toHaveLength(6);
    off();
  });
});

describe("copyCatalog — authored draft sentences, no engine words", () => {
  it("carries a DRAFT sentence for every fold key", () => {
    const keys = [
      "wonder.effect.sector", "wonder.effect.empire", "wonder.cap-line", "wonder.uncapped",
      "wonder.locked.world", "wonder.locked.multiverse", "wonder.locked.defense", "wonder.locked.aura",
      "wonder.locked.empire-buff", "wonder.placeholder.unknown", "wonder.refused.cap-reached",
      "wonder.refused.count-mismatch", "wonder.refused.not-reachable", "wonder.refused.cannot-afford",
      "wonder.next.other-row", "wonder.next.relay", "wonder.next.fetch", "wonder.next.gather",
      "wonder.confirm.spend", "wonder.filed.pending", "wonder.empty.shelf", "wonder.error.read", "wonder.loading"
    ] as const;
    expect(Object.keys(WONDER_COMPOSER_COPY).sort()).toEqual([...keys].sort());
    for (const sentence of Object.values(WONDER_COMPOSER_COPY)) {
      expect(sentence).toMatch(/^DRAFT/);
    }
  });

  it("keeps engine vocabulary off the player surface", () => {
    const banned = ["RelicCost", "WonderScope", "ExistenceCapFor", "relicInstanceIds", "wonder.cap-reached", "count-mismatch", "not-reachable", "cannot-afford-materials"];
    for (const [key, sentence] of Object.entries(WONDER_COMPOSER_COPY)) {
      for (const word of banned) {
        expect(sentence, key).not.toContain(word);
      }
    }
  });
});
