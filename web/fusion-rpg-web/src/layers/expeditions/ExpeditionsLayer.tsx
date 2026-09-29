import { ExpeditionsPage } from "@/features/expeditions/ExpeditionsPage";
import { PanelShell } from "@/shell/PanelShell";

/**
 * T17 — the real, already-shipped expedition system (spec-expeditions.md), now reachable as a
 * band-2 layer instead of a standalone route. Same pattern T15 used for Fusion: `ExpeditionsPage`
 * is unchanged, wrapped in this shell. Returns themselves announce via toast + rail badge
 * (`expeditionReturnWatcher.ts`, wired in `SanctumStage.tsx`), never by auto-opening this layer.
 */
export function ExpeditionsLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <PanelShell open={open} onOpenChange={onOpenChange} title="Expeditions" testId="expeditions-layer">
      <ExpeditionsPage />
    </PanelShell>
  );
}
