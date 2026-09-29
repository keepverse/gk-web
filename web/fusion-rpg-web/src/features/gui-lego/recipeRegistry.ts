import type { RecipeDocument } from "./types";

const recipes = new Map<string, RecipeDocument>();

export function registerRecipe(doc: RecipeDocument): void {
  recipes.set(doc.surfaceId, doc);
}

export function getRecipe(surfaceId: string): RecipeDocument | undefined {
  return recipes.get(surfaceId);
}

export function requireRecipe(surfaceId: string): RecipeDocument {
  const hit = recipes.get(surfaceId);
  if (!hit) throw new Error(`gui-lego: unknown recipe "${surfaceId}"`);
  return hit;
}

export function clearRecipeRegistryForTests(): void {
  recipes.clear();
}
