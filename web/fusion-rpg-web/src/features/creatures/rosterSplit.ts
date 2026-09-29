import type { CreatureSpecimenDto } from "@/lib/bus/creatures";
import { compareRarityDesc } from "./rarityLadder";

export const ACTIVE_CAP = 24;

export type ReserveStack = {
  speciesId: string;
  count: number;
  specimens: CreatureSpecimenDto[];
};

/**
 * Active/Reserve split (spec-creature-summoning duplicate valve): Active holds up to 24 —
 * locked first, then rarity desc, then oldest first. Everything else stacks by species
 * in Reserve so the visible roster stays team-sized, not a warehouse.
 */
export function splitRoster(items: CreatureSpecimenDto[]): {
  active: CreatureSpecimenDto[];
  reserve: ReserveStack[];
} {
  const sorted = [...items].sort((a, b) => {
    if (a.profile.locked !== b.profile.locked) return a.profile.locked ? -1 : 1;
    // Sort by the ladder's ORDINAL, strongest first — never by a literal id list. The previous
    // comparator keyed on the retired four-value vocabulary (common/rare/epic/legendary); because
    // no species carries those ids, it matched nothing and the sort was silently inert — no throw,
    // no warning, just no sorting. Unknowns park last via compareRarityDesc (placement, not a rank);
    // the badge surfaces them.
    const order = compareRarityDesc(a.profile.rarity, b.profile.rarity);
    if (order !== 0) return order;
    return a.profile.createdUtc.localeCompare(b.profile.createdUtc);
  });

  const active = sorted.slice(0, ACTIVE_CAP);
  const rest = sorted.slice(ACTIVE_CAP);
  const stacks = new Map<string, ReserveStack>();
  for (const s of rest) {
    const stack = stacks.get(s.profile.speciesId);
    if (stack) {
      stack.count++;
      stack.specimens.push(s);
    } else {
      stacks.set(s.profile.speciesId, { speciesId: s.profile.speciesId, count: 1, specimens: [s] });
    }
  }

  return { active, reserve: [...stacks.values()].sort((a, b) => b.count - a.count) };
}

/** Pity progress line for the Summon panel — dead pulls rendered as visible progress. */
export function pityLine(sinceEpic: number, epicAt: number, sinceLegendary: number, legendaryAt: number): string {
  return `${sinceEpic}/${epicAt} to guaranteed Epic · ${sinceLegendary}/${legendaryAt} to guaranteed Legendary`;
}

export function displayName(s: CreatureSpecimenDto, speciesName?: string): string {
  return s.profile.nickname?.trim() || speciesName || s.profile.speciesId;
}
