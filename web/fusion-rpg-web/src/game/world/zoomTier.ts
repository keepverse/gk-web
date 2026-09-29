/**
 * Map-plane LOD. Structural thresholds — control/a11y, not balance tunables.
 * Exact numbers are placeholders until Scene feels them against plate §O.4; names + class locked.
 */

export type ZoomTier = "fit" | "map" | "detail";

/** Structural: below this camera scale → fit. Control, not feel. */
export const FIT_MAX = 0.55;
/** Structural: at/above this camera scale → detail. Control, not feel. */
export const DETAIL_MIN = 1.25;

export function zoomTier(scale: number): ZoomTier {
  if (scale < FIT_MAX) return "fit";
  if (scale < DETAIL_MIN) return "map";
  return "detail";
}

/**
 * Strict supersets: every channel visible at fit is visible at map and detail.
 * Used by descriptor tests — not a runtime paint list.
 */
export function lodChannels(tier: ZoomTier): ReadonlySet<string> {
  const fit = new Set(["ownership", "health", "unknownShape"]);
  if (tier === "fit") return fit;
  const map = new Set(fit);
  map.add("slotDots");
  map.add("fogPip");
  if (tier === "map") return map;
  const detail = new Set(map);
  detail.add("slotShapes");
  detail.add("netLoam");
  detail.add("fogWash");
  detail.add("name");
  return detail;
}
