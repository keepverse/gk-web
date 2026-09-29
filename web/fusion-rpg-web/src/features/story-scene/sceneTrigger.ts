/**
 * The story-scene trigger seam: "should this scene play for this player right now?"
 *
 * This module is deliberately **minimal** (owner decision N3). It names and types the eligibility
 * check that `SanctumStage` already performed inline for one hard-coded story, so scene 2 has a home
 * for its trigger — and it stops there. It is **not** a story engine:
 *
 * - **No copy, no arcs, no scheduling.** The spec is identity plus an optional predicate. What story
 *   happens when is a future program's problem.
 * - **No ordering.** With two eligible scenes the caller's order decides; a queue or priority scheme
 *   is explicitly out of scope, and saying so here prevents a half-built scheduler accreting.
 * - **Read-only.** The trigger never writes; only the host's acknowledgement writes.
 *
 * The governing rule is that **the server is the authority**: `eligible` comes from the story ledger
 * the backend owns (`RpgStore.Onboarding.cs`), and the FE's `when` can only ever narrow it. Reversing
 * that would let the FE present a story the server has decided is not due.
 */

/** One server-reported story row, as the FE reads it (`lib/bus/onboarding.ts`'s adapted DTO). */
export type StoryLedgerEntry = {
  storyId: string;
  version: number;
  state: string;
  eligible: boolean;
};

export type SceneTriggerContext = {
  /** True when no other layer is open — a scene must not interrupt a panel. */
  noLayerOpen: boolean;
};

/** A scene the FE can present. Identity only — no copy lives here. */
export type SceneTriggerSpec = {
  sceneId: string;
  version: number;
  /** Optional extra gate evaluated **in addition to** the server's `eligible` flag. Narrows only. */
  when?: (ctx: SceneTriggerContext) => boolean;
};

/**
 * The Rift prologue's trigger.
 *
 * Version-pinned to the same identity the host acknowledges (`storyContract.ts`), so a bumped script
 * re-presents rather than being silenced by an old acknowledgement.
 */
export const RIFT_PROLOGUE_TRIGGER: SceneTriggerSpec = {
  sceneId: "rift-prologue",
  version: 1
};

/**
 * Should this scene play, right now?
 *
 * Pure, and server-authoritative: a matching ledger row must exist, the server must say `eligible`,
 * no layer may be open, and the spec's optional `when` (if any) must also agree. The last clause is
 * why `when` can only narrow — it is ANDed with the server's answer, never ORed.
 */
export function isSceneEligible(
  spec: SceneTriggerSpec,
  ledger: readonly StoryLedgerEntry[],
  ctx: SceneTriggerContext
): boolean {
  if (!ctx.noLayerOpen) return false;

  const entry = ledger.find(
    (row) => row.storyId === spec.sceneId && row.version === spec.version
  );
  // A missing row means the server has never reported this story for this player: not due.
  if (!entry) return false;
  // The server's word is final; the FE does not re-derive it from `state`.
  if (!entry.eligible) return false;

  return spec.when ? spec.when(ctx) : true;
}
