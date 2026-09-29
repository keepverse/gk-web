import { registerRecipe } from "@/features/gui-lego/recipeRegistry";
import type { RecipeDocument } from "@/features/gui-lego/types";
import derivedConsoleRecipe from "@/ui/gui-lego/recipes/derived-console.json";
import { registerDerivedPieces } from "./pieces/register";

/**
 * Idempotent: registers Derived piece factories + `derived-console` recipe.
 * Call from the Derived tab host before `bindSurface` / `RecipeMount`.
 */
export function ensureDerivedGuiLegoRegistered(): void {
  registerDerivedPieces();
  registerRecipe(derivedConsoleRecipe as RecipeDocument);
}

export { registerDerivedPieces };
