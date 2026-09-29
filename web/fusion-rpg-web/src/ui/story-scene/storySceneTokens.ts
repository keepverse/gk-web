/**
 * Story-scene STRUCTURAL tokens.
 *
 * Structural caps are not progression ceilings — each is a geometry consequence of the layout, and
 * every entry says why it is not a dial. A value here changes because the layout changed, never
 * because a balance pass moved it; anything a designer would tune lives in
 * `gk-core/data/tuning/story-scene-ui.v1.json` instead.
 *
 * See `docs/architecture/story-scene/spec-scene-tunables.md` and
 * `gk-web/web/fusion-rpg-web/src/ui/lawn/lawnPresentationTokens.ts` for the same split.
 */

/**
 * Art bed aspect ratio (width / height).
 * Structural: it is the authored illustration's own shape, not a look-and-feel choice —
 * letterboxing a differently-shaped image would misrepresent the art.
 */
export const STORY_SCENE_ART_ASPECT = 16 / 9;

/**
 * Width (px) below which the two-actor layout collapses to a stack.
 * Structural: a viewport breakpoint, not a dial. Owner decision S1 fixes the collapse rule
 * (stack speaker-forward, never hide an actor); only the threshold is expressed here.
 */
export const STORY_SCENE_ACTOR_COLLAPSE_PX = 720;

/**
 * Edge length (px) of the labelled stand-in drawn when an actor's art is missing.
 * Structural: it must read at the actor slot's own size, so it follows the slot rather than a
 * design preference — shrinking it would defeat the point of labelling the missing actor.
 */
export const STORY_SCENE_PLACEHOLDER_SIZE_PX = 160;

/**
 * Minimum advance/skip hit target (px).
 * Structural accessibility floor, not a dial: this is the WCAG 2.5.8 target-size minimum and it
 * must NOT be tuned down. A scene whose advance control is hard to hit can trap the player.
 */
export const STORY_SCENE_TOUCH_TARGET_MIN_PX = 44;
