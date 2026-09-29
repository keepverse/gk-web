/**
 * GG-18 mute for world map chrome verbs (gaps D8).
 * When the top Esc-dismissible band is panel/dialog, pan and lens hotkeys no-op.
 *
 * Thin facade over the shell-owned query (`shell/topLayer.ts`): this module keeps the
 * world-specific name its three callers and its test import, but the stack walk lives with
 * the stack. Importing `@/shell/layerStack` here would trip the layer-stack guard, which
 * reserves the store for `shell/` to keep single ownership of visibility.
 */
import { isTopGestureCaptured } from "@/shell/topLayer";

/** Topmost panel/dialog blocks map chrome verbs; stage/hud/toast/system do not (system owns Esc). */
export function isWorldMapChromeMuted(): boolean {
  return isTopGestureCaptured();
}
