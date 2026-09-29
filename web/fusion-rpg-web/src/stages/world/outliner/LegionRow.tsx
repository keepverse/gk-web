import type { LegionView } from "@/contract/types";
import { PerMilleFigure } from "@/ui/world/PerMilleFigure";

export type LegionRowProps = {
  legion: LegionView;
  unresolved: boolean;
};

/**
 * world-stage W92 (spec-world-outliner.md) — stance · movement · supply runway · the unresolved
 * flag, and no fifth fact (that is the inspector's job). Movement goes through `world-numbers`'
 * `PerMilleFigure` with its `march-remaining` family declared — never a bare per-mille number sharing
 * a sentence with a stock or a hazard reading. The unresolved flag is a glyph **and** text, never
 * colour alone, so it is findable by accessible name with colour removed.
 */
export function LegionRow({ legion, unresolved }: LegionRowProps) {
  return (
    <span data-testid={`legion-row-${legion.entityId}`} className="flex items-center gap-2 text-sm">
      <span data-testid="legion-row-stance">{legion.stance}</span>
      <PerMilleFigure reading="march-remaining" value={legion.movementRemaining} />
      <span data-testid="legion-row-runway">
        {legion.runway.state === "known"
          ? legion.runway.value == null
            ? "not burning supply"
            : `${legion.runway.value} turn${legion.runway.value === 1 ? "" : "s"} of supply left`
          : legion.runway.state === "pending"
            ? legion.runway.reason
            : "runway does not apply"}
      </span>
      {unresolved ? (
        <span data-testid="legion-row-unresolved">
          <span aria-hidden="true">●</span> needs orders
        </span>
      ) : null}
    </span>
  );
}
