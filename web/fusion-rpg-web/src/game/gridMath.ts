/** Pure lawn grid math — no Phaser (unit-testable). */

import { makeGridSpec } from "./board/GridSpec";
import { pickCell } from "./board/pickCell";
import { computeCameraFit } from "./camera/bindCamera";

export const CELL_W = 64;
export const CELL_H = 72;
export const ORIGIN_X = 48;
export const ORIGIN_Y = 56;
/** Extra world-space padding the camera fit adds around the grid on every side. */
export const LAWN_CAMERA_MARGIN = 24;
/** The lawn's own zoom floor — the camera never zooms out past this, however small the grid. */
export const LAWN_MIN_CAMERA_ZOOM = 0.2;

export function cellToWorld(
  row: number,
  col: number
): { x: number; y: number } {
  return {
    x: ORIGIN_X + col * CELL_W + CELL_W / 2,
    y: ORIGIN_Y + row * CELL_H + CELL_H / 2
  };
}

/** The lawn's own cell picking, now delegating to the generic `pickCell` with the lawn's constants. */
export function worldToCell(
  x: number,
  y: number,
  rows: number,
  cols: number
): { row: number; col: number } | null {
  return pickCell(
    makeGridSpec(rows, cols),
    { cellWidth: CELL_W, cellHeight: CELL_H, originX: ORIGIN_X, originY: ORIGIN_Y },
    x,
    y
  );
}

/** Zoom so the model grid fills the canvas (contain). */
export function lawnWorldSize(
  rows: number,
  cols: number
): { width: number; height: number } {
  return {
    width: ORIGIN_X + cols * CELL_W + LAWN_CAMERA_MARGIN,
    height: ORIGIN_Y + rows * CELL_H + LAWN_CAMERA_MARGIN
  };
}

/** Now delegating to the generic `computeCameraFit` with the lawn's own geometry and margin. */
export function lawnCameraZoom(
  viewW: number,
  viewH: number,
  rows: number,
  cols: number
): number {
  return computeCameraFit(
    { rows, cols },
    { cellWidth: CELL_W, cellHeight: CELL_H, originX: ORIGIN_X, originY: ORIGIN_Y },
    { width: viewW, height: viewH },
    LAWN_CAMERA_MARGIN
  ).zoom;
}
