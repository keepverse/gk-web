import type { SectorView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { translateIntel, translatePhase } from "@/ui/world/worldEnums";

/** `"1 night old"` / `"4 nights old"` — the inspector's own age wording, distinct from the map fog
 * stamp's `"seen N turns ago"` (`fogTreatments.ts`) since this surface reads at a slower, more
 * narrative register than the map's own compact card. */
function nightsOld(age: number): string {
  return `${age} night${age === 1 ? "" : "s"} old`;
}

/**
 * Block 1 (world-stage W58) — a pure function of one `SectorView`, per `spec-world-inspector.md`'s
 * own code style. **The branch is on `intel`, explicit and first, never on emptiness**: an unseen
 * sector serialises every other field at its record default, byte-identical to a real, poor,
 * zero-danger sector except for `intel` itself — so the `Unknown` arm below reads `intel` and
 * `sectorId` only, nothing else, exactly the shape the spec's own code example draws.
 */
export function IdentityHeader({ sector }: { sector: SectorView }) {
  if (sector.intel === "Unknown") {
    return (
      <div data-testid="identity-header" data-intel="Unknown">
        <span aria-hidden="true">?</span> unexplored
      </div>
    );
  }

  return (
    <div data-testid="identity-header" data-intel={sector.intel}>
      <h4 className="mb-1 font-display text-sm text-text">Identity</h4>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Type</dt>
          <dd className="text-text">{sector.typeId}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Climate</dt>
          <dd className="text-text">{sector.climate ?? "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Phase</dt>
          <dd className="text-text">{translatePhase(sector.phase)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Danger</dt>
          <dd className="text-text">{formatMagnitude(sector.dangerBand)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2" data-testid="identity-intel-row">
          <dt className="text-muted">Intel</dt>
          <dd className="text-text">
            {translateIntel(sector.intel)}
            {sector.intelAge > 0 ? ` — ${nightsOld(sector.intelAge)}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
