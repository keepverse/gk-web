/**
 * The ten-rung ladder's ORDINAL, weakest first (species-gear-chain T17,
 * spec-ladder-consistency-repair.md). The sort key for every roster surface — comparators sort
 * strongest-first (descending), preserving the roster's documented "rarity desc" design; the defect
 * was the vocabulary, never the direction.
 *
 * The previous comparator keyed on the retired four-value vocabulary
 * (common/rare/epic/legendary); because no species carries those ids, it matched nothing and the
 * sort was silently inert — no throw, no warning, just no sorting. The ladder below is the current
 * vocabulary, weakest first, so a LOWER ordinal always sorts first.
 *
 * Unknown ids surface, never default and never throw: `rarityOrdinal` returns null, the comparator
 * parks unknowns after the ladder (placement, explicitly not a rank), and the badge renders a
 * visible "unknown rarity" marker (OQ2). Throwing in a comparator can blank a whole roster view; a
 * visible marker fails loudly without taking the page down.
 */
export const RARITY_IDS = [
  "chaff",
  "sprout",
  "grafted",
  "cultivated",
  "fused",
  "chimeric",
  "heirloom",
  "firstseed",
  "sunwoven",
  "almanac"
] as const;

export type KnownRarityId = (typeof RARITY_IDS)[number];

/** Placement for an unknown id: after the ladder, explicitly not a rung. */
export const UNKNOWN_RARITY_SLOT = RARITY_IDS.length;

/** The ordinal, or null when the id is not on the ladder. Never a default. */
export function rarityOrdinal(rarity: string): number | null {
  const index = (RARITY_IDS as readonly string[]).indexOf(rarity);
  return index < 0 ? null : index;
}

/** Comparator slot: the ordinal, or the after-ladder slot for unknowns. */
export function raritySortSlot(rarity: string): number {
  return rarityOrdinal(rarity) ?? UNKNOWN_RARITY_SLOT;
}

/**
 * Strongest-first comparator that parks unknowns LAST in either direction — the invariant no call
 * site may reimplement. (Descending ordinals alone would surface unknowns first, since their slot
 * is the largest number; this pins them last explicitly.)
 */
export function compareRarityDesc(aRarity: string, bRarity: string): number {
  const a = rarityOrdinal(aRarity);
  const b = rarityOrdinal(bRarity);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/** Badge text: the capitalized id, or the id with a visible unknown marker. */
export function rarityBadge(rarity: string): string {
  const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
  return rarityOrdinal(rarity) === null ? `${label} (unknown rarity)` : label;
}

/** Tint token index 1–5 for the existing `--color-rarity-*` tokens: two rungs per token, rising. */
export function rarityTintToken(rarity: string): string {
  const ordinal = rarityOrdinal(rarity);
  if (ordinal === null) return "border-border";
  return `border-rarity-${Math.min(5, Math.floor(ordinal / 2) + 1)}`;
}
