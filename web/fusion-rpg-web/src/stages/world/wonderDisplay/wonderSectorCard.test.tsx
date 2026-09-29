import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Magnitude, SectorView, SlotView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { lookupThemePack } from "@/features/gui-lego/themeRegistry";
import { WonderSectorCard } from "./WonderSectorCard";
import type { WonderDisplayAction } from "./wonderDisplayBus";
import type { WonderCatalogRow } from "./wonderDisplayFold";

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });
const count = (value: number): Magnitude => ({ unit: "count", value });
const perMille = (value: number): Magnitude => ({ unit: "perMilleRatio", op: "absolute", value });

function sector(overrides: Partial<SectorView> = {}): SectorView {
  return {
    sectorId: "s-1",
    typeId: "plains",
    climate: null,
    ownerFactionId: "dave",
    intel: "Watched",
    intelAge: 0,
    phase: "Held",
    dangerBand: count(0),
    developmentLevel: count(0),
    stability: perMille(1000),
    pressure: perMille(0),
    fractureIntensity: perMille(1000),
    habitable: true,
    layoutX: 0,
    layoutY: 0,
    loam: {
      production: loam(140),
      upkeep: loam(60),
      net: loam(80),
      stock: loam(10),
      capacity: known(loam(200)),
      upkeepBreakdown: {
        base: loam(10),
        garrison: loam(6),
        development: loam(15),
        danger: loam(9),
        wonderUpkeep: loam(0),
        intensityMilli: perMille(1150),
        handicapMilli: perMille(1000)
      }
    },
    component: {
      componentId: null,
      production: loam(0),
      upkeep: loam(0),
      net: loam(0),
      stock: loam(0)
    },
    willReleaseNextTurn: false,
    lifelineCost: pendingWithReason("lifelines not requested"),
    lifeline: pendingWithReason("lifelines not requested"),
    wardenBindingId: known(null),
    neglectedTurns: known(count(0)),
    wonderLiveCountSector: count(0),
    wonderLiveCountEmpire: count(0),
    wonderProductionContribution: loam(0),
    ...overrides
  };
}

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

const STANDING = slot({ structureId: "standing-stones", wonderScope: "Sector", wonderRarity: "Common" });
const SUNSPIRE_RISING = slot({
  slotIndex: 1,
  slotTypeId: "shrine",
  structureId: "sunspire-throne",
  wonderScope: "Empire",
  wonderRarity: "Unique",
  constructionTurnsRemaining: known(2)
});
const SUNSPIRE_ROW: WonderCatalogRow = { structureId: "sunspire-throne", existenceCap: 3, relicCost: 3, buildTurns: 6 };

describe("WonderSectorCard — recipe landmarks (both 4B.1 rows)", () => {
  it("standing-stones renders every identity landmark with pack paint, no raw id", () => {
    const { container } = render(<WonderSectorCard slot={STANDING} sector={sector()} />);
    expect(screen.getByTestId("wonder-sector-card")).toBeInTheDocument();
    expect(screen.getByTestId("wonder-name")).toHaveTextContent("Standing Stones");
    expect(screen.getByTestId("wonder-scope-badge")).toHaveTextContent("Sector");
    expect(screen.getByTestId("wonder-rarity-badge")).toHaveTextContent("Common");
    expect(screen.getByTestId("wonder-effect")).toBeInTheDocument();
    expect(container.textContent).not.toContain("standing-stones");
    // Badges resolve pack paint (shared slots), never literals in piece code.
    expect(screen.getByTestId("wonder-scope-badge").getAttribute("data-theme")).toBe("wonder-scope.Sector");
    expect(screen.getByTestId("wonder-rarity-badge").getAttribute("data-theme")).toBe("wonder-rarity.Common");
    expect(screen.getByTestId("wonder-scope-badge").getAttribute("style")).toContain("--piece-accent");
  });

  it("a built Common renders no progress slot and no cap line", () => {
    render(<WonderSectorCard slot={STANDING} sector={sector()} />);
    expect(screen.queryByTestId("wonder-progress")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wonder-capacity-meter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wonder-cap-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wonder-cap-pending")).not.toBeInTheDocument();
  });

  it("a rising Unique renders name + rising sentence + the shared meter + the live cap line", () => {
    render(
      <WonderSectorCard
        slot={SUNSPIRE_RISING}
        sector={sector({ wonderLiveCountEmpire: count(1) })}
        catalogRow={SUNSPIRE_ROW}
      />
    );
    expect(screen.getByTestId("wonder-progress")).toHaveTextContent("rising — 2 nights left");
    const meter = screen.getByTestId("wonder-capacity-meter");
    // Consumed by name (4D.1 owns the piece) — never a forked twin.
    expect(meter.getAttribute("data-piece")).toBe("capacity-meter");
    expect(meter.getAttribute("data-density")).toBe("progress");
    expect(screen.getByTestId("wonder-cap-line")).toHaveTextContent("1 of 3 raised");
  });

  it("a pre-catalog Unique renders the designed pending state + an enabled retry", () => {
    render(<WonderSectorCard slot={SUNSPIRE_RISING} sector={sector()} catalogRow={null} />);
    const pending = screen.getByTestId("wonder-cap-pending");
    expect(pending.textContent).not.toMatch(/\d/);
    const retry = screen.getByTestId("wonder-retry");
    expect(retry).toBeEnabled();
  });

  it("an unknown Sector id renders the placeholder + expand — never the id", () => {
    render(
      <WonderSectorCard
        slot={slot({ structureId: "sunken-chapel", wonderScope: "Sector", wonderRarity: "Common" })}
        sector={sector()}
      />
    );
    const card = screen.getByTestId("wonder-sector-card");
    expect(card.getAttribute("data-reading")).toBe("placeholder");
    expect(screen.getByTestId("wonder-placeholder")).toBeInTheDocument();
    expect(card.textContent).not.toContain("sunken-chapel");
    expect(screen.getByTestId("wonder-expand")).toBeEnabled();
  });

  it("an unknown World id renders the locked teaser in not-yet paint", () => {
    render(
      <WonderSectorCard
        slot={slot({ structureId: "world-engine", wonderScope: "World", wonderRarity: "Unique" })}
        sector={sector()}
      />
    );
    expect(screen.getByTestId("wonder-sector-card").getAttribute("data-reading")).toBe("locked-teaser");
    expect(screen.getByTestId("wonder-locked-reason")).toHaveTextContent("not yet sung into the world");
    expect(screen.getByTestId("wonder-scope-badge").getAttribute("data-theme")).toBe("wonder-scope.World");
  });

  it("non-Wonder slots render nothing (the legacy sentence owns them)", () => {
    const { container } = render(
      <WonderSectorCard slot={slot({ structureId: "well" })} sector={sector()} />
    );
    expect(container.textContent).toBe("");
  });

  it("the shelf line links the sibling shelf by name — never re-implemented, never disabled", () => {
    render(<WonderSectorCard slot={STANDING} sector={sector()} />);
    const link = screen.getByTestId("wonder-relic-shelf-link");
    expect(link.getAttribute("data-shelf")).toBe("wonder-relic-shelf");
    expect(link).toBeEnabled();
  });

  it("every button files the closed bus (card.expand / reading.open / retry)", () => {
    const seen: WonderDisplayAction[] = [];
    const { unmount } = render(
      <WonderSectorCard
        slot={slot({ structureId: "sunken-chapel", wonderScope: "Sector", wonderRarity: "Common" })}
        sector={sector()}
        onEvent={(a) => seen.push(a)}
      />
    );
    fireEvent.click(screen.getByTestId("wonder-expand"));
    expect(seen).toEqual([{ event: "wonder-display.card.expand", structureId: "sunken-chapel" }]);
    unmount();

    render(<WonderSectorCard slot={STANDING} sector={sector()} onEvent={(a) => seen.push(a)} />);
    fireEvent.click(screen.getByTestId("wonder-relic-shelf-link"));
    expect(seen[1]).toEqual({ event: "wonder-display.reading.open", structureId: "standing-stones" });
  });

  it("badge paint comes from the packs at render time (piece declares slots only)", () => {
    render(<WonderSectorCard slot={STANDING} sector={sector()} />);
    const badge = screen.getByTestId("wonder-scope-badge");
    const pack = lookupThemePack({ kind: "wonder-scope", id: "Sector" });
    expect(pack.themeId).toBe("wonder-scope.Sector");
    expect(badge.getAttribute("style")).toContain(pack.css["--piece-accent"]!);
  });
});

describe("WonderSectorCard — no hard-coded paint in piece code (Lego violation guard)", () => {
  it("neither the component nor the fold carries a hex literal", () => {
    const root = "src/stages/world/wonderDisplay";
    for (const file of ["WonderSectorCard.tsx", "wonderDisplayFold.ts", "wonderDisplayBus.ts"]) {
      const text = readFileSync(`${root}/${file}`, "utf8");
      expect(text).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
