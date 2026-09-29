import { useLayerStack } from "./layerStack";

/**
 * True while a blocking surface (band `panel` or `dialog`) is open, so the stage behind it can stop
 * scrolling.
 *
 * **Why this file exists rather than an import in `AppShell`.** `layerStack` is a shell-only
 * mechanism — `bandGuard.scanForLayerStackImports` fails any import of it from outside `shell/`,
 * because GG-1 wants one owner of layer visibility. `AppShell` does not need the stack; it needs one
 * derived boolean. Exposing that boolean here keeps the store shell-owned and gives the stage a
 * read-only fact, which is what the guard is protecting.
 *
 * The scroll rule itself is GG-36 as `AppShell` already states it: the outlet must never hand the
 * page a scrollbar it should not have. With a panel up, the page behind it is not what the player is
 * reading, and two live scrollbars is the symptom that says so.
 */
export function useStageScrollLocked(): boolean {
  return useLayerStack((state) =>
    state.layers.some((layer) => layer.band === "panel" || layer.band === "dialog"));
}
