import type { ForceView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { translateForceKind } from "@/ui/world/worldEnums";

/**
 * One force row (world-stage W62) — yours exact, anyone else's a band. `ForceView`'s own
 * discriminated union (`exact: true | false`) makes reading `strength` off an inexact force a
 * compile error rather than a UI that quietly renders `Strength 0` for a force nobody counted.
 */
export function ForceRow({ force }: { force: ForceView }) {
  return (
    <li data-testid={`force-row-${force.entityId}`} className="text-sm text-text">
      {translateForceKind(force.kind)} —{" "}
      {force.exact
        ? formatMagnitude(force.strength)
        : `${force.bandName} (up to ${formatMagnitude(force.bandCeiling)})`}
    </li>
  );
}
