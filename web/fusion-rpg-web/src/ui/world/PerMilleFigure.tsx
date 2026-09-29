import type { Magnitude } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * The four per-mille readings the map needs a sentence for (world-numbers W39): hold (a sector's
 * `StabilityMilli`), intensity (`FractureIntensityMilli`, `op: "absolute"`), hazard (a lane's
 * `HazardMilli`) and march-remaining (a legion's `MovementRemaining`). Each is a pure function of a
 * `Magnitude` (never a bare `number` — GG-46) plus its own sentence — the family rides in the type,
 * so this component never asks what a number "looks like".
 */
export type PerMilleFigureProps =
  | { reading: "hold"; value: Magnitude }
  | { reading: "intensity"; value: Magnitude }
  | { reading: "hazard"; value: Magnitude }
  | { reading: "march-remaining"; value: Magnitude };

export function PerMilleFigure(props: PerMilleFigureProps) {
  const rendered = formatMagnitude(props.value);

  switch (props.reading) {
    case "hold":
      return (
        <span data-testid="permille-figure-hold" className="text-sm text-text">
          {rendered} hold
        </span>
      );
    case "intensity":
      return (
        <span data-testid="permille-figure-intensity" className="text-sm text-text">
          {rendered} intensity
        </span>
      );
    case "hazard":
      return (
        <span data-testid="permille-figure-hazard" className="text-sm text-rose-300">
          ☠ {rendered} hazard
        </span>
      );
    case "march-remaining":
      return (
        <span data-testid="permille-figure-march-remaining" className="text-sm text-text">
          {rendered} of march remaining
        </span>
      );
    default: {
      const exhaustive: never = props;
      throw new Error(`PerMilleFigure: unhandled reading ${JSON.stringify(exhaustive)}`);
    }
  }
}
