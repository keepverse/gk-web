import type { SectorView } from "@/contract/types";
import { LoamFigure } from "@/ui/world/LoamFigure";
import { PerMilleFigure } from "@/ui/world/PerMilleFigure";

export type SectorRowProps = {
  sector: SectorView;
  fading: boolean;
};

/**
 * world-stage W92 (spec-world-outliner.md) — net flow · fade risk · will-release, and no fifth fact.
 * Net flow goes through `LoamFigure`'s own flow reading; fade risk goes through `PerMilleFigure`'s
 * `hold` reading (a sector's stability, the same figure `world-numbers` already built for it) rather
 * than a bespoke percentage. A short runway loses **pips**, not hue — fading here is text **and** a
 * glyph, colour removed, findable by accessible name.
 */
export function SectorRow({ sector, fading }: SectorRowProps) {
  return (
    <span data-testid={`sector-row-${sector.sectorId}`} className="flex items-center gap-2 text-sm">
      <LoamFigure kind="flow" amount={sector.loam.net} period="per turn" />
      <PerMilleFigure reading="hold" value={sector.stability} />
      {fading ? (
        <span data-testid="sector-row-fading">
          <span aria-hidden="true">▼</span> fading
        </span>
      ) : null}
      {sector.willReleaseNextTurn ? (
        <span data-testid="sector-row-will-release">
          <span aria-hidden="true">⚠</span> will be released next turn
        </span>
      ) : null}
    </span>
  );
}
