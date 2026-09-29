import { describe, expect, it } from "vitest";
import type {
  ClaimableCacheListDto,
  LegionCargoDto,
  SectorStorageDto
} from "@/lib/bus/world";
import {
  adaptClaimableCaches,
  adaptLegionCargo,
  adaptSectorStorage,
  claimReasonKey
} from "./adapt";
import { findEmptyPendingReasons } from "./contractGuard";

/**
 * empire-inventory-surfaces `claim-endpoints` (plan Task 4A.3) — the three FE folds.
 * Pure functions over hand-built wire shapes matching `WorldDtos.cs` field-for-field; the
 * server half is proved over HTTP in `ClaimEndpointsTests.cs`, this file proves the fold owns
 * only fractions + reason keys and never recomputes capacity, compares positions, or invents
 * copy.
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

const vaultDto: SectorStorageDto = {
  worldId: "w-1",
  sectorId: "homeworld",
  ownerFactionId: "dave",
  asOfTurn: 3,
  rows: [{ seq: 0, kind: "instance", instanceId: "inst-c", containerId: null, qty: null }],
  slotsUsed: 1,
  slotCapacity: 6
};

const pinsDto: ClaimableCacheListDto = {
  worldId: "w-1",
  entityId: "e-dave-legion-1",
  asOfTurn: 3,
  claimCostMilli: 250,
  caches: [
    { cacheId: "cc-1", placeKind: "world_sector", placeRef: "homeworld", sourceKind: "legion_death", itemCount: 2, createdUtc: "2026-09-15T00:00:00Z" }
  ]
};

describe("adaptLegionCargo — rows through, fractions folded, capacities copied", () => {
  it("maps rows field-for-field and folds the two fractions", () => {
    const view = adaptLegionCargo(cargoDto);
    expect(view.worldId).toBe("w-1");
    expect(view.entityId).toBe("e-dave-legion-1");
    expect(view.asOfTurn).toBe(3);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0]).toMatchObject({ seq: 0, kind: "instance", instanceId: "inst-a" });
    expect(view.rows[0]!.weightEach).toEqual({ unit: "count", value: 10 });
    expect(view.rows[1]).toMatchObject({ seq: 1, kind: "stack", containerId: "cont-b", qty: 4 });
    expect(view.weightFraction).toBeCloseTo(0.1);
    expect(view.slotFraction).toBeCloseTo(2 / 6);
    expect(findEmptyPendingReasons(view)).toEqual([]);
  });

  it("copies capacities verbatim — the fold never recomputes them", () => {
    const view = adaptLegionCargo(cargoDto);
    expect(view.weightCapacity).toEqual({ unit: "count", value: 300 });
    expect(view.slotCapacity).toEqual({ unit: "count", value: 6 });
    expect(view.weightUsed).toEqual({ unit: "count", value: 30 });
    expect(view.slotsUsed).toEqual({ unit: "count", value: 2 });
  });

  it("folds null fractions when capacity is not positive, never divides by zero", () => {
    const view = adaptLegionCargo({ ...cargoDto, weightCapacity: 0, slotCapacity: 0 });
    expect(view.weightFraction).toBeNull();
    expect(view.slotFraction).toBeNull();
  });
});

describe("adaptSectorStorage — rows through, room folded, owner untouched", () => {
  it("maps the vault row, folds room as capacity minus used, passes the owner through", () => {
    const view = adaptSectorStorage(vaultDto);
    expect(view.ownerFactionId).toBe("dave");
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ seq: 0, kind: "instance", instanceId: "inst-c" });
    expect(view.slotFraction).toBeCloseTo(1 / 6);
    expect(view.room).toEqual({ unit: "count", value: 5 });
    expect(findEmptyPendingReasons(view)).toEqual([]);
  });
});

describe("adaptClaimableCaches — presence plus count, no fog logic", () => {
  it("maps pins with count only and carries the staleness marker", () => {
    const view = adaptClaimableCaches(pinsDto);
    expect(view.asOfTurn).toBe(3);
    expect(view.pins).toHaveLength(1);
    expect(view.pins[0]).toMatchObject({
      cacheId: "cc-1",
      placeKind: "world_sector",
      placeRef: "homeworld"
    });
    expect(view.pins[0]!.itemCount).toEqual({ unit: "count", value: 2 });
  });

  it("carries the live claim price from the listing, never a literal", () => {
    const view = adaptClaimableCaches(pinsDto);
    expect(view.claimCostMilli).toBe(250);
  });

  it("carries no legion position — no client-side fog can be built on it", () => {
    const view = adaptClaimableCaches(pinsDto);
    for (const pin of view.pins) {
      expect(pin).not.toHaveProperty("atSectorId");
      expect(pin).not.toHaveProperty("onLaneId");
      expect(pin).not.toHaveProperty("visible");
    }
  });

  it("drops a cache of an unknown place kind rather than rendering it under an invented place", () => {
    const view = adaptClaimableCaches({
      ...pinsDto,
      caches: [
        ...pinsDto.caches,
        { cacheId: "cc-x", placeKind: "delve_room", placeRef: "r-1", sourceKind: "death", itemCount: 1, createdUtc: "" }
      ]
    });
    expect(view.pins).toHaveLength(1);
  });
});

describe("claimReasonKey — the closed §Design 5 vocabulary, nothing invented", () => {
  it("maps every verbatim wire string to its copy key", () => {
    expect(claimReasonKey("ok")).toBe("ok");
    expect(claimReasonKey("cache.claimed:2+1")).toBe("cache.claimed");
    expect(claimReasonKey("cache.claimed:0+0")).toBe("cache.claimed");
    expect(claimReasonKey("cache.unreachable")).toBe("cache.unreachable");
    expect(claimReasonKey("cargo.over-weight")).toBe("cargo.over-weight");
    expect(claimReasonKey("cargo.no-slots")).toBe("cargo.no-slots");
    expect(claimReasonKey("cargo.not-present")).toBe("cargo.not-present");
    expect(claimReasonKey("cargo.wrong-faction")).toBe("cargo.wrong-faction");
    expect(claimReasonKey("cargo.sector-full")).toBe("cargo.sector-full");
    expect(claimReasonKey("cargo.not-found")).toBe("cargo.not-found");
    expect(claimReasonKey("cargo.cross-empire")).toBe("cargo.cross-empire");
    expect(claimReasonKey("cargo.not-owned")).toBe("cargo.not-owned");
    // Named in the contract, never produced by the filer — mapped so no caller authors
    // copy for it by accident.
    expect(claimReasonKey("correlation.missing")).toBe("correlation.missing");
  });

  it("maps anything outside the closed list to null — the fold never invents copy", () => {
    expect(claimReasonKey("world.unknown")).toBeNull();
    expect(claimReasonKey("entity.not-yours")).toBeNull();
    expect(claimReasonKey("")).toBeNull();
  });
});
