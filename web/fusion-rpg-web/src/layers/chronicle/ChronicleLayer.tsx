import { useState } from "react";
import { MetricsPage } from "@/features/metrics/MetricsPage";
import { RpgProgressionPage } from "@/features/rpg-progression/RpgProgressionPage";
import { PvzStatsPage } from "@/features/pvz-stats/PvzStatsPage";
import { PanelShell } from "@/shell/PanelShell";

const TABS = [
  { id: "runs", label: "Runs", Component: MetricsPage },
  { id: "growth", label: "Growth", Component: RpgProgressionPage },
  { id: "pvz-stats", label: "Fusion sheet", Component: PvzStatsPage }
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * T19 — plate 05 §C/§E: "/runs, /rpg-progression and /pvz-stats become tabs of one Chronicle...
 * one question asked three ways." The three pages are unchanged, same pattern T12/T15/T17 used.
 * The plate's "Recent" timeline and "Standing"/"where growth came from" summary tabs have no real
 * backing (no event-feed or growth-attribution-by-category endpoint exists) — Runs/Growth/Fusion
 * sheet are the honest, real, current content; the richer life-story framing is real future scope.
 * `RpgProgressionPage`'s own ledger already carries plate §D's real, paged, filterable, sourced
 * XP ledger (`useRpgProgressionLedger`, `>240` rule) — this task's own `DivergingBar`/`BarChart`/
 * `Sparkline` chart primitives (`src/ui/*`) are what that page renders with.
 */
export function ChronicleLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<TabId>("runs");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Chronicle"
      testId="chronicle-layer"
      footer={
        <div className="flex flex-wrap gap-1" data-testid="chronicle-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`chronicle-tab-${t.id}`}
              aria-current={t.id === tab}
              onClick={() => setTab(t.id)}
              className={`rounded-sm border px-2 py-1 text-xs ${
                t.id === tab ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div data-testid={`chronicle-surface-${active.id}`}>
        <active.Component />
      </div>
    </PanelShell>
  );
}
