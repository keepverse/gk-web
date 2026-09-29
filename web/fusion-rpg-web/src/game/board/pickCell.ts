import { type GridPos, type GridSpec, contains } from "./GridSpec";

/**
 * base-defense `board-render` (module 16): the pixel geometry a board renders its cells at —
 * generalizing `gridMath.ts`'s own hardcoded `CELL_W`/`CELL_H`/`ORIGIN_X`/`ORIGIN_Y` module
 * constants into caller-supplied data, so a siege board (its own cell size) and the lawn (its own)
 * can share one picking function instead of two. No lawn-specific value lives in this file.
 */
export type CellGeometry = {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly originX: number;
  readonly originY: number;
};

/**
 * Pure: which cell (if any) a world-space point falls in. Generalizes `gridMath.worldToCell`'s own
 * body exactly (the same floor-division formula) — only the geometry and the bounds check move from
 * hardcoded constants and raw `rows`/`cols` to explicit parameters (`geometry`, `spec`).
 */
export function pickCell(spec: GridSpec, geometry: CellGeometry, worldX: number, worldY: number): GridPos | null {
  const col = Math.floor((worldX - geometry.originX) / geometry.cellWidth);
  const row = Math.floor((worldY - geometry.originY) / geometry.cellHeight);
  const pos: GridPos = { row, col };
  return contains(spec, pos) ? pos : null;
}
