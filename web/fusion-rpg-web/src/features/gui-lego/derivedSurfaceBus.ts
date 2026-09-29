import { bindSurface } from "./bindSurface";
import { createSurfaceBus } from "./createSurfaceBus";
import type { RecipeDocument } from "./types";

/** Closed Derived surface bus events (payload-types). */
export type DerivedSurfaceEvent =
  | "derived.search.set"
  | "derived.showUnchanged.set"
  | "derived.tab.set"
  | "derived.variant.set"
  | "derived.channel.select"
  | "derived.retry";

export function createDerivedSurfaceBus() {
  return createSurfaceBus<DerivedSurfaceEvent>();
}

export const DERIVED_SURFACE_EVENTS: readonly DerivedSurfaceEvent[] = [
  "derived.search.set",
  "derived.showUnchanged.set",
  "derived.tab.set",
  "derived.variant.set",
  "derived.channel.select",
  "derived.retry"
] as const;

export function bindDerivedConsole(
  recipe: RecipeDocument,
  vm: unknown
) {
  return bindSurface(recipe, vm);
}
