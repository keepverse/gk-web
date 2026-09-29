import { describe, expect, it } from "vitest";
import { GRID_X, GRID_Y, sectorCenter, sectorTopLeft } from "./layout";

describe("world layout", () => {
  it("exposes GRID constants matching the SVG composer", () => {
    expect(GRID_X).toBe(220);
    expect(GRID_Y).toBe(190);
  });

  it("sectorCenter is half a cell from top-left", () => {
    expect(sectorTopLeft(2, 3)).toEqual({ x: 440, y: 570 });
    expect(sectorCenter(2, 3)).toEqual({ x: 440 + 110, y: 570 + 95 });
  });
});
