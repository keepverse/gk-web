import { registerRecipe } from "@/features/gui-lego/recipeRegistry";
import type { RecipeDocument } from "@/features/gui-lego/types";
import conditionConsoleRecipe from "@/ui/gui-lego/recipes/condition-console.json";
import { registerDerivedPieces } from "./pieces/register";

export function ensureConditionGuiLegoRegistered(): void {
  registerDerivedPieces();
  registerRecipe(conditionConsoleRecipe as RecipeDocument);
}
