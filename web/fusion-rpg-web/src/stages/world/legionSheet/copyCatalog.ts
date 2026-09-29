import type { LegionSheetCopyKey } from "@/contract/types";

/**
 * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1, spec §Design 7) —
 * verbatim wire strings → copy keys → owner-accept DRAFT sentences.
 *
 * Player sentences are authored copy (GG-62) against the closed list — the
 * fold maps reason strings to keys, never invents a new reason string.
 * Every sentence below is a fiction label until the owner amends it
 * (idea-ui-phase §1): stub copy never ships as product. No engine words
 * (`typeId`, `Seq`, `correlationId`, table names) appear in any of them.
 * Filing ≠ resolving (GG-15): these sentences answer resolution (report +
 * read-backs); the filer's `ok` answers filing only.
 */

export type CopyEntry =
  | { sentence: string; devOnly?: false; reserved?: false }
  | { sentence: null; devOnly: true; reserved?: false }
  | { sentence: null; devOnly?: false; reserved: true };

/** Holder interpolation for `vault.held-by-other` — the live read, never a cached faction. */
export function holderSentence(holder: string | null): string {
  return holder && holder.length > 0
    ? `DRAFT: That vault is held by ${holder} now.`
    : "DRAFT: That vault is held by another band now.";
}

export const LEGION_SHEET_COPY: Record<LegionSheetCopyKey, CopyEntry> = {
  "cargo.done.load": { sentence: "DRAFT: Stowed." },
  "cargo.done.unload": { sentence: "DRAFT: Unloaded." },
  "cargo.done.hand": { sentence: "DRAFT: Handed over." },
  "cargo.done.deposit": { sentence: "DRAFT: Vaulted." },
  "cargo.done.withdraw": { sentence: "DRAFT: Taken out." },
  "cache.claimed.partial": { sentence: "DRAFT: Picked up what fits — the rest waits where it lies." },
  "cache.claimed.all": { sentence: "DRAFT: Picked up." },
  "cargo.full.weight": { sentence: "DRAFT: Too heavy for the band to carry." },
  "cargo.full.slots": { sentence: "DRAFT: The packs are full." },
  "cargo.not-yours": { sentence: "DRAFT: That belongs to another band's stores." },
  "cargo.gone": { sentence: "DRAFT: That is no longer where the band left it." },
  "cargo.not-here": { sentence: "DRAFT: The band is no longer at that ground." },
  "vault.held-by-other": { sentence: "DRAFT: That vault is held by another band now." },
  "vault.full": { sentence: "DRAFT: The vault has no room." },
  "cargo.other-empire": { sentence: "DRAFT: Bands of another empire cannot take this." },
  "cache.gone": { sentence: "DRAFT: Nothing lies within reach any more — the band has moved on, or the cache is spent." },
  "band.not-yours": { sentence: "DRAFT: That is not your band." },
  "band.unknown": { sentence: "DRAFT: No such band." },
  "band.missing": { sentence: "DRAFT: No band was named." },
  "band.gone": { sentence: "DRAFT: That band is gone." },
  "band.routed": { sentence: "DRAFT: That band is routed and cannot act." },
  // Authoring-time family — dev tooling only, never player prose. The recipe
  // never files a shape that triggers these (bus construction guarantees fields).
  "order.malformed": { sentence: null, devOnly: true },
  // Reserved key (owned by `world-action-economy`): the fold maps
  // `entity.spent` here so it has one family to author against. No finalized
  // sentence in this module.
  "act.spent": { sentence: null, reserved: true }
};

/**
 * The player sentence for a copy key, or `null` when there is none to show
 * (`order.malformed` dev-only, `act.spent` reserved). `vault.held-by-other`
 * interpolates the live holder via {@link holderSentence}.
 */
export function legionSheetCopy(
  key: LegionSheetCopyKey,
  args?: { holder?: string | null }
): string | null {
  if (key === "vault.held-by-other") return holderSentence(args?.holder ?? null);
  const entry = LEGION_SHEET_COPY[key];
  return entry.sentence;
}
