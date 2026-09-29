import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD_PX, PIN_DISC_PX } from "../objects/pinConstants";
import {
  forceHitRadiusWorld,
  hitRadiusWorld,
  nearestSectorId,
  resolvePickResult
} from "./worldPickHit";

describe("world pick hit radius (gaps D6)", () => {
  it("uses PIN_DISC_PX CSS half-disc divided by camera zoom", () => {
    expect(hitRadiusWorld(1)).toBe(PIN_DISC_PX / 2);
    expect(hitRadiusWorld(2)).toBe(PIN_DISC_PX / 4);
    expect(hitRadiusWorld(0.5)).toBe(PIN_DISC_PX);
  });

  it("selects the nearest pin within the zoom-scaled hit disk", () => {
    const pins = [
      { id: "homeworld", x: 110, y: 95 },
      { id: "ash-waste", x: 990, y: 95 }
    ];
    const r1 = hitRadiusWorld(1);
    expect(nearestSectorId(pins, 112, 97, r1)).toBe("homeworld");
    expect(nearestSectorId(pins, 990, 95, r1)).toBe("ash-waste");
    expect(nearestSectorId(pins, 500, 500, r1)).toBeNull();
    // At zoom 2 the world-space disk shrinks — a point 30wu away misses.
    expect(nearestSectorId(pins, 110 + 30, 95, hitRadiusWorld(2))).toBeNull();
  });
});

describe("resolvePickResult (followup F1)", () => {
  it("picks the nearer of force vs sector when both disks hit", () => {
    const sectors = [{ id: "homeworld", x: 100, y: 100 }];
    const forces = [{ id: "e-dave-legion-1", x: 100, y: 80 }];
    expect(resolvePickResult(forces, sectors, 100, 80, 1)).toEqual({
      kind: "force",
      id: "e-dave-legion-1"
    });
    expect(resolvePickResult(forces, sectors, 100, 100, 1)).toEqual({
      kind: "sector",
      id: "homeworld"
    });
  });

  it("keeps pin-centre sector picks after Fit zooms out (force disk grows)", () => {
    const sectors = [{ id: "d-flank-2", x: 100, y: 100 }];
    const forces = [
      { id: "e-a", x: 84, y: 80 },
      { id: "e-b", x: 100, y: 80 },
      { id: "e-c", x: 116, y: 80 }
    ];
    expect(resolvePickResult(forces, sectors, 100, 100, 0.4)).toEqual({
      kind: "sector",
      id: "d-flank-2"
    });
  });

  it("returns empty when nothing is in range", () => {
    expect(resolvePickResult([], [{ id: "a", x: 0, y: 0 }], 500, 500, 1)).toEqual({ kind: "empty" });
  });

  it("scales force hit radius with zoom", () => {
    expect(forceHitRadiusWorld(1)).toBe(10);
    expect(forceHitRadiusWorld(2)).toBe(5);
  });
});


describe("world pick ignore / drag rules (gaps D4/D5)", () => {
  it("treats a drag past threshold as suppress-pick", () => {
    const shouldSuppress = (dx: number, dy: number) => Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
    expect(shouldSuppress(2, 2)).toBe(false);
    expect(shouldSuppress(DRAG_THRESHOLD_PX, 0)).toBe(true);
  });
});
