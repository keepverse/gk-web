import { registerPiece } from "@/features/gui-lego/pieceRegistry";
import type { PieceFactory } from "@/features/gui-lego/types";
import { actorPortraitFactory } from "@/ui/story-scene/actorPortrait";
import { actorSpriteFactory } from "@/ui/story-scene/actorSprite";
import { sceneStageFactory } from "@/ui/story-scene/sceneStage";
import { advanceControlFactory } from "@/ui/story-scene/advanceControl";
import { dialogueWindowFactory } from "@/ui/story-scene/dialogueWindow";
import { nameTagFactory } from "@/ui/story-scene/nameTag";
import { sceneProgressFactory } from "@/ui/story-scene/sceneProgress";

/**
 * The closed set of slot names a story-scene piece may declare.
 *
 * Pinned here, once, so the pieces (T12–T19) and the recipe (T21) cannot drift apart: a piece that
 * invents its own slot name, or a recipe that binds a name no piece declares, would otherwise fail
 * silently — `bindSurface` resolves an unknown slot to `undefined` and `RecipeMount` simply renders
 * nothing for it. `storyScene.test.tsx` asserts this set is the vocabulary the slot map uses.
 */
export const STORY_SCENE_SHARED_SLOTS = [
  /** The scene's ordered actor slots (`actor-portrait[]`). */
  "actors",
  /** The say window (`dialogue-window`), which itself hosts `nameTag`. */
  "window",
  /** The speaker label inside the window (`name-tag`); absent on a narration beat. */
  "nameTag",
  /** Beat `n of m` (`scene-progress`); absent when a scene has one beat. */
  "progress",
  /** Next / final / skip (`advance-control`). */
  "advance"
] as const;

export type StorySceneSharedSlot = (typeof STORY_SCENE_SHARED_SLOTS)[number];

/**
 * Story-scene piece group.
 *
 * Every story-scene piece registers here rather than in the shared Derived group
 * (`./register.ts`), for two reasons:
 *
 * 1. **Ownership.** `register.ts`'s groups are the Derived surface's (`layout`, `chrome`, `badges`,
 *    `condition`, `domain`, `lifecycle`, `shield`, `aptitude`), and its own re-bind carve-out is
 *    aptitude-specific. A stage-layer surface appended there would sit inside the Derived
 *    registration path. Each new surface already has its own group module instead
 *    (`ui/gui-lego/registerCondition.ts`, `registerAptitudes.ts`), and this follows that.
 * 2. **The failure it prevents, stated plainly.** `RecipeMount.renderNode` looks a piece up in the
 *    registry and, when no factory is found, silently renders a themed `<div data-piece=…>` with
 *    the slot children instead (`RecipeMount.tsx:43-56`). A scene whose pieces are unregistered
 *    therefore renders **without error** and looks almost right while every piece's own markup and
 *    behaviour is missing. Registration is an acceptance criterion on every piece task because of
 *    this, and `storyScene.test.tsx` asserts this group is the single source.
 *
 * `STORY_SCENE_SLOT_MAP` is the per-piece slot declaration, the same shape the shared groups use.
 * It starts empty and each piece task (T12–T19) adds its own entry alongside its factory.
 */
export const STORY_SCENE_SLOT_MAP: Record<string, readonly string[]> = {
  // `actor-portrait` takes no recipe-bound slot: its sprite arrives via render-time composition
  // (the parent array renderer passes the sprite node as `slots.body`), exactly like `actor-sprite`
  // takes none. The T5-pinned vocabulary forbids inventing a `body` slot name here — the spec's
  // Slots row describes that render-time prop, not a recipe binding the mount must resolve.
  "actor-portrait": [],
  "actor-sprite": [],
  // The compose root consumes all four shared slots; the fold (T20) binds them, the recipe (T21)
  // mounts them. No other piece may declare these names for a different purpose.
  "scene-stage": ["actors", "window", "progress", "advance"],
  "name-tag": [],
  "advance-control": [],
  "scene-progress": [],
  // `dialogue-window` hosts the speaker label; the fold omits the slot on a narration beat.
  "dialogue-window": ["nameTag"]
};
export const storySceneFactories: Record<string, PieceFactory> = {
  "actor-portrait": actorPortraitFactory,
  "actor-sprite": actorSpriteFactory,
  "scene-stage": sceneStageFactory,
  "name-tag": nameTagFactory,
  "advance-control": advanceControlFactory,
  "scene-progress": sceneProgressFactory,
  "dialogue-window": dialogueWindowFactory
};

let registered = false;

/**
 * Register every story-scene piece factory into `pieceRegistry` (idempotent).
 *
 * Mirrors `./register.ts`'s shape exactly: a module-level guard for the first call, then a re-bind
 * loop on later calls. The re-bind exists because this group grows piece-by-piece (T12–T19) and an
 * HMR reload or a long-lived test runner must pick up a newly added `pieceId` rather than keep a
 * stale registry — the same reason `register.ts` re-binds its own growing aptitude group
 * (`./register.ts:43-50`).
 */
export function registerStoryScenePieces(): void {
  if (!registered) {
    for (const [pieceId, factory] of Object.entries(storySceneFactories)) {
      registerPiece({ pieceId, slots: STORY_SCENE_SLOT_MAP[pieceId] ?? [], factory });
    }
    registered = true;
    return;
  }
  // Re-bind so HMR / long-lived test runners pick up pieces added since the first call.
  for (const [pieceId, factory] of Object.entries(storySceneFactories)) {
    registerPiece({ pieceId, slots: STORY_SCENE_SLOT_MAP[pieceId] ?? [], factory });
  }
}

/** Test helper — allows re-register after `clearPieceRegistryForTests`. */
export function resetStoryScenePiecesRegistrationFlagForTests(): void {
  registered = false;
}
