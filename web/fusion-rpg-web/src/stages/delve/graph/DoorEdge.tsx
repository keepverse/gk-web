import type { DoorView } from "@/contract/types";
import { cn } from "@/lib/cn";
import type { Point } from "./roomGraphLayout";
import { doorTreatmentFor } from "./doorKind";

export type DoorEdgeProps = {
  door: DoorView;
  from: Point;
  to: Point;
};

/**
 * One door, drawn as an SVG line between its two rooms' centres (D5.4, spec-delve-stage.md §4/§7:
 * "doors, gates, one-way arrows"). Doors are never sight-gated (`DoorView`'s own doc comment), so
 * this component never reads a room's `sight` — every door always renders its real treatment.
 *
 * Expects a `<marker id="delve-door-arrow">` defined once by the parent `<svg><defs>`
 * (`DelveGraph.tsx`) — a marker is a document-level SVG resource, redefining one per edge would be
 * both wasteful and (per the SVG spec) harmless-but-silly duplication.
 */
export function DoorEdge({ door, from, to }: DoorEdgeProps) {
  const treatment = doorTreatmentFor(door);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  return (
    <g data-testid={`delve-door-${door.laneId}`} data-gated={treatment.gated} data-one-way={treatment.oneWay} data-secret={treatment.secret} data-severed={treatment.severed}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        className={cn(
          "stroke-2",
          treatment.severed ? "stroke-bad" : "stroke-muted",
          (treatment.secret || treatment.severed) && "[stroke-dasharray:6,6]",
          treatment.secret && "opacity-60"
        )}
        markerEnd={treatment.oneWay ? "url(#delve-door-arrow)" : undefined}
      />
      {treatment.gated ? (
        <text
          x={midX}
          y={midY}
          textAnchor="middle"
          dominantBaseline="middle"
          data-testid="delve-door-gate-mark"
          aria-hidden="true"
          className="text-xs"
        >
          🔒
        </text>
      ) : null}
    </g>
  );
}
