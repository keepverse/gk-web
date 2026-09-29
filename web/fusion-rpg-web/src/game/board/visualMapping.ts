/**
 * base-defense `board-render` (module 16): "kind → sprite: a caller-supplied mapping — the layer
 * knows nothing about creatures, plants, zombies or walls" (spec-board-render.md §1). `VisualMap` is
 * generic over the descriptor type on purpose: the lawn's own occupants need a color, a shape and an
 * icon key (see `SyncFromModelSystem.ts`'s `makeOccupantGo`/`makeMarkerGo`), while a siege board's own
 * visual needs are not yet specced (`battle` has no spec at all — spec-board-render.md's own Decision
 * 40 note: "do not invent battle-specific behaviour here"). Prescribing a concrete descriptor shape
 * now would be guessing at both. No kind string and no descriptor field lives in this file.
 */

export type VisualMap<TDescriptor> = Readonly<Record<string, TDescriptor>>;

/** An unmapped kind is a content gap, not a default to guess at — thrown, never silently substituted. */
export class VisualMappingError extends Error {}

export function visualFor<TDescriptor>(map: VisualMap<TDescriptor>, kind: string): TDescriptor {
  if (Object.prototype.hasOwnProperty.call(map, kind)) return map[kind] as TDescriptor;
  throw new VisualMappingError(`No visual mapping for kind "${kind}".`);
}
