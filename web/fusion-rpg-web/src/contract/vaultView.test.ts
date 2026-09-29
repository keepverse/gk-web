import { describe, expect, it } from "vitest";
import type { VaultView } from "./types";
import { vaultHeaderOwner, vaultPhase } from "./vaultView";
import { adaptSectorStorage } from "./adapt";
import { claimReasonKey } from "./adapt";
import type { SectorStorageDto } from "@/lib/bus/world";

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault-block
 * fold leg: lifecycle binding + capture-header input. Rows, room, fractions, and the rest of
 * the refusal vocabulary stay owned by 4A.3's `claimEndpoints.test.ts` — this file proves only
 * what 4D.2a adds, plus the two prohibitions that guard it.
 */

const count = (value: number) => ({ unit: "count" as const, value });

function vault(overrides: Partial<VaultView> = {}): VaultView {
  return {
    worldId: "w-1",
    sectorId: "homeworld",
    ownerFactionId: "dave",
    asOfTurn: 3,
    rows: [],
    slotsUsed: count(0),
    slotCapacity: count(6),
    slotFraction: 0,
    room: count(6),
    ...overrides
  };
}

describe("vaultPhase — locked vs empty vs ready, never confused", () => {
  it("SlotCapacity == 0 binds locked (no vault built — the relic-vault unlock line's state)", () => {
    expect(vaultPhase(vault({ slotCapacity: count(0), slotsUsed: count(0) }))).toBe("locked");
  });

  it("empty vault with capacity binds empty (with next action), never locked", () => {
    expect(vaultPhase(vault({ slotCapacity: count(6), slotsUsed: count(0) }))).toBe("empty");
  });

  it("a vault holding rows binds ready", () => {
    expect(
      vaultPhase(
        vault({
          slotCapacity: count(6),
          slotsUsed: count(1),
          rows: [{ seq: 0, kind: "instance", instanceId: "inst-c", containerId: null, qty: null }]
        })
      )
    ).toBe("ready");
  });
});

describe("vaultHeaderOwner — the live capture-header input, untouched", () => {
  it("passes the owner through for the always-on 'held by X' header", () => {
    expect(vaultHeaderOwner(vault({ ownerFactionId: "dave" }))).toBe("dave");
  });

  it("keeps null null — absence renders honestly, never a prettified id", () => {
    expect(vaultHeaderOwner(vault({ ownerFactionId: null }))).toBeNull();
  });
});

describe("4D.2a fog prohibition — the fold carries nothing to compare or hide", () => {
  it("a folded vault view has no position and no visibility member", () => {
    const dto: SectorStorageDto = {
      worldId: "w-1",
      sectorId: "homeworld",
      ownerFactionId: "dave",
      asOfTurn: 3,
      rows: [{ seq: 0, kind: "instance", instanceId: "inst-c", containerId: null, qty: null }],
      slotsUsed: 1,
      slotCapacity: 6
    };
    const view = adaptSectorStorage(dto) as unknown as Record<string, unknown>;
    for (const key of Object.keys(view)) {
      expect(key.toLowerCase()).not.toContain("position");
      expect(key.toLowerCase()).not.toContain("visible");
    }
    for (const row of adaptSectorStorage(dto).rows as unknown as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty("visible");
    }
  });
});

describe("4D.2a fits/left-behind leg — the committed claim string maps to its copy key", () => {
  it("cache.claimed:<c>+<s> folds to the cache.claimed key (per-row paint mounts in 4D.2b)", () => {
    expect(claimReasonKey("cache.claimed:2+1")).toBe("cache.claimed");
    expect(claimReasonKey("cache.unreachable")).toBe("cache.unreachable");
  });
});
