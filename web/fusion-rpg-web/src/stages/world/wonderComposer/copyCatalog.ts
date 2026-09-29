import type { WonderComposerCopyKey } from "@/features/gui-lego/foldWonderComposerVm";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §Design 6) — provisional display-copy catalog.
 *
 * Player sentences are authored copy (GG-62) against the fold's closed key
 * list — the fold maps reason strings to keys, never invents a new one.
 * Every sentence below is a fiction label until the owner amends it
 * (idea-ui-phase §1): stub copy never ships as product. No engine words
 * (`RelicCost`, `WonderScope`, `ExistenceCapFor`, dotted ids, raw reason
 * strings) appear in any of them. No balance numbers live here — counts
 * interpolate the fold's live readings, never literals.
 *
 * Pack contract (owned by 4D.4): paint lives in `wonder-scope-*` /
 * `wonder-rarity-*` packs; this catalog owns words only.
 */

export const WONDER_COMPOSER_COPY: Record<WonderComposerCopyKey, string> = {
  "wonder.effect.sector": "DRAFT: this ground earns faster each night",
  "wonder.effect.empire": "DRAFT: every holding earns faster each night",
  "wonder.cap-line": "DRAFT: of cap raised",
  "wonder.uncapped": "DRAFT: raisable on any open ground — no cap",
  "wonder.locked.world": "DRAFT: not yet sung into the world — World-scope works are not raisable",
  "wonder.locked.multiverse": "DRAFT: not yet sung into the world — Multiverse-scope works are not raisable",
  "wonder.locked.defense": "DRAFT: not yet sung into the world — war-works are not raisable",
  "wonder.locked.aura": "DRAFT: not yet sung into the world — aura-works are not raisable",
  "wonder.locked.empire-buff": "DRAFT: not yet sung into the world — edict-works are not raisable",
  "wonder.placeholder.unknown": "DRAFT: a work not yet named in the chronicle",
  "wonder.refused.cap-reached": "DRAFT: This land already holds all it can.",
  "wonder.refused.count-mismatch": "DRAFT: The foundation asks for an exact laying.",
  "wonder.refused.not-reachable": "DRAFT: That treasure isn't here.",
  "wonder.refused.cannot-afford": "DRAFT: The stores are short.",
  "wonder.next.other-row": "DRAFT next: raise the other work instead, or hold this ground as it stands.",
  "wonder.next.relay": "DRAFT next: return to the shelf with the shortfall marked.",
  "wonder.next.fetch": "DRAFT next: bring it within reach first (band packs or this ground's vault).",
  "wonder.next.gather": "DRAFT next: gather stores, or choose a lesser work.",
  "wonder.confirm.spend": "DRAFT: Spend the laid treasure and raise the work? Nothing is taken until End Turn commits.",
  "wonder.filed.pending": "DRAFT: Order filed — resolves at End Turn.",
  "wonder.empty.shelf": "DRAFT empty: No treasure within reach — march a laden band here or vault pieces in this ground's store.",
  "wonder.error.read": "DRAFT error: The ground could not be read.",
  "wonder.loading": "DRAFT: Reading the ground…"
};

export function wonderComposerCopy(key: WonderComposerCopyKey): string {
  return WONDER_COMPOSER_COPY[key];
}

/** Live cap line — the fold's numbers, the catalog's words (owner-locked shown). */
export function wonderCapLine(live: number, cap: number): string {
  return `DRAFT: ${live} of cap raised (cap ${cap}).`;
}

/** Count line — covers wrong count incl. null-vs-needed; blank ids are mismatch, never cleaned. */
export function wonderCountLine(needed: number, picked: number): string {
  return `DRAFT: The foundation asks for exactly ${needed} pieces of treasure — ${picked} are laid.`;
}

/** Foundation line for the shelf + cost-plate (`k of N`). */
export function wonderFoundationLine(picked: number, needed: number): string {
  return `DRAFT: Laid into the foundation: ${picked} of ${needed} pieces of treasure.`;
}

/** Nights line — construction takes nights on the virtual-turn clock. */
export function wonderNightsLine(nights: number): string {
  return `DRAFT: Rises over ${nights} night${nights === 1 ? "" : "s"}.`;
}
