import type { Ownership } from "./sectorChannels";

/**
 * A force's strength, shaped so the wrong rendering is not expressible (world-stage W46,
 * spec-world-render.md §Design 3). `Strength` only exists on the `exact` branch — there is no way
 * to reach into this type and print `0` for a force nobody has actually counted, which is exactly
 * the bug a flat `{ exact: boolean; strength: number }` shape invites.
 */
export type ForceChipView =
  | { entityId: string; ownership: Ownership; routed: boolean; exact: true; strength: number }
  | { entityId: string; ownership: Ownership; routed: boolean; exact: false; bandName: string; bandCeiling: number };

export function forceLabel(view: ForceChipView): string {
  if (view.exact) return String(view.strength);
  // "A host — plan for 2,400": a band is a fact about uncertainty, not a number nobody counted.
  return `${view.bandName} — plan for ${view.bandCeiling.toLocaleString("en-US")}`;
}

export function ForceChip(view: ForceChipView) {
  return (
    <span
      data-testid={`force-chip-${view.entityId}`}
      data-ownership={view.ownership}
      data-exact={view.exact}
      data-routed={view.routed}
    >
      {forceLabel(view)}
    </span>
  );
}
