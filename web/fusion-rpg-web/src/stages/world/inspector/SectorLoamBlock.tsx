import type { SectorView } from "@/contract/types";
import { known } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";
import { ModifierLedger } from "@/ui/world/ModifierLedger";

/**
 * Block 4 (world-stage W61) — this sector's own loam: earns · costs · net · in store. The upkeep
 * figure opens `ModifierLedger` (`world-numbers` W41/W42) rather than a bare number — its five rows
 * read straight off `sector.loam.upkeepBreakdown`, never re-derived here, and sum back to the same
 * upkeep total shown beside it.
 */
export function SectorLoamBlock({ sector }: { sector: SectorView }) {
  return (
    <div data-testid="sector-loam-block">
      <h4 className="mb-1 font-display text-sm text-text">This sector&apos;s loam</h4>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Earns</dt>
          <dd className="text-text">{formatMagnitude(sector.loam.production)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Costs</dt>
          <dd data-testid="sector-loam-upkeep">
            <ModifierLedger breakdown={known(sector.loam.upkeepBreakdown)} total={sector.loam.upkeep} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Net</dt>
          <dd className="text-text">{formatMagnitude(sector.loam.net)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">In store</dt>
          <dd className="text-text">{formatMagnitude(sector.loam.stock)}</dd>
        </div>
      </dl>
    </div>
  );
}
