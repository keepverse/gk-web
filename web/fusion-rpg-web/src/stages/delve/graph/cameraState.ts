import type { GraphBounds } from "./roomGraphLayout";

/**
 * The room graph's own pan/zoom camera (D5.4, spec-delve-stage.md §4 row 4 / §14's
 * `Esc_pops_one_panel_and_returns_to_the_same_graph_state`: "selection and camera survive"). A pure
 * reducer, the same split `worldSelection.ts` already uses for selection — testable without a canvas,
 * DOM, or pointer events.
 *
 * **Deliberately not `WorldStage`'s own camera.** `WorldStage.tsx`'s pan/zoom/fit is a Phaser camera
 * driven over `worldBusEmit("world:camera", ...)` (`WorldGameHost.tsx`) — GG-38 (amended 2026-09-07)
 * keeps Phaser-class canvases to "lawn/world only," and `spec-board-render.md`'s own admission that
 * the *shared* Phaser board layer is "the largest single module in the program... budget this at
 * world-stage scale, not as a reuse" rules out building a third Phaser island for this one task. This
 * reducer is the CSS-transform equivalent of the same idea — `x`/`y`/`zoom` is a pure model, the DOM
 * transform it drives is a pure output, and nothing ever reads a value back out of the DOM — matching
 * `bindCamera`'s own one-direction-of-authority rule (`spec-board-render.md` §2) even though this
 * reducer is not that bridge.
 */
export type CameraState = { x: number; y: number; zoom: number };

export const INITIAL_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };

/** Presentation bounds, not game balance — same file-local-constant rule as `roomGraphLayout.ts`'s
 * cell size. A room graph never needs to zoom out past "the whole thing fits" or in past "one room
 * fills the screen"; both are visual-design choices a feel pass could revisit without touching a
 * single wire value. */
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

export type CameraAction =
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom-by"; factor: number; anchor: { x: number; y: number } }
  | { type: "fit"; bounds: GraphBounds; viewport: { width: number; height: number } }
  | { type: "reset" };

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function cameraReducer(state: CameraState, action: CameraAction): CameraState {
  switch (action.type) {
    case "pan":
      return { ...state, x: state.x + action.dx, y: state.y + action.dy };
    case "zoom-by": {
      const nextZoom = clampZoom(state.zoom * action.factor);
      if (nextZoom === state.zoom) return state;
      // Zoom toward the anchor point (typically the pointer) rather than the viewport origin — the
      // room under the cursor stays under the cursor. Solved by keeping the anchor's position in
      // graph-space fixed across the zoom: `anchor = state.x + anchor.x / state.zoom` before and after.
      const ratio = nextZoom / state.zoom;
      return {
        x: action.anchor.x - (action.anchor.x - state.x) * ratio,
        y: action.anchor.y - (action.anchor.y - state.y) * ratio,
        zoom: nextZoom
      };
    }
    case "fit": {
      if (action.viewport.width <= 0 || action.viewport.height <= 0) return state;
      const zoom = clampZoom(
        Math.min(action.viewport.width / action.bounds.width, action.viewport.height / action.bounds.height)
      );
      // Centre the bounds in the viewport at the chosen zoom.
      const x = action.viewport.width / 2 - (action.bounds.minX + action.bounds.width / 2) * zoom;
      const y = action.viewport.height / 2 - (action.bounds.minY + action.bounds.height / 2) * zoom;
      return { x, y, zoom };
    }
    case "reset":
      return INITIAL_CAMERA;
    default: {
      const exhaustive: never = action;
      throw new Error(`cameraReducer: unhandled action ${JSON.stringify(exhaustive)}`);
    }
  }
}
