import { registerRecipe } from "@/features/gui-lego/recipeRegistry";
import type { RecipeDocument } from "@/features/gui-lego/types";
import aptitudesConsoleRecipe from "@/ui/gui-lego/recipes/aptitudes-console.json";
import aptitudePresetConsoleRecipe from "@/ui/gui-lego/recipes/aptitude-preset-console.json";
import { registerDerivedPieces } from "./pieces/register";

export function ensureAptitudesGuiLegoRegistered(): void {
  registerDerivedPieces();
  registerRecipe(aptitudesConsoleRecipe as RecipeDocument);
  registerRecipe(aptitudePresetConsoleRecipe as RecipeDocument);
}
