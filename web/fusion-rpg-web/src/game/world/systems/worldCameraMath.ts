/**
 * Pure camera helpers — no Phaser import (followup F2 / F5).
 */
import type { WorldIgnoreRect } from "../../EventBus";
import { gameToCssPoint } from "./worldPickCoords";

function inIgnoreRect(x: number, y: number, rects: WorldIgnoreRect[]): boolean {
  for (const r of rects) {
    if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) return true;
  }
  return false;
}

/**
 * ignoreRects are canvas CSS px; pointer is game/scale space (followup F2).
 */
export function edgeScrollBlockedByIgnore(
  gameX: number,
  gameY: number,
  gameW: number,
  gameH: number,
  cssW: number,
  cssH: number,
  ignoreRects: WorldIgnoreRect[]
): boolean {
  const css = gameToCssPoint(gameX, gameY, gameW, gameH, cssW, cssH);
  return inIgnoreRect(css.x, css.y, ignoreRects);
}

/** Pure Fit extent helper for unit tests (followup F5). */
export function fitExtentFromPoints(
  points: Array<{ x: number; y: number }>,
  padWorld = 80
): { extentW: number; extentH: number; midX: number; midY: number } {
  if (points.length === 0) {
    return { extentW: 220 * 4, extentH: 190 * 3, midX: 440, midY: 285 };
  }
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = points[0]!.x;
  let maxY = points[0]!.y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    extentW: Math.max(220, maxX - minX + padWorld * 2),
    extentH: Math.max(190, maxY - minY + padWorld * 2),
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2
  };
}
