import type { ForceView } from "@/contract/types";

/** Forces only ever read as "yours" or "not yours" here (world-stage W71) — a sector's own
 * ownership can be `open`/`contested`, but a force always has a real `ownerFactionId`, so the
 * richer `sectorChannels.ts` `Ownership` union would carry two values (`open`, `contested`) this
 * component could never actually receive. A narrower, honest type instead of importing one that
 * over-promises. */
export type ForceMarkerOwnership = "yours" | "enemy";

export type ForceMarkerProps = {
  force: ForceView;
  ownership: ForceMarkerOwnership;
  /** Position in the parent's own local coordinate space — the caller (`WorldScene.tsx`) already
   * knows the sector's real on-screen placement; this component only ever draws at whatever point
   * it is told. */
  x: number;
  y: number;
  selected: boolean;
  /** Only your own legions can be given a march order — an enemy/wild force's marker still draws
   * (silence would read as "nothing is here"), it simply never responds to a click. */
  selectable: boolean;
  onSelect?: () => void;
};

/**
 * A force at rest at a sector (world-stage W71) — deliberately not a reuse or adaptation of
 * `render/LegionMarker.tsx` (moved from `features/world/`, W46): that component animates a force
 * sliding along a lane's own `<path>` during turn playback, driven by `getElementById` +
 * `requestAnimationFrame`, and has no notion of "standing still at a sector" at all. This one does
 * exactly one job — draw a force where it actually is right now — and never moves on its own; **it
 * moving would be the bug** `QueuedOrders`' own acceptance names ("queueing a march does not move
 * the marker").
 *
 * Real SVG, not HTML dropped into an SVG `<g>` — this session's own hard-won lesson
 * (`WorldScene.tsx`'s `foreignObject` comment) applies here too: a `<div>` here would simply not
 * paint in a real browser, only in jsdom.
 */
export function ForceMarker({ force, ownership, x, y, selected, selectable, onSelect }: ForceMarkerProps) {
  return (
    <g
      data-testid={`legion-marker-${force.entityId}`}
      data-ownership={ownership}
      data-selected={selected}
      data-selectable={selectable}
      transform={`translate(${x}, ${y})`}
      style={selectable ? { cursor: "pointer" } : undefined}
      onClick={
        selectable
          ? (event) => {
              // The sector underneath owns its own click (opening the inspector / a targeting
              // decision) — the marker's own click is a separate, more specific gesture and must
              // never fall through to it.
              event.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
    >
      <circle data-token={ownership === "yours" ? "force-mine" : "force-enemy"} r={9} />
      <text data-testid={`legion-marker-glyph-${force.entityId}`} textAnchor="middle" dy={4}>
        {force.kind.slice(0, 1).toUpperCase() || "?"}
      </text>
    </g>
  );
}
