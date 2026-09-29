/**
 * Pure pick geometry — shared by worldPickSystem and unit tests (gaps D6 / followup F1).
 */
import { PIN_DISC_PX } from "../objects/pinConstants";

/** Force marker hit zone is 20×20 CSS px — half-diagonal ≈ 10 at zoom 1. */
const FORCE_HIT_CSS_PX = 10;

/** World-unit radius of the a11y pin disc at the given camera zoom. */
export function hitRadiusWorld(zoom: number): number {
  const z = zoom > 0 ? zoom : 1;
  return PIN_DISC_PX / 2 / z;
}

/** World-unit radius for force markers at the given camera zoom. */
export function forceHitRadiusWorld(zoom: number): number {
  const z = zoom > 0 ? zoom : 1;
  return FORCE_HIT_CSS_PX / z;
}

export type PickPoint = { id: string; x: number; y: number };

export type PickResult =
  | { kind: "force"; id: string }
  | { kind: "sector"; id: string }
  | { kind: "empty" };

function nearestInRadius(
  points: readonly PickPoint[],
  worldX: number,
  worldY: number,
  hitR: number
): { id: string; d2: number } | null {
  let best: { id: string; d2: number } | null = null;
  const limit = hitR * hitR;
  for (const p of points) {
    const dx = p.x - worldX;
    const dy = p.y - worldY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= limit && (best == null || d2 < best.d2)) {
      best = { id: p.id, d2 };
    }
  }
  return best;
}

export function nearestId(
  points: readonly PickPoint[],
  worldX: number,
  worldY: number,
  hitR: number
): string | null {
  return nearestInRadius(points, worldX, worldY, hitR)?.id ?? null;
}

/** @deprecated Prefer nearestId — kept for existing call sites / tests. */
export function nearestSectorId(
  pins: Array<{ id: string; x: number; y: number }>,
  worldX: number,
  worldY: number,
  hitR: number
): string | null {
  return nearestId(pins, worldX, worldY, hitR);
}

/**
 * Resolve a world pick. When force and sector both hit, the nearer wins (ties → force —
 * markers sit above pins). Absolute force-first broke Fit-zoomed pin clicks on garrisoned
 * sectors (followup F1 + W57).
 */
export function resolvePickResult(
  forces: readonly PickPoint[],
  sectors: readonly PickPoint[],
  worldX: number,
  worldY: number,
  zoom: number
): PickResult {
  const forceHit = nearestInRadius(forces, worldX, worldY, forceHitRadiusWorld(zoom));
  const sectorHit = nearestInRadius(sectors, worldX, worldY, hitRadiusWorld(zoom));
  if (forceHit && sectorHit) {
    return forceHit.d2 <= sectorHit.d2
      ? { kind: "force", id: forceHit.id }
      : { kind: "sector", id: sectorHit.id };
  }
  if (forceHit) return { kind: "force", id: forceHit.id };
  if (sectorHit) return { kind: "sector", id: sectorHit.id };
  return { kind: "empty" };
}
