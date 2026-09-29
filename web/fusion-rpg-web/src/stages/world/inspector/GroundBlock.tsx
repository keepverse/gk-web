import type { SectorView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * Block 2 (world-stage W58; `pressure` added at W63) — `StabilityMilli`, `DevelopmentLevel`,
 * fracture intensity and (found stale, fixed at W63) `PressureMilli`, all real on `SectorView` and
 * all rendered through `formatMagnitude`. Terrain is visible once a sector has been seen at all, so
 * this block renders identically for every non-`Unknown` intel state — `Watched`, `Scouted` and
 * `Rumored` alike — matching `Fog.tsx`'s own established grouping of the two stale states for
 * static facts (`--text`, never `--muted`, at either wash). `Unknown` is the one branch that renders
 * nothing: reached, on purpose, without this component reading anything but `intel`.
 */
export function GroundBlock({ sector }: { sector: SectorView }) {
  if (sector.intel === "Unknown") return null;

  return (
    <div data-testid="ground-block" data-intel={sector.intel}>
      <h4 className="mb-1 font-display text-sm text-text">The ground</h4>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Stability</dt>
          <dd className="text-text">{formatMagnitude(sector.stability)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Development</dt>
          <dd className="text-text">{formatMagnitude(sector.developmentLevel)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Fracture</dt>
          <dd className="text-text">{formatMagnitude(sector.fractureIntensity)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Pressure</dt>
          <dd data-testid="ground-pressure" className="text-text">
            {formatMagnitude(sector.pressure)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
