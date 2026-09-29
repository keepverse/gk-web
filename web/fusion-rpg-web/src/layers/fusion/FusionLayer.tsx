import { FusionPage } from "@/features/fusion/FusionPage";
import { PanelShell } from "@/shell/PanelShell";

/**
 * T15 — the creature fusion lab (spec-creature-fusion.md), already shipped and real, now reachable
 * as a band-2 layer over whatever stage the player is on (GG-1) instead of a standalone route.
 * `FusionPage`'s own internals are unchanged — same pattern T12 used for the developer tree's
 * nine pages: the page keeps its own `<Page>` heading inside this shell's body, so the tab is
 * reachable without a rewrite of a page that already works.
 */
export function FusionLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <PanelShell open={open} onOpenChange={onOpenChange} title="Fusion" testId="fusion-layer">
      <FusionPage />
    </PanelShell>
  );
}
