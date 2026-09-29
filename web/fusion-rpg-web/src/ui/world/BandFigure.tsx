import type { Magnitude } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * An index with its denominator — `◆◆◆ Danger 3 of 5` (world-numbers W39). `SectorNode.tsx:104`'s
 * `"◆".repeat(n)` lacks the denominator entirely, which is the defect this replaces: a bare glyph
 * count means nothing without knowing the ceiling it is measured against. Pure function of two
 * `Magnitude`s (never a bare `number` — GG-46) plus a label.
 */
export type BandFigureProps = {
  index: Magnitude;
  ceiling: Magnitude;
  label: string;
  glyph?: string;
};

export function BandFigure({ index, ceiling, label, glyph = "◆" }: BandFigureProps) {
  const filled = Math.max(0, Math.min(ceiling.value, index.value));
  const empty = Math.max(0, ceiling.value - filled);

  return (
    <span data-testid="band-figure" className="text-sm text-text">
      <span aria-hidden="true">
        {glyph.repeat(filled)}
        {"◇".repeat(empty)}
      </span>{" "}
      {label} {formatMagnitude(index)} of {formatMagnitude(ceiling)}
    </span>
  );
}
