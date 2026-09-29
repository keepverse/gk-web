import { describe, expect, it } from "vitest";
import {
  RARITY_IDS,
  compareRarityDesc,
  rarityBadge,
  rarityOrdinal,
  raritySortSlot,
  rarityTintToken,
  UNKNOWN_RARITY_SLOT
} from "./rarityLadder";

describe("rarityOrdinal", () => {
  it("orders the ten rungs weakest first", () => {
    expect(RARITY_IDS).toHaveLength(10);
    expect(rarityOrdinal("chaff")).toBe(0);
    expect(rarityOrdinal("fused")).toBe(4);
    expect(rarityOrdinal("almanac")).toBe(9);
  });

  it("returns null for retired and unknown ids instead of a default", () => {
    for (const retired of ["common", "rare", "epic", "legendary", "mythic", ""]) {
      expect(rarityOrdinal(retired)).toBeNull();
    }
  });
});

describe("raritySortSlot", () => {
  it("parks unknowns after the ladder, explicitly not a rung", () => {
    expect(UNKNOWN_RARITY_SLOT).toBe(RARITY_IDS.length);
    expect(raritySortSlot("legendary")).toBe(UNKNOWN_RARITY_SLOT);
    expect(raritySortSlot("almanac")).toBeLessThan(UNKNOWN_RARITY_SLOT);
  });
});

describe("compareRarityDesc", () => {
  it("sorts strongest first and parks unknowns last", () => {
    expect(compareRarityDesc("almanac", "chaff")).toBeLessThan(0);
    expect(compareRarityDesc("chaff", "almanac")).toBeGreaterThan(0);
    expect(compareRarityDesc("fused", "fused")).toBe(0);
    // Unknowns park last in EITHER direction — descending ordinals alone would surface them first.
    expect(compareRarityDesc("legendary", "almanac")).toBeGreaterThan(0);
    expect(compareRarityDesc("almanac", "legendary")).toBeLessThan(0);
    expect(compareRarityDesc("legendary", "mythic")).toBe(0);
  });
});

describe("rarityBadge", () => {
  it("capitalizes known ids and marks unknowns visibly", () => {
    expect(rarityBadge("fused")).toBe("Fused");
    expect(rarityBadge("legendary")).toBe("Legendary (unknown rarity)");
  });
});

describe("rarityTintToken", () => {
  it("rises two rungs per token and falls back neutral for unknowns", () => {
    expect(rarityTintToken("chaff")).toBe("border-rarity-1");
    expect(rarityTintToken("almanac")).toBe("border-rarity-5");
    expect(rarityTintToken("legendary")).toBe("border-border");
  });
});
