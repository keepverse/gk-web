import { formatMagnitude } from "@/i18n/magnitude";

/**
 * Patron display math (spec-patron-creature.md) — mirrors PatronPolicy server-side; vitest-pinned
 * like STAR_CAPS so drift shows up in CI, and the server stays authoritative for real values.
 */

export const PATRON_RARITY_BASE_MILLI: Record<string, number> = {
  common: 20,
  rare: 30,
  epic: 45,
  legendary: 60
};

export const PATRON_CLAMP_MILLI = 150;
export const PATRON_PER_STAR_MILLI = 10;

export function auraPreviewMilli(rarity: string, star: number, level: number): number {
  const base = PATRON_RARITY_BASE_MILLI[rarity] ?? 0;
  return Math.min(PATRON_CLAMP_MILLI, Math.max(0, base + PATRON_PER_STAR_MILLI * star + level));
}

/**
 * "+7.5% fire power · +3.7% defense" style label from per-mille values.
 *
 * The conversion is the shared one — a per-mille magnitude formatted by `formatMagnitude`, which
 * routes it through the same one-decimal, trailing-zero-trimmed arm the item card and every other
 * per-mille reading in this tree use. This file used to own a private copy of that arithmetic;
 * there is now exactly one per-mille formatter in the web tree, and this is a call site of it.
 *
 * The signs stay in the sentence rather than in the number (`op: "flat"`, not `"increased"`),
 * because the label reads as two additive clauses and would otherwise print the plus twice.
 */
export function auraLabel(elementPrimary: string, powerMilli: number, defenseMilli: number): string {
  const pct = (milli: number) => formatMagnitude({ unit: "perMilleRatio", value: milli, op: "flat" });
  return `+${pct(powerMilli)} ${elementPrimary} power · +${pct(defenseMilli)} defense`;
}
