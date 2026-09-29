import { useState } from "react";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { PanelShell } from "@/shell/PanelShell";

const TABS = [
  { id: "creatures", label: "Creatures", Component: CatalogPage },
  { id: "recipes", label: "Recipes", Component: RecipesPage }
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * T19 — plate 05 §A/§E: "/types and /recipes become Almanac tabs." The two pages are unchanged,
 * same pattern T12/T15/T17 used for wrapping an already-real page. The plate's fuller creature
 * book (per-species matchups, a fusion tree, an elements-ring reference, an afflictions catalog)
 * has no real backing yet — `CatalogPage`/`RecipesPage` are the honest, real, current richness,
 * not the plate's full mockup; building the richer reference pages is real future scope, not
 * faked here.
 */
export function AlmanacLayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<TabId>("creatures");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Almanac"
      testId="almanac-layer"
      footer={
        <div className="flex flex-wrap gap-1" data-testid="almanac-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`almanac-tab-${t.id}`}
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
      <div data-testid={`almanac-surface-${active.id}`}>
        <active.Component />
      </div>
    </PanelShell>
  );
}
