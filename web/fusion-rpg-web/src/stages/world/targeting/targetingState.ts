/**
 * The transient overlay lifecycle (world-stage W67) — which verb is being targeted, which overlay
 * it owns, and the restore contract: range/placement overlays have no picker slot and no hotkey of
 * their own, alive only while the verb is. A pure reducer, so the lifecycle is testable with no DOM
 * and no assumption that `world-lenses` (the picker itself, Phase 4) exists yet.
 *
 * **The restore protocol is three steps, not two**, so the caller — not this module — decides when
 * the actual lens switch happens: `start` captures the lens in play; `cancel`/`complete` clears the
 * active verb and overlay but **keeps `priorLens` readable** for exactly one more beat; the caller
 * reads it, applies the real lens switch, and dispatches `lens-restored` to clear it. Collapsing
 * `priorLens` in the same step as `cancel`/`complete` would hand the caller a value that's already
 * gone by the time its own effect runs.
 */

export type TargetingVerb = "move" | "clear" | "claim" | "stand-fast" | "stance" | "sustain" | "build" | "ward";

export type OverlayKind = "range" | "placement";

export type TargetingState = {
  activeVerb: TargetingVerb | null;
  overlay: OverlayKind | null;
  /** The lens the player had chosen before targeting started — readable until the caller
   * dispatches `lens-restored`, `null` once nothing is left to restore. */
  priorLens: string | null;
};

export type TargetingAction =
  | { type: "start"; verb: TargetingVerb; overlay: OverlayKind; currentLens: string | null }
  | { type: "cancel" }
  | { type: "complete" }
  | { type: "selection-changed" }
  | { type: "lens-restored" };

export const initialTargetingState: TargetingState = {
  activeVerb: null,
  overlay: null,
  priorLens: null
};

export function targetingReducer(state: TargetingState, action: TargetingAction): TargetingState {
  switch (action.type) {
    case "start":
      return { activeVerb: action.verb, overlay: action.overlay, priorLens: action.currentLens };
    // Cancel (Esc), complete (an order filed) and an external selection change all end targeting
    // the same way — one overlay, one lifecycle, no second path that could leave it half-alive.
    case "cancel":
    case "complete":
    case "selection-changed":
      return { ...state, activeVerb: null, overlay: null };
    case "lens-restored":
      return { ...state, priorLens: null };
    default:
      return state;
  }
}

/** True while exactly one overlay is active — never more than one, by construction (`start`
 * always replaces whatever was there, it never stacks). */
export function isTargeting(state: TargetingState): boolean {
  return state.activeVerb !== null;
}
