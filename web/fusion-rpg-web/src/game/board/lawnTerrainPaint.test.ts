import { describe, expect, it, vi } from "vitest";
import { CELL_H, CELL_W, ORIGIN_X, ORIGIN_Y } from "../gridMath";
import { paintLawnTerrainGraphics } from "./lawnTerrainPaint";

describe("lawnTerrainPaint (Graphics-compatible)", () => {
  function setup() {
    const added: unknown[] = [];
    const g = {
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      lineStyle: vi.fn(),
      strokeRect: vi.fn(),
      destroy: vi.fn()
    };
    const layers = {
      terrain: { add: (child: unknown) => added.push(child), setDepth: vi.fn() },
      structures: { add: vi.fn(), setDepth: vi.fn() },
      units: { add: vi.fn(), setDepth: vi.fn() },
      overlays: { add: vi.fn(), setDepth: vi.fn() }
    };
    const scene = {
      add: {
        graphics: () => g,
        container: () => ({ setDepth: vi.fn(), add: vi.fn() })
      }
    };
    return { added, g, layers, scene };
  }

  it("draws checkerboard into layers.terrain and returns Graphics", () => {
    const { added, g, layers, scene } = setup();
    const out = paintLawnTerrainGraphics(
      scene as never,
      layers as never,
      2,
      2,
      null
    );
    expect(out).toBe(g);
    expect(added).toContain(g);
    expect(g.fillRect.mock.calls.length).toBe(4);
  });

  it("uses even/odd fill colors and one stroke per cell", () => {
    const { g, layers, scene } = setup();
    paintLawnTerrainGraphics(scene as never, layers as never, 2, 2, null);

    // (0,0) even → 0x221c16; (0,1) odd → 0x2a231b
    expect(g.fillStyle.mock.calls[0]).toEqual([0x221c16, 0.9]);
    expect(g.fillStyle.mock.calls[1]).toEqual([0x2a231b, 0.9]);
    expect(g.fillStyle.mock.calls[2]).toEqual([0x2a231b, 0.9]);
    expect(g.fillStyle.mock.calls[3]).toEqual([0x221c16, 0.9]);

    expect(g.strokeRect).toHaveBeenCalledTimes(4);
    expect(g.fillRect.mock.calls[0]).toEqual([
      ORIGIN_X,
      ORIGIN_Y,
      CELL_W - 2,
      CELL_H - 2
    ]);
  });

  it("destroys previous Graphics once before painting", () => {
    const { g, layers, scene } = setup();
    const previous = { destroy: vi.fn() };
    paintLawnTerrainGraphics(
      scene as never,
      layers as never,
      1,
      1,
      previous as never
    );
    expect(previous.destroy).toHaveBeenCalledTimes(1);
    expect(g.fillRect).toHaveBeenCalledTimes(1);
  });
});
