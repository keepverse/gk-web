import Phaser from "phaser";

/**
 * Per-scene async art state — ONE owner for every texture the lawn plane loads at draw time.
 *
 * This exists because two draw sites need the same three things and had each grown their own
 * partial version of them: a request de-dupe, a load-failure memo, and a "art finished, repaint"
 * callback. The type-icon path grew them first (`ensureIcon` in `SyncFromModelSystem.ts`); the
 * Band B element-glyph path then re-implemented the first two and missed the third, which is
 * exactly the AUDIT-2 race — a glyph requested on the first board-stats whose texture is not in
 * the TextureManager yet, and nothing re-runs the draw when it arrives.
 *
 * Both now come through `requestSceneTexture`, so there is one request set, one failure set and
 * one completion callback per scene. The failure memo is load-bearing, not bookkeeping: without it
 * a 404 re-issues `scene.load.image` on every repaint, because the key is still absent after a
 * `FILE_LOAD_ERROR`. `wireLawnIconLoadErrors` fills this same set, so the two paths cannot drift.
 *
 * The sets keep their historical `_icon*` names: they are the state the existing epoch-bust and
 * the existing error handler already read, and renaming them would buy nothing but a diff.
 */
export type SceneArtState = {
  _iconLoads?: Set<string>;
  _iconFails?: Set<string>;
  _iconCb?: () => void;
};

export function sceneArtState(scene: Phaser.Scene): SceneArtState {
  return scene as unknown as SceneArtState;
}

/**
 * Start a one-shot image load unless the key is already present or already known-failed.
 *
 * Returns true only when THIS call issued the request, so a caller can tell "someone else is
 * already fetching it" from "nobody is". Either way the returned texture is not available yet:
 * the caller must not treat a true as permission to draw.
 *
 * `onReady` is (re)armed on every call, matching the type-icon path's existing behaviour — the
 * scene hands the same repaint closure down on every sync, so the latest one must win even when
 * the request itself was issued earlier.
 */
export function requestSceneTexture(
  scene: Phaser.Scene,
  key: string,
  url: string,
  onReady?: () => void
): boolean {
  const st = sceneArtState(scene);
  if (!st._iconLoads) st._iconLoads = new Set();
  if (!st._iconFails) st._iconFails = new Set();
  if (st._iconFails.has(key)) return false;
  if (onReady) st._iconCb = onReady;
  if (st._iconLoads.has(key)) return false;

  st._iconLoads.add(key);
  scene.load.image(key, url);
  // Hooked BEFORE `start()`: a load that resolves without the loop ever reporting COMPLETE
  // would otherwise leave the repaint unscheduled, which is the bug in its own right.
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    st._iconCb?.();
  });
  if (!scene.load.isLoading()) scene.load.start();
  return true;
}
