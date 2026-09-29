import { registerRecipe } from "@/features/gui-lego/recipeRegistry";
import type { RecipeDocument } from "@/features/gui-lego/types";
import storySceneRecipe from "@/ui/gui-lego/recipes/story-scene.json";
import { registerStoryScenePieces } from "./pieces/storyScene";

/**
 * Register the story-scene surface: its piece factories, then its recipe.
 *
 * Mirrors `registerCondition.ts` exactly — pieces first so a recipe never references an
 * unregistered factory (which `RecipeMount` would silently render as a themed div). Idempotent via
 * the pieces module's own guard; `registerRecipe` overwrites by `surfaceId`, so re-registering the
 * same document is a no-op rather than a duplicate.
 */
export function ensureStorySceneRegistered(): void {
  registerStoryScenePieces();
  registerRecipe(storySceneRecipe as RecipeDocument);
}
