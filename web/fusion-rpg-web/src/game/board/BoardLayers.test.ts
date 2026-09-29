import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BOARD_LAYER_ORDER, boardLayerDepth, createBoardLayers, type LayerFactory, type LayerLike } from "./BoardLayers";

function fakeFactory(): LayerFactory & { created: LayerLike[] } {
  const created: LayerLike[] = [];
  return {
    created,
    container: () => {
      const layer: LayerLike = { setDepth: vi.fn(), add: vi.fn() };
      created.push(layer);
      return layer;
    }
  };
}

describe("boardLayerDepth — a fixed order so a structure never hides a unit", () => {
  it("terrain < structures < units < overlays", () => {
    const depths = BOARD_LAYER_ORDER.map(boardLayerDepth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    expect(new Set(depths).size).toBe(depths.length);
  });

  it("matches the spec's own literal order", () => {
    expect(BOARD_LAYER_ORDER).toEqual(["terrain", "structures", "units", "overlays"]);
  });
});

describe("createBoardLayers — wires exactly four layers, each depth-stamped", () => {
  it("creates one container per layer, in order, via the injected factory", () => {
    const factory = fakeFactory();
    createBoardLayers(factory);
    expect(factory.created).toHaveLength(4);
  });

  it("each returned layer carries its own layer's depth", () => {
    const factory = fakeFactory();
    const layers = createBoardLayers(factory);
    for (const name of BOARD_LAYER_ORDER) {
      expect(layers[name].setDepth).toHaveBeenCalledTimes(1);
      expect(layers[name].setDepth).toHaveBeenCalledWith(boardLayerDepth(name));
    }
  });

  it("a caller can add its own objects into a named layer with no knowledge of the others", () => {
    const factory = fakeFactory();
    const layers = createBoardLayers(factory);
    const sprite = { fake: "unit" };
    layers.units.add(sprite);
    expect(layers.units.add).toHaveBeenCalledWith(sprite);
    expect(layers.terrain.add).not.toHaveBeenCalled();
  });
});

describe("BoardLayers.ts imports nothing lawn-specific", () => {
  it("has zero import statements — scanning only actual `import` lines, not this file's own prose", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "BoardLayers.ts");
    const src = readFileSync(path, "utf8");
    const importLines = src.match(/^import .+$/gm) ?? [];
    expect(importLines).toEqual([]);
  });
});
