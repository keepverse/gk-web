/**
 * World map authored-grid layout (structural — not a balance tunable).
 * Ported from `WorldScene.tsx` GRID_X/Y so Phaser and (until retired) SVG agree.
 */

/** Cell width in world units. Structural layout const — promote to tuning only if a feel pass needs it. */
export const GRID_X = 220;
/** Cell height in world units. Structural layout const. */
export const GRID_Y = 190;

export type WorldPoint = { x: number; y: number };

/** Sector pin / lane endpoint at the **centre** of the layout cell (not top-left). */
export function sectorCenter(layoutX: number, layoutY: number): WorldPoint {
  return {
    x: layoutX * GRID_X + GRID_X / 2,
    y: layoutY * GRID_Y + GRID_Y / 2
  };
}

export function sectorTopLeft(layoutX: number, layoutY: number): WorldPoint {
  return { x: layoutX * GRID_X, y: layoutY * GRID_Y };
}
