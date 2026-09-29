/**
 * base-defense `board-render` (module 16): the generic board's fixed render order — "so a structure
 * never hides a unit" (spec-board-render.md §3): terrain → structures → units → overlays. A siege
 * board and the lawn both place their own objects into these four layers by name; neither imports the
 * other's constants, and no lawn-specific value lives in this file.
 *
 * Kept duck-typed (no `phaser` import, matching `camera/bindCamera.ts`'s own precedent) — `LayerLike`
 * and `LayerFactory` describe exactly the two Phaser members this module touches
 * (`Container.setDepth`/`.add` and `GameObjectFactory.container`), so a real `scene.add` satisfies
 * `LayerFactory` with no adapter, and a plain fake satisfies it in tests with no Phaser at all.
 */

export const BOARD_LAYER_ORDER = ["terrain", "structures", "units", "overlays"] as const;

export type BoardLayerName = (typeof BOARD_LAYER_ORDER)[number];

export type LayerLike = {
  setDepth(depth: number): unknown;
  add(child: unknown): unknown;
};

export type LayerFactory = {
  container(): LayerLike;
};

export type BoardLayers = Readonly<Record<BoardLayerName, LayerLike>>;

/** Each layer's own depth, spaced apart to leave room for per-object ordering within a layer. */
export function boardLayerDepth(layer: BoardLayerName): number {
  return BOARD_LAYER_ORDER.indexOf(layer) * 1000;
}

/** Creates the four layers, in order, each already depth-stamped so they draw in the fixed order. */
export function createBoardLayers(add: LayerFactory): BoardLayers {
  const layers = {} as Record<BoardLayerName, LayerLike>;
  for (const name of BOARD_LAYER_ORDER) {
    const layer = add.container();
    layer.setDepth(boardLayerDepth(name));
    layers[name] = layer;
  }
  return layers;
}
