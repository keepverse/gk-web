import { describe, expect, it, vi } from "vitest";
import { makeGridSpec } from "./GridSpec";
import type { CellGeometry } from "./pickCell";
import { createRenderTextureTerrainSink, createTerrainCache, type TerrainSink } from "./terrainCache";

const GEOMETRY: CellGeometry = { cellWidth: 10, cellHeight: 20, originX: 100, originY: 200 };

function fakeSink(): TerrainSink & { clear: ReturnType<typeof vi.fn>; paintCell: ReturnType<typeof vi.fn> } {
  return { clear: vi.fn(), paintCell: vi.fn() };
}

describe("createTerrainCache — painted once per distinct GridSpec, never per frame", () => {
  it("the first ensure() clears once and paints every cell with its own rect and terrain", () => {
    const spec = makeGridSpec(2, 3, ["open", "rough", "blocking", "gap", "open", "rough"]);
    const sink = fakeSink();
    const cache = createTerrainCache(sink, GEOMETRY);

    cache.ensure(spec);

    expect(sink.clear).toHaveBeenCalledTimes(1);
    expect(sink.paintCell).toHaveBeenCalledTimes(6);
    expect(sink.paintCell).toHaveBeenNthCalledWith(1, { row: 0, col: 0 }, "open", { x: 100, y: 200, width: 10, height: 20 });
    expect(sink.paintCell).toHaveBeenNthCalledWith(2, { row: 0, col: 1 }, "rough", { x: 110, y: 200, width: 10, height: 20 });
    expect(sink.paintCell).toHaveBeenNthCalledWith(4, { row: 1, col: 0 }, "gap", { x: 100, y: 220, width: 10, height: 20 });
  });

  it("calling ensure() again with the SAME spec reference is a no-op — proves 'not redrawn per frame'", () => {
    const spec = makeGridSpec(5, 9);
    const sink = fakeSink();
    const cache = createTerrainCache(sink, GEOMETRY);

    cache.ensure(spec);
    sink.clear.mockClear();
    sink.paintCell.mockClear();

    cache.ensure(spec);
    cache.ensure(spec);
    cache.ensure(spec);

    expect(sink.clear).not.toHaveBeenCalled();
    expect(sink.paintCell).not.toHaveBeenCalled();
  });

  it("a different GridSpec reference invalidates the cache and repaints, even with identical content", () => {
    const specA = makeGridSpec(5, 9);
    const specB = makeGridSpec(5, 9); // structurally identical, but a distinct object
    const sink = fakeSink();
    const cache = createTerrainCache(sink, GEOMETRY);

    cache.ensure(specA);
    sink.clear.mockClear();
    sink.paintCell.mockClear();

    cache.ensure(specB);

    expect(sink.clear).toHaveBeenCalledTimes(1);
    expect(sink.paintCell).toHaveBeenCalledTimes(45);
  });

  it("switching back to a previously-painted spec repaints again — the cache holds only the last one", () => {
    const specA = makeGridSpec(3, 3);
    const specB = makeGridSpec(4, 4);
    const sink = fakeSink();
    const cache = createTerrainCache(sink, GEOMETRY);

    cache.ensure(specA);
    cache.ensure(specB);
    sink.clear.mockClear();
    sink.paintCell.mockClear();

    cache.ensure(specA);

    expect(sink.clear).toHaveBeenCalledTimes(1);
    expect(sink.paintCell).toHaveBeenCalledTimes(9);
  });
});

describe("createRenderTextureTerrainSink — a real Phaser RenderTexture satisfies this with no adapter code", () => {
  it("clear() delegates to the render texture's own clear()", () => {
    const rt = { clear: vi.fn(), fill: vi.fn() };
    const sink = createRenderTextureTerrainSink(rt, () => 0);
    sink.clear();
    expect(rt.clear).toHaveBeenCalledTimes(1);
  });

  it("paintCell() fills the rect with the caller's own per-terrain color, full alpha", () => {
    const rt = { clear: vi.fn(), fill: vi.fn() };
    const colorFor = vi.fn((t: string) => (t === "rough" ? 0xff0000 : 0x00ff00));
    const sink = createRenderTextureTerrainSink(rt, colorFor);

    sink.paintCell({ row: 1, col: 2 }, "rough", { x: 10, y: 20, width: 30, height: 40 });

    expect(colorFor).toHaveBeenCalledWith("rough");
    expect(rt.fill).toHaveBeenCalledWith(0xff0000, 1, 10, 20, 30, 40);
  });
});
