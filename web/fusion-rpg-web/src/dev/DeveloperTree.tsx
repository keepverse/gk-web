import { lazy, Suspense, useEffect, useState } from "react";
import { ChunkFallback } from "@/shell/ChunkFallback";
import { PanelShell } from "@/shell/PanelShell";

// GG-38's "dev" chunk (tech-stack.md §6, unbudgeted but still not entry weight): the nine pages
// load only once the tree is actually opened, not on every app boot.
const StatusPage = lazy(() => import("@/features/status/StatusPage").then((m) => ({ default: m.StatusPage })));
const StatsPage = lazy(() => import("@/features/stats/StatsPage").then((m) => ({ default: m.StatsPage })));
const PvzActivityPage = lazy(() =>
  import("@/features/pvz-activity/PvzActivityPage").then((m) => ({ default: m.PvzActivityPage }))
);
const IconDumpPage = lazy(() =>
  import("@/features/icon-dump/IconDumpPage").then((m) => ({ default: m.IconDumpPage }))
);
const AlmanacDumpPage = lazy(() =>
  import("@/features/almanac-dump/AlmanacDumpPage").then((m) => ({ default: m.AlmanacDumpPage }))
);
const CheatsPage = lazy(() => import("@/features/cheats/CheatsPage").then((m) => ({ default: m.CheatsPage })));
const SimPage = lazy(() => import("@/features/sim/SimPage").then((m) => ({ default: m.SimPage })));
const MetricsPage = lazy(() => import("@/features/metrics/MetricsPage").then((m) => ({ default: m.MetricsPage })));
const PhaserSceneSwitchPocPage = lazy(() =>
  import("./PhaserSceneSwitchPocPage").then((m) => ({ default: m.PhaserSceneSwitchPocPage }))
);
// item-content module `atom-preview` (T9). A dev surface rather than a fold into AlmanacDumpPage:
// that page is scoped to scraped in-game pedia text (`/api/almanac/dump`, plant/zombie sides), a
// different content type with no extension point, and its "review then promote" shell is a
// list/detail over almanac rows rather than a generic authoring frame.
const AtomPreviewPage = lazy(() =>
  import("./AtomPreviewPage").then((m) => ({ default: m.AtomPreviewPage }))
);

export const DEV_SURFACES = [
  { id: "status", label: "Status", Component: StatusPage },
  { id: "stats", label: "Stats", Component: StatsPage },
  { id: "pvz-activity", label: "PvzActivity", Component: PvzActivityPage },
  { id: "icon-dump", label: "IconDump", Component: IconDumpPage },
  { id: "almanac-dump", label: "AlmanacText", Component: AlmanacDumpPage },
  { id: "atom-preview", label: "ItemPreview", Component: AtomPreviewPage },
  { id: "cheats", label: "Cheats", Component: CheatsPage },
  { id: "sim", label: "Sim", Component: SimPage },
  // "log" removed: its own `@/features/log/LogPage` was never built (no such module anywhere in
  // the tree) — a scaffolded entry pointing at nothing, found while unrelated FE work needed a
  // clean production build.
  { id: "runs", label: "Runs", Component: MetricsPage },
  { id: "phaser-scene-poc", label: "ScenePOC", Component: PhaserSceneSwitchPocPage }
] as const;

export type DevSurfaceId = (typeof DEV_SURFACES)[number]["id"];

/**
 * The gated tree (T12, GG-40–42): density beats polish, engine vocabulary
 * is correct here (the nine pages inside are unchanged from v1 — this only
 * changes how they're *reached*), but it still obeys the stack, Esc, focus
 * and volume rules like any other band-2 layer — it does not get its own
 * bespoke overlay mechanism.
 */
export function DeveloperTree({
  open,
  onOpenChange,
  initialTab
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: DevSurfaceId;
}) {
  const [tab, setTab] = useState<DevSurfaceId>(initialTab ?? "status");

  // `initialTab` names the surface a deep link (`?dev=<id>`, an old-route redirect) wants
  // open, but this component is mounted once for the app's lifetime — the `useState`
  // initializer above only fires on that first mount. Every later deep link (SPA nav
  // between two old routes, or a fresh load where the router hasn't resolved the query on
  // the very first render) must also resync the visible tab, not just the very first one.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const active = DEV_SURFACES.find((s) => s.id === tab) ?? DEV_SURFACES[0];

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Developer"
      subtitle="Off by default — never part of player navigation"
      testId="dev-tree"
      footer={
        <div className="flex flex-wrap gap-1" data-testid="dev-tree-tabs">
          {DEV_SURFACES.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid={`dev-tree-tab-${s.id}`}
              onClick={() => setTab(s.id)}
              aria-current={s.id === tab}
              className={`rounded-sm border px-2 py-1 text-xs ${
                s.id === tab ? "border-lawn-hot bg-lawn text-text" : "border-border text-muted hover:bg-panel"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      <div data-testid={`dev-tree-surface-${active!.id}`}>
        <Suspense fallback={<ChunkFallback testId={`dev-tree-surface-${active!.id}-loading`} />}>
          <active.Component />
        </Suspense>
      </div>
    </PanelShell>
  );
}
