import { describe, expect, it } from "vitest";
import fixture from "@/stages/world/fixtures/first-light.json";
import type { WorldStateDto } from "@/lib/bus/world";
import {
  adaptWorldForce,
  adaptWorldLane,
  adaptWorldLegion,
  adaptWorldSector,
  adaptWorldSlot,
  adaptWorldTurnEvent
} from "./adapt";
import { findEmptyPendingReasons } from "./contractGuard";

/**
 * world-stage W5 — `adaptWorld*` against the byte-pinned fixture. `first-light.json` is generated
 * and asserted byte-for-byte by `WorldFixtureTests.cs`, so this test round-trips real server output,
 * not a hand-written double.
 */

const world = fixture as WorldStateDto;

function sector(id: string) {
  const s = world.sectors.find((x) => x.sectorId === id);
  if (!s) throw new Error(`fixture missing sector ${id}`);
  return s;
}

describe("adaptWorldSector — the whole fixture, no throws, no empty pending reasons", () => {
  it("adapts every sector in first-light.json", () => {
    for (const dto of world.sectors) {
      const view = adaptWorldSector(dto);
      expect(view.sectorId).toBe(dto.sectorId);
      expect(findEmptyPendingReasons(view)).toEqual([]);
    }
  });

  it("adapts every lane, force and legion in the fixture without throwing", () => {
    for (const dto of world.lanes) {
      expect(() => adaptWorldLane(dto)).not.toThrow();
    }
    for (const s of world.sectors) {
      for (const f of s.forces) {
        expect(() => adaptWorldForce(f)).not.toThrow();
      }
      for (const slot of s.slots) {
        expect(() => adaptWorldSlot(slot)).not.toThrow();
      }
    }
    for (const e of world.entities) {
      expect(() => adaptWorldLegion(e)).not.toThrow();
    }
  });

  it("adaptWorldSlot's constructionTurnsRemaining is known straight off the wire, never permanently Pending (world-stage W62 fix)", () => {
    for (const s of world.sectors) {
      for (const slot of s.slots) {
        const view = adaptWorldSlot(slot);
        expect(view.constructionTurnsRemaining).toEqual({
          state: "known",
          value: slot.constructionTurnsRemaining
        });
      }
    }
  });

  it("adaptWorldSector's wardenBindingId, neglectedTurns and loam.capacity are known straight off the wire (world-stage W63 fix)", () => {
    for (const dto of world.sectors) {
      const view = adaptWorldSector(dto);
      expect(view.wardenBindingId).toEqual({ state: "known", value: dto.wardenBindingId });
      expect(view.neglectedTurns).toEqual({ state: "known", value: { unit: "count", value: dto.neglectedTurns } });
      expect(view.loam.capacity).toEqual({ state: "known", value: { unit: "loamUnits", value: dto.loamCapacity } });
    }
  });

  it("adaptWorldSector's pressure is a real reading off pressureMilli, never the hard-coded Pending line GroundBlock used to show (world-stage W63 fix)", () => {
    for (const dto of world.sectors) {
      const view = adaptWorldSector(dto);
      expect(view.pressure).toEqual({ unit: "perMilleRatio", op: "flat", value: dto.pressureMilli });
    }
  });
});

describe("branch on intel, never on emptiness (spec's own unknown-sector case)", () => {
  // black-gate: genuinely never seen — WorldEndpoints.cs:271-277's minimal five-field payload.
  // ember-hollow: seen and Watched, but unowned — its economic fields are honestly zero for a
  // different reason entirely (owner-gating), and its identity (typeId, slots) is real.
  // A consumer that inferred "unknown" from a zero economic reading would treat these two sectors
  // as the same kind of empty. They are not, and only `intel` tells them apart.

  it("black-gate (Unknown) carries the record-default empty identity", () => {
    const dto = sector("black-gate");
    expect(dto.intel).toBe("Unknown");
    const view = adaptWorldSector(dto);
    expect(view.intel).toBe("Unknown");
    expect(view.typeId).toBe("");
    expect(view.loam.net.value).toBe(0);
  });

  it("ember-hollow (Watched, unowned) carries a REAL identity despite a zero economic reading", () => {
    const dto = sector("ember-hollow");
    expect(dto.intel).toBe("Watched");
    const view = adaptWorldSector(dto);
    expect(view.intel).toBe("Watched");
    // The tell: typeId and slot content are real here, unlike black-gate above — even though the
    // loam reading is also 0. A caller reading only `loam.net.value === 0` cannot tell these two
    // sectors apart; only `intel` can.
    expect(view.typeId).toBe("stable");
    expect(view.loam.net.value).toBe(0);
    const slotTypeIds = dto.slots.map((s) => s.slotTypeId);
    expect(slotTypeIds).toContain("lair");
  });

  it("the adapter never special-cases a zero loam reading — it passes straight through both ways", () => {
    const zeroButUnowned = adaptWorldSector(sector("ember-hollow"));
    const zeroAndHeld = adaptWorldSector(sector("homeworld"));
    expect(zeroButUnowned.loam.net.value).toBe(0);
    // homeworld is the player's own held sector — its own net figure is real and non-zero, proving
    // the adapter isn't just always emitting 0 regardless of input.
    expect(zeroAndHeld.loam.net.value).not.toBe(0);
  });
});

describe("adaptWorldSector — the lifelines opt-in flag", () => {
  it("lifelineCost/lifeline are pending when lifelines were not requested, even though the wire sends 0/false", () => {
    const view = adaptWorldSector(sector("homeworld"));
    expect(view.lifelineCost.state).toBe("pending");
    expect(view.lifeline.state).toBe("pending");
  });

  it("lifelineCost/lifeline become known — the same wire value — when the caller says they asked", () => {
    const dto = sector("homeworld");
    const view = adaptWorldSector(dto, { lifelinesRequested: true });
    expect(view.lifelineCost).toEqual({ state: "known", value: { unit: "count", value: dto.lifelineCost } });
    expect(view.lifeline).toEqual({ state: "known", value: dto.lifeline });
  });
});

describe("adaptWorldSector — the fracture reading passes through, no adapter arithmetic", () => {
  it("the wire value adapts straight through with op: absolute — no delta-from-1000 subtraction", () => {
    // Every sector in this fixture happens to sit at the 1000 baseline — a real, checked fact,
    // not an assumption: confirms formatMagnitude's own "absolute" arm renders ×1.00 (neutral)
    // from the raw 1000, rather than the adapter subtracting 1000 first.
    for (const dto of world.sectors) {
      expect(dto.fractureIntensityMilli).toBe(1000);
      const view = adaptWorldSector(dto);
      expect(view.fractureIntensity).toEqual({ unit: "perMilleRatio", op: "absolute", value: 1000 });
    }
  });
});

describe("adaptWorldSlot/Sector — the wonder-wire mirror (plan Task 4A.4)", () => {
  it("adaptWorldSlot carries wonderScope/wonderRarity straight off the wire, never Pending", () => {
    for (const s of world.sectors) {
      for (const slot of s.slots) {
        const view = adaptWorldSlot(slot);
        expect(view.wonderScope).toBe(slot.wonderScope);
        expect(view.wonderRarity).toBe(slot.wonderRarity);
      }
    }
  });

  it("adaptWorldSector carries the fifth upkeep operand as loamUnits, straight off the wire", () => {
    for (const dto of world.sectors) {
      const view = adaptWorldSector(dto);
      expect(view.loam.upkeepBreakdown.wonderUpkeep).toEqual({
        unit: "loamUnits",
        value: dto.upkeepBreakdown.wonderUpkeep
      });
    }
  });

  it("adaptWorldSector carries the live-count and attribution reads with honest units", () => {
    for (const dto of world.sectors) {
      const view = adaptWorldSector(dto);
      expect(view.wonderLiveCountSector).toEqual({ unit: "count", value: dto.wonderLiveCountSector });
      expect(view.wonderLiveCountEmpire).toEqual({ unit: "count", value: dto.wonderLiveCountEmpire });
      expect(view.wonderProductionContribution).toEqual({
        unit: "loamUnits",
        value: dto.wonderProductionContribution
      });
    }
  });
});

describe("adaptWorldLegion — position is exactly one of sector or lane", () => {
  it("the player's own legion, standing in a sector, adapts to a sector position", () => {
    const dto = world.entities[0]!;
    expect(dto.atSectorId).not.toBeNull();
    const view = adaptWorldLegion(dto);
    expect(view.position).toEqual({ kind: "sector", sectorId: dto.atSectorId });
  });
});

describe("adaptWorldForce — a band can never carry an exact figure", () => {
  it("adapts a banded force with no strength field reachable", () => {
    const bandedDto = world.sectors.flatMap((s) => s.forces).find((f) => !f.exact);
    if (!bandedDto) throw new Error("fixture has no banded force to test against");
    const view = adaptWorldForce(bandedDto);
    expect(view.exact).toBe(false);
    if (!view.exact) {
      expect(view.bandName).toBe(bandedDto.bandName);
    }
  });
});
