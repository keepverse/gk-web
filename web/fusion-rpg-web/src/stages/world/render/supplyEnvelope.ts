/**
 * The supply envelope's own geometry (world-stage W48). A connected territory component is drawn
 * as one filled shape when a convex hull genuinely represents it — but a hull always **contains**
 * every point handed to it, so a snake-shaped (non-convex) territory would have its hull silently
 * swallow foreign ground sitting in the middle. **An envelope that cannot enclose a non-convex
 * territory falls back to per-lane drawing** — this module is the check that decides which.
 */
export type Point = { x: number; y: number };

/** Andrew's monotone chain — O(n log n), no external dependency. Collinear points are dropped. */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (sorted.length <= 2) return sorted;

  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Standard ray-casting point-in-polygon test. Points exactly on the boundary count as inside. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export type SupplyEnvelope = { kind: "hull"; points: Point[] } | { kind: "per-lane" };

/**
 * `componentPositions` — this territory component's own sector positions. `foreignPositions` —
 * every other sector on the map, owned or not: if the hull would enclose any of them, the shape is
 * non-convex from the player's own ground's perspective and a filled envelope would misrepresent
 * territory nobody holds as "inside" — so the caller falls back to drawing the component's own
 * lanes instead.
 */
export function supplyEnvelopeFor(
  componentPositions: readonly Point[],
  foreignPositions: readonly Point[]
): SupplyEnvelope {
  if (componentPositions.length < 3) return { kind: "per-lane" };

  const hull = convexHull(componentPositions);
  const enclosesForeignGround = foreignPositions.some((p) => pointInPolygon(p, hull));

  return enclosesForeignGround ? { kind: "per-lane" } : { kind: "hull", points: hull };
}
