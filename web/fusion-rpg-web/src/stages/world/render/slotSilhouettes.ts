/**
 * Five silhouettes group the fourteen slot kinds (world-stage W44, spec-world-render.md §Design 1)
 * — replacing `SectorNode.tsx:29-39`'s nine-of-fourteen letter glyphs, which are not shapes at all.
 * The spec names the five silhouettes but leaves the per-kind grouping to this module; the split
 * below follows each kind's own role rather than its raw `Buildable`/`Yields` flags alone:
 *
 * - **square** — `seat`, the one slot that may host a stronghold. Singular role, its own shape.
 * - **circle** — `wildland`/`hazard`, raw or unusable ground — nothing built, nothing yielded.
 * - **hexagon** — every slot that yields something over time: the five resource deposits plus
 *   `rootbed` (the loam source itself).
 * - **diamond** — `vault`/`shrine`/`market`, non-yield economic/narrative slots.
 * - **octagon** — `spire`/`anomaly`, the remaining special-effect slots.
 *
 * A glyph names the *specific* kind within its silhouette — the silhouette alone only narrows it to
 * a family of two to six kinds.
 */
export type SlotSilhouette = "square" | "circle" | "hexagon" | "diamond" | "octagon";

const SILHOUETTE_BY_KIND: Record<string, SlotSilhouette> = {
  seat: "square",
  wildland: "circle",
  hazard: "circle",
  "essence-deposit": "hexagon",
  "shard-vein": "hexagon",
  "material-seam": "hexagon",
  lair: "hexagon",
  tear: "hexagon",
  rootbed: "hexagon",
  vault: "diamond",
  shrine: "diamond",
  market: "diamond",
  spire: "octagon",
  anomaly: "octagon"
};

/** One glyph per kind, always legible at the type floor (never a raw letter standing in for a shape). */
const GLYPH_BY_KIND: Record<string, string> = {
  seat: "⌂",
  wildland: "·",
  hazard: "!",
  "essence-deposit": "◈",
  "shard-vein": "◆",
  "material-seam": "▨",
  lair: "☾",
  tear: "✦",
  rootbed: "❖",
  vault: "▣",
  shrine: "⛩",
  market: "$",
  spire: "▲",
  anomaly: "?"
};

export const ALL_SLOT_KINDS: readonly string[] = Object.keys(SILHOUETTE_BY_KIND);

export function silhouetteFor(slotTypeId: string): SlotSilhouette {
  const silhouette = SILHOUETTE_BY_KIND[slotTypeId];
  if (!silhouette) throw new Error(`slotSilhouettes: unmapped slot type id ${JSON.stringify(slotTypeId)}`);
  return silhouette;
}

export function glyphFor(slotTypeId: string): string {
  const glyph = GLYPH_BY_KIND[slotTypeId];
  if (!glyph) throw new Error(`slotSilhouettes: unmapped slot type id ${JSON.stringify(slotTypeId)}`);
  return glyph;
}

/**
 * The three markers that stack over a slot's own silhouette (spec's own list): guarded (a fight
 * stands here), built (a finished structure), building (still under construction, with the turns
 * left). At most one applies — a slot cannot be simultaneously guarded and built.
 */
export type SlotMarker =
  | { kind: "guarded" }
  | { kind: "built" }
  | { kind: "building"; turnsRemaining: number }
  | null;

export function markerGlyph(marker: SlotMarker): string | null {
  if (marker === null) return null;
  switch (marker.kind) {
    case "guarded":
      return "⚔";
    case "built":
      return "▲";
    case "building":
      return `⏳${marker.turnsRemaining}`;
    default: {
      const exhaustive: never = marker;
      throw new Error(`slotSilhouettes: unhandled marker ${JSON.stringify(exhaustive)}`);
    }
  }
}
