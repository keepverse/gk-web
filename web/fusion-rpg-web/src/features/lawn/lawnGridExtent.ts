/** Observe-only lawn grid size. Canvas is 12×5 (plantable 0–9 + spawn 10–11). */

import { DEFAULT_COLS, DEFAULT_ROWS, type LawnSide } from "./lawnViewModel";

/** Roof/pool ceiling — never grow from a bogus Column. */
export const MAX_LAWN_ROWS = 8;
export const MAX_LAWN_COLS = 16;

function finiteInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return undefined;
}

/**
 * Plant cell = payload `col` (thePlantColumn).
 * Zombie cell = `column` (Zombie.Column) when present — Mouse.GetColumnFromX
 * saturates at the last plantable col (9), so spawn at 11/12 would stack on 9.
 */
export function readLawnCol(
  side: LawnSide | undefined,
  payload: Record<string, unknown>
): number | undefined {
  if (side === "zombie") {
    const column = finiteInt(payload.column);
    if (column != null && column >= 0) return column;
  }
  return finiteInt(payload.col);
}

export function lawnGridFromPayload(payload: Record<string, unknown>): {
  rows?: number;
  cols?: number;
} {
  const rows =
    finiteInt(payload.rows) ??
    finiteInt(payload.rowNum) ??
    finiteInt(payload.rowCount);
  const cols =
    finiteInt(payload.cols) ??
    finiteInt(payload.columnNum) ??
    finiteInt(payload.columnCount);
  return {
    rows:
      rows != null && rows > 0
        ? Math.min(MAX_LAWN_ROWS, Math.max(1, rows))
        : undefined,
    cols:
      cols != null && cols > 0
        ? Math.min(MAX_LAWN_COLS, Math.max(1, cols))
        : undefined
  };
}

/** Never smaller than the 12×5 canvas; payload/occupants may grow. */
export function floorLawnGrid(
  rows?: number,
  cols?: number
): { rows: number; cols: number } {
  return {
    rows: Math.min(
      MAX_LAWN_ROWS,
      Math.max(DEFAULT_ROWS, rows && rows > 0 ? rows : DEFAULT_ROWS)
    ),
    cols: Math.min(
      MAX_LAWN_COLS,
      Math.max(DEFAULT_COLS, cols && cols > 0 ? cols : DEFAULT_COLS)
    )
  };
}

/** Grow (never shrink) so `row`/`col` sit on the canvas. */
export function fitLawnExtent(
  rows: number,
  cols: number,
  row?: number,
  col?: number
): { rows: number; cols: number } {
  let nextRows = rows > 0 ? rows : DEFAULT_ROWS;
  let nextCols = cols > 0 ? cols : DEFAULT_COLS;
  if (row != null && row >= 0) {
    nextRows = Math.min(MAX_LAWN_ROWS, Math.max(nextRows, row + 1));
  }
  if (col != null && col >= 0) {
    nextCols = Math.min(MAX_LAWN_COLS, Math.max(nextCols, col + 1));
  }
  return { rows: nextRows, cols: nextCols };
}
