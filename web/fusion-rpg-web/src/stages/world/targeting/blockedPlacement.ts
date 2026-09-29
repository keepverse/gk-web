/**
 * Where a refusal reason belongs (world-stage W70) — GG-23's second surface: a reason is shown
 * where the decision is made, never scattered into one notification string. Every one of the 41
 * drop reasons `world-playback` W72 audited is placed here, keyed by the same exact token strings
 * that table uses — never a second copy of the vocabulary, only where each one is drawn.
 *
 * **`sustain`/`build` are no longer inert** — this task's own description claims they "run
 * end-to-end in the engine and are unreachable because the wire drops one field each," which was
 * true when it was written but is stale now: `world-stage` W66 already mirrored `stance`/`amount`/
 * `structureId` onto `WorldCommandRequest`, so both verbs round-trip for real today. `ward` is the
 * one verb genuinely still inert (`WorldCommand.cs:44-49` — no admission arm, no wire field for its
 * own target) — the "inert" treatment is still real, it just names a different verb now.
 */

export type BlockedPlacement = "road" | "sector" | "slot" | "marker";

const PLACEMENT_TABLE: Record<string, BlockedPlacement> = {
  // road — lane/path refusals
  "lane.unknown": "road",
  "lane.no-heading": "road",
  "lane.severed": "road",
  "lane.one-way": "road",
  "lane.gated": "road",
  "path.not-contiguous": "road",
  "path.empty": "road",
  // sector — the target ground
  "sector.unknown": "sector",
  "sector.missing": "sector",
  "sector.not-yours": "sector",
  "sector.gone": "sector",
  "claim.elsewhere": "sector",
  "claim.contested": "sector",
  "claim.guarded": "sector",
  "build.elsewhere": "sector",
  "build.not-yours": "sector",
  "build.out-of-range": "sector",
  "warden.missing": "sector",
  "warden.not-yours": "sector",
  // slot — the inspector's own slot row
  "slot.unknown": "slot",
  "slot.elsewhere": "slot",
  "structure.unknown": "slot",
  "build.occupied": "slot",
  "build.wrong-slot-kind": "slot",
  "build.cannot-afford": "slot",
  "guard.already-cleared": "slot",
  // marker — the legion itself, plus generic protocol refusals that name no other subject
  "entity.unknown": "marker",
  "entity.not-yours": "marker",
  "entity.missing": "marker",
  "entity.routed": "marker",
  "entity.held": "marker",
  "entity.gone": "marker",
  "stance.unknown": "marker",
  "sustain.not-standing": "marker",
  "sustain.not-yours": "marker",
  "sustain.nothing-carried": "marker",
  "amount.invalid": "marker",
  "kind.unknown": "marker",
  "command.id-missing": "marker",
  "command.id-too-long": "marker",
  "commander.unknown": "marker"
};

/** The verbs `ward` names as genuinely wire-incomplete today — a third, "inert" treatment,
 * distinct from "blocked" (the order is legal but this target refuses it). */
const INERT_VERBS = new Set(["ward"]);

export function isInertVerb(verb: string): boolean {
  return INERT_VERBS.has(verb);
}

export function placementFor(reason: string): BlockedPlacement | null {
  return PLACEMENT_TABLE[reason] ?? null;
}
