import type { Point } from "./supplyEnvelope";
import { supplyEnvelopeFor } from "./supplyEnvelope";

export type SupplyOverlaySector = {
  sectorId: string;
  position: Point;
  /** `null` means genuinely outside any connected, fed territory — cut off. */
  componentId: string | null;
};

export type SupplyOverlayProps = {
  sectors: SupplyOverlaySector[];
};

function polygonPoints(points: readonly Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * The connected block that is actually fed (world-stage W48) — drawn as one filled envelope per
 * component when a convex hull genuinely represents it, per-lane otherwise (`supplyEnvelope.ts`).
 * A sector outside every component draws crossed-out **with the words**, never the mark alone.
 */
export function SupplyOverlay({ sectors }: SupplyOverlayProps) {
  const byComponent = new Map<string, SupplyOverlaySector[]>();
  for (const sector of sectors) {
    if (sector.componentId === null) continue;
    const list = byComponent.get(sector.componentId);
    if (list) list.push(sector);
    else byComponent.set(sector.componentId, [sector]);
  }

  const cutOff = sectors.filter((s) => s.componentId === null);

  return (
    <g data-testid="supply-overlay">
      {[...byComponent.entries()].map(([componentId, members]) => {
        const componentPositions = members.map((m) => m.position);
        const foreignPositions = sectors
          .filter((s) => s.componentId !== componentId)
          .map((s) => s.position);
        const envelope = supplyEnvelopeFor(componentPositions, foreignPositions);

        if (envelope.kind === "hull") {
          return (
            <polygon
              key={componentId}
              data-testid={`supply-envelope-${componentId}`}
              data-kind="hull"
              points={polygonPoints(envelope.points)}
            />
          );
        }

        return (
          <g key={componentId} data-testid={`supply-envelope-${componentId}`} data-kind="per-lane">
            {members.map((m) => (
              <circle key={m.sectorId} data-testid={`supply-node-${m.sectorId}`} cx={m.position.x} cy={m.position.y} r={4} />
            ))}
          </g>
        );
      })}

      {cutOff.map((sector) => (
        <g key={sector.sectorId} data-testid={`supply-cutoff-${sector.sectorId}`}>
          <text x={sector.position.x} y={sector.position.y} aria-hidden="true">
            ✕
          </text>
          <text data-testid={`supply-cutoff-label-${sector.sectorId}`} x={sector.position.x} y={sector.position.y + 14}>
            cut off
          </text>
        </g>
      ))}
    </g>
  );
}
