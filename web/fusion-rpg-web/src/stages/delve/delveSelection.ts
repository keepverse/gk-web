/**
 * Room selection — the delve stage's own UI state (D5.4). Mirrors `stages/world/worldSelection.ts`'s
 * `select-sector` shape exactly, per D5.1's own instruction (`DelveStage.tsx`'s module doc comment):
 * *"`claimStageEscape` is the exact mechanism `WorldStage.tsx:138` already uses... unlike WorldStage,
 * the claim is conditional..."* — this file is the "room-selection state" that comment says does not
 * exist yet. Lives directly under `stages/delve/` rather than inside `graph/`, matching
 * `worldSelection.ts`'s own placement one level above `stages/world/render/` — this is stage-level UI
 * state, not a rendering primitive, even though only the graph reads it today.
 *
 * Deliberately does not also own camera state — `graph/cameraState.ts`'s own module comment explains
 * why that stays local to the graph component instead.
 */
export type DelveSelectionState = {
  selectedRoomId: string | null;
};

export type DelveSelectionAction = { type: "select-room"; roomId: string | null };

export const initialDelveSelection: DelveSelectionState = { selectedRoomId: null };

export function delveSelectionReducer(
  state: DelveSelectionState,
  action: DelveSelectionAction
): DelveSelectionState {
  switch (action.type) {
    case "select-room":
      // worldUiReducer's own W65 rule, reused verbatim: selecting the already-selected room again
      // deselects it, rather than being a no-op re-select. Esc (a real `roomId: null` dispatch) and a
      // background click both already pass `null` explicitly, so this only fires on a genuine second
      // click of the same room.
      return {
        selectedRoomId:
          action.roomId != null && action.roomId === state.selectedRoomId ? null : action.roomId
      };
    default: {
      const exhaustive: never = action.type;
      throw new Error(`delveSelectionReducer: unhandled action ${JSON.stringify(exhaustive)}`);
    }
  }
}
