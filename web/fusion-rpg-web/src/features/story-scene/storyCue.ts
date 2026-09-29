import type { ThemeResolved } from "@/features/gui-lego/types";
import type { StoryCueId } from "./sceneScript";

/**
 * The semantic cue seam for a story scene — and what it is **not**.
 *
 * Owner decision 3 settled this and corrected the ideal's own over-framing: **the story scene is a
 * web-FE feature**, so the FE owns the cue. The beats, the speaker, and the cue id live in the FE;
 * the shipped dialog already renders its own cue state via `data-cue` with CSS. There is **no
 * injector-side story state machine and none should be built** — the injector does not know what a
 * prologue is and should not learn.
 *
 * ## Where the union lives
 *
 * The canonical `StoryCueId` stays in `sceneScript.ts` next to `SceneBeat.cueId`, which is what makes
 * a typo a compile error. This module owns the **runtime-closed list** plus everything that turns a
 * cue id into DOM without ever turning it into player text. Splitting type (beats) from seam
 * (rendering) keeps both files small and avoids churning T6's green, tested contract.
 *
 * ## How a cue reaches the screen
 *
 * 1. The beat carries `cueId?: StoryCueId` — absent means no cue this beat.
 * 2. The mood join (`sceneMood.ts`) resolves the cue to a **scene pack**; the pack's `vfx.select`
 *    resolves to a class through the existing `vfxClass` helper. Piece code never maps a cue id to
 *    paint or motion directly, so a scene mood can change its cue without a code edit.
 * 3. The id itself travels only as a `data-cue` **attribute** (`cueDataAttribute`). It is never
 *    rendered as text: `sceneId`/`cueId` contain mechanism words (`rift.`) that must not reach the
 *    player, and the system is `story-scene`, never "Rift" on the surface.
 *
 * ## Reduced motion
 *
 * Under `prefers-reduced-motion: reduce` the cue renders as an **instant state change**, not an
 * animation (the GG-32 analogue: motion honors the OS setting rather than asking the player again).
 * `prefersReducedMotion()` is the single read; stages key their transition rules off it. Absence of
 * `matchMedia` (jsdom, SSR) means "no preference expressed", so motion stays on — the CSS media
 * query remains the real enforcement in browsers.
 *
 * ## The optional host seam
 *
 * The existing `onCue?: (cueId) => void` prop is the precedent and it stays **optional and
 * host-agnostic**: the scene works fully with no consumer. If a host later forwards a cue over a
 * bridge, it can — but this module opens no socket, binds no key, and invents no transport. The
 * four Unity-side `rift.*` recipes in `VfxCatalog.cs` are data the injector may wire one day; they
 * are unwired (a wiring gap, reported in the ideal) and this module does not touch them, close the
 * gap, or depend on them.
 */

/** The v1 cue vocabulary, closed. A fifth cue id is a new union member plus a list entry. */
export const STORY_CUE_IDS = [
  "rift.portal.open",
  "rift.portal.surge",
  "rift.quarantine.seal",
  "rift.quarantine.fade"
] as const satisfies readonly StoryCueId[];

/**
 * Exhaustiveness proof, checked by `tsc` (this file is typechecked; `*.test.*` is excluded from the
 * build config, so the proof must live here, not in a test). Adding a fifth member to `StoryCueId`
 * without extending this record fails the build — which is exactly the "closed union" acceptance.
 * It doubles as the O(1) membership table for `isStoryCueId`, so the proof is load-bearing at
 * runtime too, not a dead assertion.
 */
const STORY_CUE_IDS_COMPLETE: Record<StoryCueId, true> = {
  "rift.portal.open": true,
  "rift.portal.surge": true,
  "rift.quarantine.seal": true,
  "rift.quarantine.fade": true
};

export function isStoryCueId(value: string): value is StoryCueId {
  // `hasOwnProperty`, not `in`: the `in` operator walks the prototype chain, so `"toString"`
  // would wrongly pass. Only the four ids in the closed record may pass.
  return Object.prototype.hasOwnProperty.call(STORY_CUE_IDS_COMPLETE, value);
}

/**
 * The DOM contract for a cue: the id travels **only** as a `data-cue` attribute. The returned
 * object has exactly one key — there is deliberately no label, text, or children channel here, so
 * a cue id cannot leak into player-visible copy through this function. Absent cue ⇒ empty object
 * (no attribute), never `data-cue="undefined"`.
 */
export function cueDataAttribute(cueId: StoryCueId | undefined): { "data-cue"?: StoryCueId } {
  if (cueId === undefined) return {};
  return { "data-cue": cueId };
}

/**
 * Resolve a beat's cue to the scene pack's vfx class id (`vfx.select`), or `null` when the pack
 * names none. This delegates to the pack — piece code never maps a cue id to a class itself. A
 * `null` here means "state change only", which is also what reduced motion degrades to.
 */
export function cueVfxClass(themeResolved: ThemeResolved | null | undefined): string | null {
  const select = themeResolved?.vfx?.select;
  return typeof select === "string" && select.length > 0 ? select : null;
}

/** Single read of the OS reduced-motion preference. Absent API ⇒ no preference ⇒ motion stays on. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}