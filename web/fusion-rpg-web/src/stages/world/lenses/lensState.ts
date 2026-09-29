import { HOME_LENS_ID, type LensId } from "./lensCatalog";

export type LensState = {
  /** What is drawn right now. */
  active: LensId;
  /** What the player last chose. Auto-activation never writes this — spec §3. */
  playerChosen: LensId;
};

export const initialLensState: LensState = { active: HOME_LENS_ID, playerChosen: HOME_LENS_ID };

export type LensAction =
  /** The player pressed a number key or clicked the picker. */
  | { type: "select"; id: LensId }
  /** A trigger from spec §3 (ward a road, an out-of-supply legion, a fade warning opened from the
   * rail) — writes only `active`, never `playerChosen`, so a restore can undo it. */
  | { type: "auto-activate"; id: LensId }
  /** Esc, or the triggering action completing — puts back the lens the player actually chose. */
  | { type: "restore" };

/**
 * world-stage W94 (spec-world-lenses.md §1, §3) — pure: exclusive by construction (the type permits
 * exactly one `active`, never zero or two). Pressing the active lens's own key returns to Ownership;
 * pressing Ownership's own key while already there is a no-op, not a toggle to nothing.
 */
export function lensReducer(state: LensState, action: LensAction): LensState {
  switch (action.type) {
    case "select": {
      if (action.id === state.active) {
        if (state.active === HOME_LENS_ID) return state; // no-op, not a toggle to nothing
        return { active: HOME_LENS_ID, playerChosen: HOME_LENS_ID };
      }
      return { active: action.id, playerChosen: action.id };
    }
    case "auto-activate":
      return { ...state, active: action.id };
    case "restore":
      return { ...state, active: state.playerChosen };
    default: {
      const exhaustive: never = action;
      throw new Error(`lensReducer: unhandled action ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * world-stage W98 (spec-world-lenses.md §3) — the four named triggers, and the one place that
 * decides what each does to the lens. Only three of the four ever touch this module at all:
 * choosing **Raise** opens the placement overlay — `world-targeting`'s, explicitly *not a lens*
 * (§3's own table: "nothing the player could want to see is hidden") — so it has no member here by
 * construction, not by omission. The other three each resolve to exactly one `auto-activate` action;
 * nothing here decides *when* a trigger fires (that is each real call site's job, once one exists —
 * `world-targeting`'s ward-a-road flow, legion selection, the notify rail's fade warning — none of
 * which this module owns or imports), only what firing it means for the lens.
 */
export type AutoActivationTrigger =
  | { kind: "ward-a-road" }
  | { kind: "legion-outside-supply" }
  | { kind: "fade-warning" };

/** Resolves a trigger to the `auto-activate` action for it — never `select`, so `playerChosen`
 * is always left untouched (the restore contract's whole basis). */
export function autoActivationAction(trigger: AutoActivationTrigger): LensAction {
  switch (trigger.kind) {
    case "ward-a-road":
    case "legion-outside-supply":
      return { type: "auto-activate", id: "supply" };
    case "fade-warning":
      return { type: "auto-activate", id: "fade" };
    default: {
      const exhaustive: never = trigger;
      throw new Error(`autoActivationAction: unhandled trigger ${JSON.stringify(exhaustive)}`);
    }
  }
}
