import type { ReactNode } from "react";
import type { IntelState } from "@/contract/types";
import { fogTreatmentFor } from "./fogTreatments";

export type FogProps = {
  intel: IntelState;
  intelAge: number;
  /** The card underneath — typically a `SectorNode`. Rendered as-is; `Fog` never inspects it. */
  children: ReactNode;
};

/**
 * Wraps a sector card with its fog treatment (world-stage W47). **Branches on `intel`, never on
 * emptiness** — an unseen sector serialises every other field at its record default
 * (`WorldEndpoints.cs:271-277`), so a wrapper that inferred "unknown" from a zeroed payload would
 * draw a real, poor, zero-danger sector as unexplored. This component trusts the caller's own
 * `intel` field as the one source of truth and never looks at anything else to decide.
 */
export function Fog({ intel, intelAge, children }: FogProps) {
  const treatment = fogTreatmentFor(intel, intelAge);

  return (
    <div
      data-testid="fog-wrapper"
      data-wash={treatment.wash}
      data-wash-cap={treatment.washCapPercent}
      data-doubled-border={treatment.doubledBorder}
      data-ragged-border={treatment.raggedBorder}
    >
      {children}
      {treatment.stamp ? (
        <div data-testid="fog-stamp" className="text-text">
          {treatment.stamp}
        </div>
      ) : null}
      {treatment.forcesStrip ? (
        <div data-testid="fog-forces-strip" className="text-text">
          {treatment.forcesStrip}
        </div>
      ) : null}
    </div>
  );
}
