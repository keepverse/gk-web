export type DowseBlockProps = {
  /** `WorldStateDto.ProspectedSectorIds` membership — not a `SectorView` field (it's world-scoped),
   * so the caller checks membership once and passes the per-sector answer down. */
  prospected: boolean;
};

/**
 * Block 9 (world-stage W63) — reads `Prospecting.Reveal` (`IntelRecorder.cs:179`) via the caller's
 * own `prospected` flag. **This task's own description claims the `dowse` stance is "missing from
 * `MovementPolicy.Stances`" — checked the real `LaneCost.cs` before writing anything, and it is
 * stale**: `world-commands` W30 ("The `dowse` stance and its missing `BudgetFor` arm") already
 * landed `Dowse` into `Stances`, earlier in this same program. That does not change this block's own
 * scope, though: block 9 is read-only ("what prospecting has found"), never an action surface — the
 * verb belongs to whatever files a `stance` order (Phase 2's `world-targeting`), not here. So this
 * component still offers no button either way; the correction is only to the reasoning, not the
 * markup.
 */
export function DowseBlock({ prospected }: DowseBlockProps) {
  return (
    <div data-testid="dowse-block">
      <h4 className="mb-1 font-display text-sm text-text">Dowsing</h4>
      <p className="text-sm text-text">
        {prospected
          ? "A dowser has confirmed a loam source here this turn."
          : "No dowser has surveyed this ground this turn."}
      </p>
    </div>
  );
}
