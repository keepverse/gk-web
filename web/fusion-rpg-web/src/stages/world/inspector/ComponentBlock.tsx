import type { SectorView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * Block 5 (world-stage W61) — the **detail** half of §8b.5's summary-up/detail-down split: the
 * HUD strip (`TopStrip.tsx`) shows the empire's own total; this block shows one sector's own
 * territory reach, reading the identical `component.*` projection so the two can never disagree.
 * *"My empire is fine"* can be true while this component starves — that is exactly the case this
 * block exists to make visible, so a starving reach carries the same non-colour-first legibility
 * `ComponentSplit.tsx` (`world-hud` W54) established: a glyph, its own sentence, and only then the
 * tint.
 */
export function ComponentBlock({ sector }: { sector: SectorView }) {
  return (
    <div data-testid="component-block">
      <h4 className="mb-1 font-display text-sm text-text">Its territory</h4>
      {sector.component.componentId ? (
        <>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">Earns</dt>
              <dd className="text-text">{formatMagnitude(sector.component.production)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">Costs</dt>
              <dd className="text-text">{formatMagnitude(sector.component.upkeep)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">Net</dt>
              <dd className="text-text">{formatMagnitude(sector.component.net)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">In store</dt>
              <dd className="text-text">{formatMagnitude(sector.component.stock)}</dd>
            </div>
          </dl>
          {sector.component.net.value < 0 ? (
            <p className="mt-1 border-2 border-bad-solid px-2 py-1 text-sm text-bad" data-testid="component-block-starving">
              <span aria-hidden="true">▲</span> this reach can&apos;t cover its own keep
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">Not part of a connected territory.</p>
      )}
    </div>
  );
}
