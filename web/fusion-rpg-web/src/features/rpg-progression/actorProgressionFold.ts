import type { RpgXpLedgerEntry } from "../../lib/bus/types";

/**
 * The progression kinds an ACTOR surface means. `empire` joined the server's closed actor-kind
 * vocabulary in `empire-progression` EP4.1 (ruling R19: an empire's level is a `kind = 'empire'` row
 * of the same table), so a list or ledger read that omits `kind` now returns a row that is not an
 * actor at all. Every unfiltered reader on this page folds through here rather than assuming the
 * table still holds only actors.
 *
 * The three are the ones this control room renders as actors: the player line, and the two PvZ type
 * lines. `species` and `specimen` are deliberately absent too — they have their own surfaces and never
 * appeared in this ledger before the empire row made the omission visible.
 */
export const ACTOR_PROGRESSION_KINDS = ["player", "plant", "zombie"] as const;

export function isActorProgressionKind(kind: string): boolean {
  return (ACTOR_PROGRESSION_KINDS as readonly string[]).includes(kind);
}

/** Keeps only the rows an actor surface may show. Never reorders, never mutates. */
export function foldActorRows<T extends { kind: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => isActorProgressionKind(r.kind));
}

/** The same fold for the XP ledger, whose rows carry the same `kind`. */
export function foldActorLedger(rows: readonly RpgXpLedgerEntry[]): RpgXpLedgerEntry[] {
  return foldActorRows(rows);
}
