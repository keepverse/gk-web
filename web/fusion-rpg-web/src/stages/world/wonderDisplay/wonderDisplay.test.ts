import { describe, expect, it } from "vitest";
import catalogJson from "../../../../../../data/seed/display/wonder-display.v1.json";
import standingStonesSeed from "../../../../../../data/seed/structures/wonder/standing-stones.json";
import sunspireThroneSeed from "../../../../../../data/seed/structures/wonder/sunspire-throne.json";
import type { Magnitude, SectorView, SlotView } from "@/contract/types";
import { absent, known, pendingWithReason } from "@/contract/pending";
import {
  foldWonderCard,
  foldWonderRefusal,
  isWonderRefusalReason,
  shouldMountWonderCard,
  wonderDisplayCatalog,
  wonderTeaser,
  wonderThemeRefs,
  WONDER_RARITIES,
  WONDER_REFUSAL_REASONS,
  WONDER_SCOPES,
  type WonderCatalogRow
} from "./wonderDisplayFold";
import {
  isWonderDisplayEvent,
  wonderDisplayAction,
  WONDER_DISPLAY_BUS,
  WONDER_DISPLAY_EVENTS
} from "./wonderDisplayBus";

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

const STANDING_ROW: WonderCatalogRow = { structureId: "standing-stones", existenceCap: 2, relicCost: 1, buildTurns: 4 };
const SUNSPIRE_ROW: WonderCatalogRow = { structureId: "sunspire-throne", existenceCap: 3, relicCost: 3, buildTurns: 6 };

type SeedFile = {
  entries: Array<{ name: string; magnitudes: { wonderScope: string; wonderRarity: string; relicCost: number } }>;
};
const standingSeed = standingStonesSeed as unknown as SeedFile;
const sunspireSeed = sunspireThroneSeed as unknown as SeedFile;

describe("wonderDisplayFold — identity over ids (both 4B.1 rows)", () => {
  it("standing-stones renders its authored name + badges + effect — never the raw id", () => {
    const reading = foldWonderCard({
      slot: slot({ structureId: "standing-stones", wonderScope: "Sector", wonderRarity: "Common" }),
      sector: sector()
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.name).toBe("Standing Stones");
    expect(reading.name).not.toContain("standing-stones");
    expect(reading.scope).toBe("Sector");
    expect(reading.rarity).toBe("Common");
    expect(reading.effectSentence.length).toBeGreaterThan(0);
    expect(reading.effectSentence).not.toContain("standing-stones");
  });

  it("sunspire-throne renders its authored Empire/Unique reading — never the raw id", () => {
    const reading = foldWonderCard({
      slot: slot({
        slotTypeId: "shrine",
        structureId: "sunspire-throne",
        wonderScope: "Empire",
        wonderRarity: "Unique"
      }),
      sector: sector()
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.name).toBe("Sunspire Throne");
    expect(reading.scope).toBe("Empire");
    expect(reading.rarity).toBe("Unique");
  });

  it("names survive without the wire facet — the display catalog is keyed by structureId alone", () => {
    const reading = foldWonderCard({ slot: slot({ structureId: "standing-stones" }), sector: sector() });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.name).toBe("Standing Stones");
    expect(reading.scope).toBe("Sector");
  });

  it("display names mirror the 4B.1 content rows (parity, not duplication)", () => {
    const catalog = wonderDisplayCatalog();
    expect(catalog.identities["standing-stones"]!.name).toBe(standingSeed.entries[0]!.name);
    expect(catalog.identities["sunspire-throne"]!.name).toBe(sunspireSeed.entries[0]!.name);
    expect(catalog.identities["standing-stones"]!.scope).toBe(standingSeed.entries[0]!.magnitudes.wonderScope);
    expect(catalog.identities["standing-stones"]!.rarity).toBe(standingSeed.entries[0]!.magnitudes.wonderRarity);
    expect(catalog.identities["sunspire-throne"]!.scope).toBe(sunspireSeed.entries[0]!.magnitudes.wonderScope);
    expect(catalog.identities["sunspire-throne"]!.rarity).toBe(sunspireSeed.entries[0]!.magnitudes.wonderRarity);
  });
});

describe("wonderDisplayFold — mount rule", () => {
  it("empty slots never mount the card", () => {
    expect(shouldMountWonderCard({ slot: slot(), sector: sector() })).toBe(false);
    expect(foldWonderCard({ slot: slot(), sector: sector() })).toEqual({ kind: "not-wonder" });
  });

  it("non-Wonder structures stay on the legacy sentence (world-stage owns them, not this module)", () => {
    const well = slot({ structureId: "well", constructionTurnsRemaining: known(null) });
    expect(shouldMountWonderCard({ slot: well, sector: sector() })).toBe(false);
    expect(foldWonderCard({ slot: well, sector: sector() })).toEqual({ kind: "not-wonder" });
  });

  it("an unknown id the provided catalog does not know mounts the placeholder", () => {
    const input = {
      slot: slot({ structureId: "sunken-chapel" }),
      sector: sector(),
      catalogRow: null,
      catalogProvided: true
    };
    expect(shouldMountWonderCard(input)).toBe(true);
    expect(foldWonderCard(input).kind).toBe("placeholder");
  });

  it("without a catalog read, an unknown id is indistinguishable from unread data — no claim", () => {
    const input = { slot: slot({ structureId: "sunken-chapel" }), sector: sector() };
    expect(shouldMountWonderCard(input)).toBe(false);
    expect(foldWonderCard(input)).toEqual({ kind: "not-wonder" });
  });
});

describe("wonderDisplayFold — unknown-id placeholder rule (never the id)", () => {
  it("a facet-declared Wonder with no display row renders the placeholder + card.expand", () => {
    const reading = foldWonderCard({
      slot: slot({ structureId: "sunken-chapel", wonderScope: "Sector", wonderRarity: "Common" }),
      sector: sector()
    });
    expect(reading.kind).toBe("placeholder");
    if (reading.kind !== "placeholder") return;
    expect(reading.copy).toBe(wonderDisplayCatalog().placeholder.copy);
    expect(reading.action).toBe("wonder-display.card.expand");
    expect(reading.copy).not.toContain("sunken-chapel");
  });

  it("a reserved-scope unknown renders its locked teaser, never the generic placeholder", () => {
    const reading = foldWonderCard({
      slot: slot({ structureId: "world-engine", wonderScope: "World", wonderRarity: "Unique" }),
      sector: sector()
    });
    expect(reading.kind).toBe("placeholder");
    if (reading.kind !== "placeholder") return;
    expect(reading.lockedReason).toBe("not yet sung into the world");
    expect(reading.copy).toBe("not yet sung into the world");
  });
});

describe("wonderDisplayFold — construction progress (shared meter, player words)", () => {
  it("under-construction renders rising with the known night count", () => {
    const reading = foldWonderCard({
      slot: slot({
        structureId: "standing-stones",
        wonderScope: "Sector",
        wonderRarity: "Common",
        constructionTurnsRemaining: known(3)
      }),
      sector: sector()
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.progress).toEqual({ state: "rising", nightsLeft: 3 });
  });

  it("built renders no progress slot", () => {
    for (const turns of [known(null), known(0)]) {
      const reading = foldWonderCard({
        slot: slot({
          structureId: "standing-stones",
          wonderScope: "Sector",
          wonderRarity: "Common",
          constructionTurnsRemaining: turns
        }),
        sector: sector()
      });
      expect(reading.kind).toBe("wonder");
      if (reading.kind !== "wonder") return;
      expect(reading.progress).toEqual({ state: "built" });
    }
  });

  it("a pending estimate renders the wire's pending copy — never a fabricated count", () => {
    const reading = foldWonderCard({
      slot: slot({
        structureId: "standing-stones",
        wonderScope: "Sector",
        wonderRarity: "Common",
        constructionTurnsRemaining: pendingWithReason("not yet estimated")
      }),
      sector: sector()
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.progress).toEqual({ state: "pending", reason: "not yet estimated" });
  });

  it("an absent estimate reads as standing work (slotRowState's own fall-through agrees)", () => {
    const reading = foldWonderCard({
      slot: slot({
        structureId: "standing-stones",
        wonderScope: "Sector",
        wonderRarity: "Common",
        constructionTurnsRemaining: absent()
      }),
      sector: sector()
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.progress).toEqual({ state: "built" });
  });
});

describe("wonderDisplayFold — live cap lines (LOCKED shown) and the pending-state rule", () => {
  it("Common renders no cap line — uncapped by construction (GG-64)", () => {
    const reading = foldWonderCard({
      slot: slot({ structureId: "standing-stones", wonderScope: "Sector", wonderRarity: "Common" }),
      sector: sector({ wonderLiveCountSector: count(5) }),
      catalogRow: STANDING_ROW
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.cap).toEqual({ state: "none" });
  });

  it("Unique Sector renders N of cap raised from the sector live count", () => {
    const reading = foldWonderCard({
      slot: slot({ slotTypeId: "shrine", structureId: "sunspire-throne", wonderScope: "Sector", wonderRarity: "Unique" }),
      sector: sector({ wonderLiveCountSector: count(1) }),
      catalogRow: { structureId: "x", existenceCap: 2, relicCost: 1 }
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.cap).toEqual({ state: "known", line: "1 of 2 raised" });
  });

  it("Unique Empire renders N of cap raised from the empire live count", () => {
    const reading = foldWonderCard({
      slot: slot({ slotTypeId: "shrine", structureId: "sunspire-throne", wonderScope: "Empire", wonderRarity: "Unique" }),
      sector: sector({ wonderLiveCountEmpire: count(1) }),
      catalogRow: SUNSPIRE_ROW
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.cap).toEqual({ state: "known", line: "1 of 3 raised" });
  });

  it("pre-catalog cap reads render the designed pending state — never a guessed number, never hidden", () => {
    const reading = foldWonderCard({
      slot: slot({ slotTypeId: "shrine", structureId: "sunspire-throne", wonderScope: "Empire", wonderRarity: "Unique" }),
      sector: sector({ wonderLiveCountEmpire: count(1) }),
      catalogRow: null
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.cap.state).toBe("pending");
    if (reading.cap.state !== "pending") return;
    expect(reading.cap.reason).toBe(wonderDisplayCatalog().pending.cap);
    expect(reading.cap.reason).not.toMatch(/\d/);
  });

  it("an unrepresentable cap renders pending, never rounded (overflow is RANGE)", () => {
    const reading = foldWonderCard({
      slot: slot({ slotTypeId: "shrine", structureId: "sunspire-throne", wonderScope: "Empire", wonderRarity: "Unique" }),
      sector: sector(),
      catalogRow: { structureId: "x", existenceCap: Number.MAX_SAFE_INTEGER + 1, relicCost: 3 }
    });
    expect(reading.kind).toBe("wonder");
    if (reading.kind !== "wonder") return;
    expect(reading.cap.state).toBe("pending");
  });

  it("relicCost rides the catalog row; unread reads null — never guessed", () => {
    const withRow = foldWonderCard({
      slot: slot({ structureId: "sunspire-throne", wonderScope: "Empire", wonderRarity: "Unique" }),
      sector: sector(),
      catalogRow: SUNSPIRE_ROW
    });
    const withoutRow = foldWonderCard({
      slot: slot({ structureId: "sunspire-throne", wonderScope: "Empire", wonderRarity: "Unique" }),
      sector: sector(),
      catalogRow: null
    });
    expect(withRow.kind === "wonder" && withRow.relicCost).toBe(3);
    expect(withoutRow.kind === "wonder" && withoutRow.relicCost).toBe(null);
  });
});

describe("wonderDisplayFold — refusals (the first FE handler; nothing consumed)", () => {
  it("all four wire reasons map to copy + next action + nothing-taken", () => {
    for (const reason of WONDER_REFUSAL_REASONS) {
      const reading = foldWonderRefusal(reason);
      expect(reading).not.toBeNull();
      expect(reading!.copy.length).toBeGreaterThan(0);
      expect(reading!.next.length).toBeGreaterThan(0);
      expect(reading!.nothingTaken).toBe(wonderDisplayCatalog().nothingTaken);
      expect(reading!.copy).not.toContain(reason);
    }
  });

  it("unknown reasons map to null — never rendered raw", () => {
    expect(foldWonderRefusal("build.cannot-afford")).toBeNull();
    expect(foldWonderRefusal("wonder.cap_reached")).toBeNull();
    expect(foldWonderRefusal("")).toBeNull();
  });

  it("the vocabulary is exactly the four server-owned reasons (closed, reason stated)", () => {
    expect([...WONDER_REFUSAL_REASONS]).toEqual([
      "wonder.cap-reached",
      "relic.count-mismatch",
      "relic.not-reachable",
      "build.cannot-afford-materials"
    ]);
    for (const reason of WONDER_REFUSAL_REASONS) expect(isWonderRefusalReason(reason)).toBe(true);
    expect(isWonderRefusalReason("relic.duplicate")).toBe(false);
  });
});

describe("wonderDisplayFold — teasers and theme slots", () => {
  it("reserved scopes and effect kinds each carry a locked reason — never an effect promise", () => {
    for (const key of ["scope.World", "scope.Multiverse", "kind.DefensePower", "kind.AuraGrant", "kind.EmpireBuff"]) {
      expect(wonderTeaser(key)).toBe("not yet sung into the world");
    }
    expect(wonderTeaser("scope.Sector")).toBeNull();
  });

  it("theme refs declare paint slots only (kinds the packs own, ids exact wire case)", () => {
    const refs = wonderThemeRefs("Sector", "Common");
    expect(refs).toEqual({
      scope: { kind: "wonder-scope", id: "Sector" },
      rarity: { kind: "wonder-rarity", id: "Common" }
    });
  });
});

describe("wonder-display catalog — closed shape (validation-ssot: envelope, never counts)", () => {
  it("every identity row carries name + closed scope/rarity + effect sentence", () => {
    const catalog = wonderDisplayCatalog();
    for (const [id, row] of Object.entries(catalog.identities)) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.name).not.toContain(id);
      expect((WONDER_SCOPES as readonly string[])).toContain(row.scope);
      expect((WONDER_RARITIES as readonly string[])).toContain(row.rarity);
      expect(row.effect.length).toBeGreaterThan(0);
    }
  });

  it("every wire reason has a refusal row (closure both directions)", () => {
    const catalog = wonderDisplayCatalog();
    expect(new Set(Object.keys(catalog.refusals))).toEqual(new Set(WONDER_REFUSAL_REASONS));
  });

  it("the placeholder is a closed-vocab row with the bus action (never a fallback string)", () => {
    const catalog = wonderDisplayCatalog();
    expect(catalog.placeholder.copy.length).toBeGreaterThan(0);
    expect(catalog.placeholder.action).toBe("wonder-display.card.expand");
    expect(isWonderDisplayEvent(catalog.placeholder.action)).toBe(true);
  });

  it("the raw JSON and the typed accessor agree (single source, no mirror to drift)", () => {
    expect(wonderDisplayCatalog()).toEqual(catalogJson);
  });
});

describe("wonderDisplayBus — closed vocabulary", () => {
  it("the bus name and its four events are closed", () => {
    expect(WONDER_DISPLAY_BUS).toBe("wonder-display");
    expect([...WONDER_DISPLAY_EVENTS]).toEqual([
      "wonder-display.card.expand",
      "wonder-display.reading.open",
      "wonder-display.teaser.explain",
      "wonder-display.retry"
    ]);
  });

  it("the constructor carries the structure id through", () => {
    expect(wonderDisplayAction("wonder-display.card.expand", "standing-stones")).toEqual({
      event: "wonder-display.card.expand",
      structureId: "standing-stones"
    });
  });

  it("an unmapped event throws loud (never a second silent vocabulary)", () => {
    expect(() => wonderDisplayAction("wonder-display.build", "standing-stones")).toThrow();
    expect(isWonderDisplayEvent("wonder-display.build")).toBe(false);
  });
});
