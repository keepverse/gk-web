import { useLayerStack, type Band } from "./layerStack";

export type { Band };

/**
 * Shell-owned read over the layer stack: scan down from the topmost layer. Returns true when a
 * `panel` or `dialog` sits above any `system` layer — those bands capture Esc-dismissable
 * gestures, so background hotkeys must no-op (GG-18). A `system` layer ends the scan with false:
 * it owns Esc itself, and anything beneath it is irrelevant to the gesture.
 *
 * This facade exists so non-shell code can ask the question WITHOUT importing the store: the
 * layer-stack guard (`bandGuard.ts`) reserves `@/shell/layerStack` imports for `shell/` itself,
 * keeping single ownership of visibility. Callers get the policy; the store stays here.
 */
export function isTopGestureCaptured(): boolean {
  const layers = useLayerStack.getState().layers;
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const band = layers[i]!.band;
    if (band === "panel" || band === "dialog") return true;
    if (band === "system") return false;
  }
  return false;
}
