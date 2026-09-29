import type { CachePinView } from "@/contract/types";

export type CachePinProps = {
  /** One entry of the selected legion's `CachePinListView` — presence + count only. */
  pin: CachePinView;
  /** Highlight when the claim prompt is open for this cache. Visual only, never fog. */
  selected?: boolean;
  onPick?: (cacheId: string) => void;
};

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 3 (plan Task 4D.2b) —
 * the fallen-cache pin, beside `LegionMarker` (sector forces) and `Lane`
 * (lane edges) in this same `render/` layer family: one pin kind meaning
 * "fallen cache", glyph + count, faction-neutral paint from packs
 * (themeRefs, never hard-coded). No forked overlay, no second marker
 * pipeline (SOLID: one marker layer family, extended by one kind).
 *
 * Hidden-until-found is server-side: the parent renders one `CachePin` per
 * entry of the selected legion's `ClaimableCacheListDto` and nothing else
 * (pin presence == response presence). This component therefore takes NO
 * position, NO visibility flag, and performs NO filtering:
 * - no `atSectorId` / `onLaneId` prop to compare (the view carries none —
 *   `CachePinView` has no legion position, so no client-side fog logic can
 *   be built here even by accident);
 * - no `visible: false` handling (unreachable caches are absent from the
 *   response, never masked);
 * - no void/empty filtering (the server's `EXISTS` clause already excludes
 *   emptied caches; an emptied pin vanishes on the next per-selection
 *   re-read, never by an FE-side delete).
 *
 * A pin rendered without a same-response listing entry is a defect; a cache
 * hidden client-side that the server listed is a defect. Adding any of the
 * three prohibited props above re-implements fog and is a defect.
 */
export function CachePin({ pin, selected, onPick }: CachePinProps) {
  return (
    <g
      data-testid={`cache-pin-${pin.cacheId}`}
      data-place-kind={pin.placeKind}
      data-item-count={pin.itemCount.value}
      data-selected={selected ? "true" : "false"}
    >
      <text
        data-testid={`cache-pin-glyph-${pin.cacheId}`}
        textAnchor="middle"
        aria-label={`Fallen cache, ${pin.itemCount.value} packs`}
        role={onPick ? "button" : "img"}
        onClick={onPick ? () => onPick(pin.cacheId) : undefined}
      >
        {/* Literal glyph, never a numeric character entity: a `#`-prefixed
            entity trips hexGuard's four-digit scan, and paint comes from
            packs, never a literal. */}
        ◆
      </text>
      <text data-testid={`cache-pin-count-${pin.cacheId}`} textAnchor="middle">
        {pin.itemCount.value}
      </text>
    </g>
  );
}
