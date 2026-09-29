import { registerRecipe } from "@/features/gui-lego/recipeRegistry";
import type { RecipeDocument } from "@/features/gui-lego/types";
import shieldConsoleRecipe from "@/ui/gui-lego/recipes/shield-console.json";
import { registerDerivedPieces } from "./pieces/register";

export function ensureShieldGuiLegoRegistered(): void {
  registerDerivedPieces();
  registerRecipe(shieldConsoleRecipe as RecipeDocument);
}
