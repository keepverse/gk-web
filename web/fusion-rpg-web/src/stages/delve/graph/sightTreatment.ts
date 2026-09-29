import type { DelveSightState } from "@/contract/types";

/**
 * The three room-graph sight treatments (D5.4, spec-delve-stage.md §7: "the three sight treatments
 * (unlit · glimpsed · seen, `Visibility.cs:6-16`)"). `DelveSightState` is `SectorSight`'s own C#
 * member names verbatim (`None | Glimpse | Full`, `contract/types.ts:1005`) — this module is the one
 * place that maps those three ordinals onto what a room card actually shows.
 *
 * **Sight is drawn, never worded** (spec §8's own vocabulary table: *"Not words: a drawn
 * treatment"*). There is deliberately no player-facing string anywhere in this file — `RoomNode.tsx`
 * keys its CSS/data-attributes off the `DelveSightState` value directly (the same non-lexical
 * encoding `Fog.tsx`'s own `data-wash`/`data-doubled-border` attributes already use for the identical
 * reason on the world map) rather than rendering "Unlit"/"Glimpsed"/"Seen" as text anywhere.
 *
 * `DelveProjection.cs`'s own `ProjectRoom` (`Core/Delve/DelveProjection.cs:164-176`) is the server
 * rule this mirrors: `kind` alone survives at `Glimpse`; every other content field
 * (`archetypeId`/`eventId`/`resolvedKind`/`resolvedArchetypeId`/`floorContents`) needs `Full`. This
 * module does not re-decide that rule — `RoomNode.tsx` simply never reads a content field the sight
 * tier does not already null out, so there is only ever one place that decision is made (the server).
 */
export type SightReveal = {
  /** Whether the room card shows anything at all beyond its bare position. `None` still renders a
   * card — the graph shape itself is never sight-gated (`SectorSight.None`'s own doc comment,
   * `Visibility.cs:8`: "Position and lanes only — the graph is public, its contents are not"). */
  showsKind: boolean;
  /** Archetype, event, resolved-kind and floor contents — `Full` only (`Visibility.cs:14`: "Standing
   * in it or holding it: everything, including what is buried in the ground"). */
  showsDetail: boolean;
};

export function sightRevealFor(sight: DelveSightState): SightReveal {
  switch (sight) {
    case "None":
      return { showsKind: false, showsDetail: false };
    case "Glimpse":
      return { showsKind: true, showsDetail: false };
    case "Full":
      return { showsKind: true, showsDetail: true };
    default: {
      // Defensive only — `DelveSightState` is a closed three-member union at the type level, so this
      // is unreachable through normal use. Matches `fogTreatmentFor`'s own exhaustive-switch shape
      // (`stages/world/render/fogTreatments.ts:72-75`), not `adaptDelveRoom`'s "show less" rule —
      // that rule belongs to the wire-to-view translation (`toDelveSight`), one layer below this
      // module, which has already run by the time a `DelveSightState` reaches here.
      const exhaustive: never = sight;
      throw new Error(`sightRevealFor: unhandled sight state ${JSON.stringify(exhaustive)}`);
    }
  }
}
