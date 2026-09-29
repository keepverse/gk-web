/**
 * Canvas CSS ↔ Phaser game/scale space for pick + ignoreRects (gaps D7 / D21).
 * Pure — unit-tested so Dom and Phaser paths stay aligned.
 */

export function cssToGamePoint(
  cssX: number,
  cssY: number,
  gameW: number,
  gameH: number,
  cssW: number,
  cssH: number
): { x: number; y: number } {
  const sx = gameW / Math.max(1, cssW);
  const sy = gameH / Math.max(1, cssH);
  return { x: cssX * sx, y: cssY * sy };
}

export function gameToCssPoint(
  gameX: number,
  gameY: number,
  gameW: number,
  gameH: number,
  cssW: number,
  cssH: number
): { x: number; y: number } {
  const sx = cssW / Math.max(1, gameW);
  const sy = cssH / Math.max(1, gameH);
  return { x: gameX * sx, y: gameY * sy };
}

/**
 * World → camera viewport pixels. Matches Phaser's camera matrix (origin + zoom),
 * not the naive `(world - scroll) * zoom` which drifts whenever zoom ≠ 1.
 */
export function worldToCameraScreen(
  worldX: number,
  worldY: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
  camW: number,
  camH: number
): { x: number; y: number } {
  const ox = camW * 0.5;
  const oy = camH * 0.5;
  return {
    x: (worldX - scrollX) * zoom + ox * (1 - zoom),
    y: (worldY - scrollY) * zoom + oy * (1 - zoom)
  };
}
