/**
 * passive-tree-todo.md I10 — "The authored naming swap" (spec-tree-surface.md §15 "Ask first:
 * Naming" / §17 open question 1).
 *
 * §15 files naming under *Ask first*: "a name is content and the owner's call, and one is needed
 * before any player text is written." I2-I9 shipped against the spec's own working vocabulary in
 * the meantime — that default only holds if a later task can drop in real authored names with a
 * one-file change. **This is that file, not that decision.**
 *
 * Two of §17 Q1's six open names are handled here: the three currencies and the two tracks
 * (§4.1's own table). The other four — *paths* / *traits* / *Focus* / *Plan* / *bloodline* /
 * *stance* — stay untouched; naming an entity is a bigger, still-undecided content call than naming
 * a wallet or a verb, and folding it in here would be inventing an owner decision, not building the
 * mechanism for one. Only what is already assembled below shipped through I2-I9; nothing here is a
 * new content choice.
 *
 * **Every value below is today's spec vocabulary, not an authored name.** Swapping to real names
 * later is exactly one edit: change the strings in this object. No other passive-tree file should
 * ever spell these words out again — `passiveVocabularyGuard.test.ts` fails the build if one does.
 */
export const PASSIVE_TREE_VOCABULARY = {
  /** The three currencies (§4.1's table: "the surface names each one, every time"). */
  currency: {
    /** Opens a tier. A *source*, never gear-fed (D12) — the Aptitudes tab is the one place it's
     * spent. */
    aptitudePoints: "aptitude points",
    /** Buys a trait's Unlock. Gear CAN grant these (D11). */
    skillPoints: "skill points",
    /** Deepens an owned trait. Uncapped by design (PS-8) — never rendered behind a slider. */
    souls: "souls"
  },
  /** The two tracks (§4, D3: "one cell, one verb"). */
  track: {
    /** The rare, structural, one-shot act. Capitalized form, for a stand-alone label or button
     * ("Unlock", "Unlock · 14 skill points"). */
    unlockLabel: "Unlock",
    /** Same word, lower-case, for mid-sentence use ("Available to unlock"). */
    unlockVerb: "unlock",
    /** The repeated, unbounded act's own count-noun (§4's worked example: "Depth 6"). Capitalized
     * form, for a stand-alone label. */
    depthLabel: "Depth",
    /** Same word, lower-case, for mid-sentence use ("Planned depth"). */
    depthNoun: "depth"
  }
} as const;
