import type { Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";
import type { Point } from "./supplyEnvelope";

export type LifelineOverlaySector = {
  sectorId: string;
  position: Point;
  lifeline: Pending<boolean>;
  lifelineCost: Pending<Magnitude>;
};

export type LifelineOverlayProps = {
  sectors: LifelineOverlaySector[];
};

/**
 * The lifeline halo (world-stage W48) — dashed amber ring + ◈ + a sentence naming the cost, drawn
 * only for a sector both flags say is a lifeline. **Opt-in on the server**
 * (`?lifelines=true`, `WorldEndpoints.cs:51` — the reconnection sweep is `O(holdings⁴)`), so this
 * component never fetches anything itself: absent data (`Pending`) simply renders nothing, and the
 * request cost is entirely the caller's own decision to ask for it in the first place.
 *
 * **Corrected against the real implementation, not the plate's own prose:** the acceptance text
 * this module was planned against says the sentence "names the number of sectors cut off," but
 * `LifelineCost` is not a sector count — it is `ReconnectionCost.For`'s march-cost delta
 * (`Topology/ReconnectionCost.cs:36-70`, the increase in total travel cost across surviving sector
 * pairs), read straight off the wire with no client-side re-derivation. The sentence below names
 * what the number actually is rather than a false "N sectors" claim a genuine count would support.
 */
export function LifelineOverlay({ sectors }: LifelineOverlayProps) {
  const lifelines = sectors.filter(
    (s) => s.lifeline.state === "known" && s.lifeline.value && s.lifelineCost.state === "known"
  );

  return (
    <g data-testid="lifeline-overlay">
      {lifelines.map((sector) => {
        const cost = sector.lifelineCost as { state: "known"; value: Magnitude };
        return (
          <g key={sector.sectorId} data-testid={`lifeline-halo-${sector.sectorId}`}>
            <circle
              data-testid={`lifeline-ring-${sector.sectorId}`}
              cx={sector.position.x}
              cy={sector.position.y}
              r={18}
              fill="none"
              strokeDasharray="4 3"
            />
            <text x={sector.position.x} y={sector.position.y} aria-hidden="true">
              ◈
            </text>
            <text
              data-testid={`lifeline-sentence-${sector.sectorId}`}
              x={sector.position.x}
              y={sector.position.y + 22}
            >
              losing this splits your empire — reconnection cost {formatMagnitude(cost.value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
