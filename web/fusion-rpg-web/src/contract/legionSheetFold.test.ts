import { describe, expect, it } from "vitest";
import type { LegionCargoDto } from "@/lib/bus/world";
import {
  foldLegionCargoSheet,
  legionCargoGate,
  legionSheetGateCopyKey,
  legionSheetReasonKey,
  legionCargoBusKind
} from "./adapt";
import { findEmptyPendingReasons } from "./contractGuard";
import { LEGION_SHEET_COPY, holderSentence, legionSheetCopy } from "@/stages/world/legionSheet/copyCatalog";

/**
 * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1, spec §§Design 5–7)
 * — the cargo-fold: fractions from the DTO's four numbers, gate-flag
 * selection, seq-order rows, and the closed reason→copy-key vocabulary.
 * Pure functions over hand-built wire shapes matching `WorldDtos.cs`
 * field-for-field; the server half is proved over HTTP by 4A.1/4A.3 suites.
 */

const cargoDto: LegionCargoDto = {
  worldId: "w-1",
  entityId: "e-dave-legion-1",
  asOfTurn: 3,
  rows: [
    { seq: 1, kind: "stack", instanceId: null, containerId: "cont-b", qty: 4, weightEach: 5, rowWeight: 20 },
    { seq: 0, kind: "instance", instanceId: "inst-a", containerId: null, qty: null, weightEach: 10, rowWeight: 10 }
  ],
  weightUsed: 30,
  weightCapacity: 300,
  slotsUsed: 2,
  slotCapacity: 6
};

describe("foldLegionCargoSheet — fractions from the four numbers, capacities copied", () => {
  it("folds the two fractions and copies capacities verbatim", () => {
    const fold = foldLegionCargoSheet(cargoDto, { ownerFactionId: "dave" });
    expect(fold.worldId).toBe("w-1");
    expect(fold.entityId).toBe("e-dave-legion-1");
    expect(fold.asOfTurn).toBe(3);
    expect(fold.slots.fraction).toBeCloseTo(2 / 6);
    expect(fold.weight.fraction).toBeCloseTo(0.1);
    expect(fold.slots.used).toEqual({ unit: "count", value: 2 });
    expect(fold.slots.capacity).toEqual({ unit: "count", value: 6 });
    expect(fold.weight.used).toEqual({ unit: "count", value: 30 });
    expect(fold.weight.capacity).toEqual({ unit: "count", value: 300 });
    expect(fold.weight.usedExact).toBe("30");
    expect(fold.weight.capacityExact).toBe("300");
    expect(fold.headerInputs.ownerFactionId).toBe("dave");
    expect(findEmptyPendingReasons(fold)).toEqual([]);
  });

  it("emits rows in seq order with snapshot weights, never recomputed", () => {
    const fold = foldLegionCargoSheet(cargoDto);
    expect(fold.rows.map((r) => r.seq)).toEqual([0, 1]);
    expect(fold.rows[0]).toMatchObject({
      seq: 0,
      kind: "instance",
      instanceId: "inst-a",
      state: "carried",
      copyKey: null,
      nameFallback: "#0"
    });
    expect(fold.rows[0]!.weight).toEqual({ unit: "count", value: 10 });
    expect(fold.rows[1]).toMatchObject({ seq: 1, kind: "stack", containerId: "cont-b", qty: 4 });
    expect(fold.rows[1]!.weight).toEqual({ unit: "count", value: 20 });
  });

  it("folds null fractions when capacity is not positive, gate none", () => {
    const fold = foldLegionCargoSheet({ ...cargoDto, weightCapacity: 0, slotCapacity: 0 });
    expect(fold.weight.fraction).toBeNull();
    expect(fold.slots.fraction).toBeNull();
    expect(fold.gateFlag).toBe("none");
  });
});

describe("legionCargoGate — the tighter gate, stable on ties", () => {
  it("flags the tighter fraction", () => {
    expect(legionCargoGate(0.1, 2 / 6)).toBe("slots");
    expect(legionCargoGate(0.9, 0.3)).toBe("weight");
  });

  it("returns none only when both denominators are not positive", () => {
    expect(legionCargoGate(null, null)).toBe("none");
  });

  it("resolves an exact tie to slots (arbitrary but stable)", () => {
    expect(legionCargoGate(0.5, 0.5)).toBe("slots");
  });

  it("maps the gate back to its refusal copy key", () => {
    expect(legionSheetGateCopyKey("weight")).toBe("cargo.full.weight");
    expect(legionSheetGateCopyKey("slots")).toBe("cargo.full.slots");
    expect(legionSheetGateCopyKey("none")).toBeNull();
  });
});

describe("legionSheetReasonKey — the closed §Design 7 vocabulary, nothing invented", () => {
  it("maps success details by prefix (the suffix is data, not vocabulary)", () => {
    expect(legionSheetReasonKey("cargo.loaded:3")).toBe("cargo.done.load");
    expect(legionSheetReasonKey("cargo.unloaded:7")).toBe("cargo.done.unload");
    expect(legionSheetReasonKey("cargo.transferred:9")).toBe("cargo.done.hand");
    expect(legionSheetReasonKey("cargo.deposited:2")).toBe("cargo.done.deposit");
    expect(legionSheetReasonKey("cargo.withdrawn:4")).toBe("cargo.done.withdraw");
  });

  it("splits cache.claimed into all (nothing skipped) vs partial (anything left behind)", () => {
    expect(legionSheetReasonKey("cache.claimed:3+0")).toBe("cache.claimed.all");
    expect(legionSheetReasonKey("cache.claimed:0+0")).toBe("cache.claimed.all");
    expect(legionSheetReasonKey("cache.claimed:2+1")).toBe("cache.claimed.partial");
    expect(legionSheetReasonKey("cache.claimed:0+2")).toBe("cache.claimed.partial");
  });

  it("names the gate that fired", () => {
    expect(legionSheetReasonKey("cargo.over-weight")).toBe("cargo.full.weight");
    expect(legionSheetReasonKey("cargo.no-slots")).toBe("cargo.full.slots");
  });

  it("maps the cargo/cache caller-error family", () => {
    expect(legionSheetReasonKey("cargo.not-owned")).toBe("cargo.not-yours");
    expect(legionSheetReasonKey("cargo.not-found")).toBe("cargo.gone");
    expect(legionSheetReasonKey("cargo.not-present")).toBe("cargo.not-here");
    expect(legionSheetReasonKey("cargo.wrong-faction")).toBe("vault.held-by-other");
    expect(legionSheetReasonKey("cargo.sector-full")).toBe("vault.full");
    expect(legionSheetReasonKey("cargo.cross-empire")).toBe("cargo.other-empire");
    expect(legionSheetReasonKey("cache.unreachable")).toBe("cache.gone");
  });

  it("maps the band caller-error family, distinct from empty", () => {
    expect(legionSheetReasonKey("entity.not-yours")).toBe("band.not-yours");
    expect(legionSheetReasonKey("entity.unknown")).toBe("band.unknown");
    expect(legionSheetReasonKey("entity.missing")).toBe("band.missing");
    expect(legionSheetReasonKey("entity.gone")).toBe("band.gone");
    expect(legionSheetReasonKey("entity.routed")).toBe("band.routed");
  });

  it("maps the authoring-time family to order.malformed (dev tooling, never player prose)", () => {
    for (const reason of [
      "cache.missing",
      "sector.missing",
      "cargo.kind-unknown",
      "cargo.ref-missing",
      "cargo.seq-missing",
      "cargo.target-missing",
      "command.id-missing",
      "kind.unknown"
    ]) {
      expect(legionSheetReasonKey(reason)).toBe("order.malformed");
    }
  });

  it("maps the reserved spent shape without a finalized sentence", () => {
    expect(legionSheetReasonKey("entity.spent")).toBe("act.spent");
    expect(LEGION_SHEET_COPY["act.spent"].sentence).toBeNull();
  });

  it("maps correlation.missing to no-copy (named, never produced)", () => {
    expect(legionSheetReasonKey("correlation.missing")).toBeNull();
  });

  it("maps anything outside the closed list to null — the fold never invents copy", () => {
    expect(legionSheetReasonKey("world.unknown")).toBeNull();
    expect(legionSheetReasonKey("ok")).toBeNull();
    expect(legionSheetReasonKey("")).toBeNull();
  });
});

describe("legionCargoBusKind — the closed six-kind bus carried for reuse", () => {
  it("maps the three tab actions plus the three carried for storage-cache-ui", () => {
    expect(legionCargoBusKind({ type: "cargo.load", entityId: "e", cargoKind: "instance" })).toBe("load-cargo");
    expect(legionCargoBusKind({ type: "cargo.unload", entityId: "e", seq: 0 })).toBe("unload-cargo");
    expect(legionCargoBusKind({ type: "cargo.hand-to-band", entityId: "e", targetEntityId: "t", seq: 0 })).toBe(
      "transfer-cargo"
    );
    expect(legionCargoBusKind({ type: "cargo.deposit", entityId: "e", sectorId: "s", seq: 0 })).toBe("deposit-cargo");
    expect(legionCargoBusKind({ type: "cargo.withdraw", entityId: "e", sectorId: "s", seq: 0 })).toBe("withdraw-cargo");
    expect(legionCargoBusKind({ type: "cache.pick-up", entityId: "e", cacheId: "c" })).toBe("claim-cache");
  });
});

describe("copyCatalog — authored draft sentences, no engine words", () => {
  it("carries a sentence for every player-facing key, none for dev-only and reserved", () => {
    expect(legionSheetCopy("cargo.done.load")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cargo.done.unload")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cargo.done.hand")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cache.claimed.partial")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cache.claimed.all")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cargo.full.weight")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("cargo.full.slots")).toMatch(/^DRAFT: /);
    expect(legionSheetCopy("order.malformed")).toBeNull();
    expect(legionSheetCopy("act.spent")).toBeNull();
  });

  it("names the live holder inside the vault refusal, never a cached faction", () => {
    expect(holderSentence("ember")).toContain("ember");
    expect(legionSheetCopy("vault.held-by-other", { holder: "ember" })).toContain("ember");
    expect(legionSheetCopy("vault.held-by-other", { holder: null })).toMatch(/^DRAFT: /);
  });

  it("keeps engine vocabulary off the player surface", () => {
    const banned = ["typeId", "Seq", "correlationId", "rpg_", "place_kind", "CommandId"];
    for (const [key, entry] of Object.entries(LEGION_SHEET_COPY)) {
      if (entry.sentence) {
        for (const word of banned) {
          expect(entry.sentence, key).not.toContain(word);
        }
      }
    }
  });
});
