import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Magnitude, SectorView, SlotView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { SectorInspector } from "./SectorInspector";
import { maximalForces, maximalSector, maximalSlots } from "./fixtures/maximalSector";
import type { WonderCatalogRow } from "../wonderDisplay/wonderDisplayFold";

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });
const count = (value: number): Magnitude => ({ unit: "count", value });
const perMille = (value: number): Magnitude => ({ unit: "perMilleRatio", op: "absolute", value });

function slot(overrides: Partial<SlotView> = {}): SlotView {
  return {
    slotIndex: 0,
    slotTypeId: "rootbed",
    element: null,
    state: "Intact",
    ownerFactionId: "dave",
    guardWaveId: null,
    guardState: "Cleared",
    structureId: null,
    constructionTurnsRemaining: known(null),
    wonderScope: null,
    wonderRarity: null,
    ...overrides
  };
}

function wonderSector(overrides: Partial<SectorView> = {}): SectorView {
  return {
    ...maximalSector,
    wonderLiveCountSector: count(0),
    wonderLiveCountEmpire: count(1),
    ...overrides
  };
}

const SUNSPIRE_SLOT = slot({
  slotIndex: 4,
  slotTypeId: "shrine",
  structureId: "sunspire-throne",
  wonderScope: "Empire",
  wonderRarity: "Unique",
  constructionTurnsRemaining: known(null)
});

const SUNSPIRE_CATALOG: WonderCatalogRow[] = [
  { structureId: "sunspire-throne", existenceCap: 3, relicCost: 3, buildTurns: 6 }
];

describe("SectorInspector — wonder-display conditional mount (4D.4)", () => {
  it("a Wonder slot mounts the authored card instead of the legacy raw-id sentence", () => {
    render(
      <SectorInspector
        open
        onOpenChange={() => {}}
        sector={wonderSector()}
        slots={[...maximalSlots, SUNSPIRE_SLOT]}
        forces={maximalForces}
        cedeOrderAvailable={false}
        prospected={true}
      />
    );
    const slotsBlock = screen.getByTestId("inspector-block-slots");
    expect(within(slotsBlock).getByTestId("wonder-sector-card")).toBeInTheDocument();
    expect(within(slotsBlock).getByTestId("wonder-name")).toHaveTextContent("Sunspire Throne");
    // The legacy sentence (Rootbed — standing-stones class) is gone for this slot.
    expect(within(slotsBlock).queryByTestId("slot-row-4")).not.toBeInTheDocument();
    expect(slotsBlock.textContent).not.toContain("sunspire-throne");
    // The other four slots still render their legacy rows.
    expect(within(slotsBlock).getByTestId("slot-row-0")).toBeInTheDocument();
  });

  it("without a catalog read the Unique cap renders pending — never guessed, never hidden", () => {
    render(
      <SectorInspector
        open
        onOpenChange={() => {}}
        sector={wonderSector()}
        slots={[...maximalSlots, SUNSPIRE_SLOT]}
        forces={maximalForces}
        cedeOrderAvailable={false}
        prospected={true}
      />
    );
    expect(screen.getByTestId("wonder-cap-pending")).toBeInTheDocument();
    expect(screen.queryByTestId("wonder-cap-line")).not.toBeInTheDocument();
  });

  it("with the catalog row the Unique cap binds the live wire fields (zero placeholders)", () => {
    render(
      <SectorInspector
        open
        onOpenChange={() => {}}
        sector={wonderSector()}
        slots={[...maximalSlots, SUNSPIRE_SLOT]}
        forces={maximalForces}
        cedeOrderAvailable={false}
        prospected={true}
        catalogStructures={SUNSPIRE_CATALOG}
      />
    );
    expect(screen.getByTestId("wonder-cap-line")).toHaveTextContent("1 of 3 raised");
    expect(screen.queryByTestId("wonder-cap-pending")).not.toBeInTheDocument();
  });

  it("an unknown id the provided catalog does not know renders the placeholder — never the id", () => {
    // The prop carries the FULL world catalog (known non-Wonders included — `WorldStructureDto`
    // rows exist for wells and waystations too); only a truly unknown id misses it.
    const fullCatalog: WonderCatalogRow[] = [
      ...SUNSPIRE_CATALOG,
      { structureId: "well", existenceCap: Number.MAX_SAFE_INTEGER, relicCost: 0, buildTurns: 2 },
      { structureId: "waystation", existenceCap: Number.MAX_SAFE_INTEGER, relicCost: 0, buildTurns: 3 }
    ];
    render(
      <SectorInspector
        open
        onOpenChange={() => {}}
        sector={wonderSector()}
        slots={[...maximalSlots, slot({ slotIndex: 5, structureId: "sunken-chapel" })]}
        forces={maximalForces}
        cedeOrderAvailable={false}
        prospected={true}
        catalogStructures={fullCatalog}
      />
    );
    const slotsBlock = screen.getByTestId("inspector-block-slots");
    expect(within(slotsBlock).getByTestId("wonder-placeholder")).toBeInTheDocument();
    expect(slotsBlock.textContent).not.toContain("sunken-chapel");
    // Known non-Wonders in the same catalog stay on their legacy rows.
    expect(within(slotsBlock).getByTestId("slot-row-0")).toBeInTheDocument();
  });

  it("facets null and no catalog: the plate renders exactly as before (zero wonder cards)", () => {
    render(
      <SectorInspector
        open
        onOpenChange={() => {}}
        sector={maximalSector}
        slots={maximalSlots}
        forces={maximalForces}
        cedeOrderAvailable={false}
        prospected={true}
      />
    );
    expect(screen.queryByTestId("wonder-sector-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("slot-row-0")).toBeInTheDocument();
  });
});
