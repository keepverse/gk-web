import { describe, expect, it } from "vitest";
import {
  CONTRACT_DEPLOY_FLOOR,
  capacityLabel,
  conditionOf,
  contractIndex,
  fieldingBlockReason,
  loyaltyFraction,
  rankLabel
} from "./contractView";
import type { ContractRowDto, ContractStateDto } from "../../lib/bus/contracts";

const row = (over: Partial<ContractRowDto> = {}): ContractRowDto => ({
  instanceId: "i-1",
  bound: true,
  loyalty: 300,
  rank: "bound",
  rankBonusMilli: 0,
  personality: "loyal",
  upkeepPerDay: 2,
  deployable: true,
  ...over
});

const state = (over: Partial<ContractStateDto> = {}): ContractStateDto => ({
  capacity: { used: 12, total: 12, purchasedSlots: 0, nextSlotPrice: 300, canBuy: true, maxSlots: 48 },
  dailyTribute: 24,
  deployFloor: CONTRACT_DEPLOY_FLOOR,
  loyaltyMax: 1000,
  contracts: [row()],
  ...over
});

describe("contract conditions", () => {
  it("separates unbound from insubordinate — different problems, different fixes", () => {
    expect(conditionOf(undefined)).toBe("unbound");
    expect(conditionOf(row({ bound: false }))).toBe("unbound");
    expect(conditionOf(row({ deployable: false, loyalty: 150 }))).toBe("insubordinate");
    expect(conditionOf(row())).toBe("bound");
  });

  it("gives a picker the reason it greys a creature out", () => {
    expect(fieldingBlockReason(row())).toBeNull();
    expect(fieldingBlockReason(undefined)).toMatch(/bind/i);
    expect(fieldingBlockReason(row({ deployable: false }))).toMatch(/ritual/i);
  });
});

describe("loyalty display", () => {
  it("fills the bar proportionally and clamps both ends", () => {
    expect(loyaltyFraction(0)).toBe(0);
    expect(loyaltyFraction(500)).toBe(0.5);
    expect(loyaltyFraction(1000)).toBe(1);
    expect(loyaltyFraction(1500)).toBe(1);
    expect(loyaltyFraction(-5)).toBe(0);
  });

  it("labels every rank the server can send", () => {
    expect(rankLabel("devoted")).toBe("Devoted");
    expect(rankLabel("insubordinate")).toBe("Insubordinate");
    expect(rankLabel("mystery")).toBe("mystery"); // unknown ranks pass through, never blank
  });
});

describe("capacity header", () => {
  it("shows slots, the next price, and the daily tribute", () => {
    expect(capacityLabel(state())).toBe("12 / 12 slots · next 300 Souls · 24 Souls/day");
  });

  it("says so when the ceiling is reached instead of quoting a price", () => {
    const maxed = state({
      capacity: { used: 48, total: 48, purchasedSlots: 36, nextSlotPrice: 11100, canBuy: false, maxSlots: 48 },
      dailyTribute: 96
    });
    expect(capacityLabel(maxed)).toBe("48 / 48 slots · all slots bought · 96 Souls/day");
  });
});

describe("contract index", () => {
  it("keys rows by instance and tolerates a missing fetch", () => {
    expect(contractIndex(state())["i-1"].rank).toBe("bound");
    expect(contractIndex(undefined)).toEqual({});
  });
});
