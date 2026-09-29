import { useAptitudes, usePlayers, useSaveAptitudes } from "@/lib/bus";
import { useAllocationDraft } from "@/hooks/useAllocationDraft";
import { Page } from "@/layouts/Page";
import { Banner, Button, EmptyState, Field, NumberInput, Panel, StatBar } from "@/ui";

/**
 * spec-aptitude-allocation-surface.md — the first player-reachable way to spend aptitude points.
 * Commander scope only (applies to every creature fielded); the twelve ids come straight off the
 * server's own response, never a separately-hardcoded catalog mirror. Free respec today (POST a
 * different body any time) — pricing it is a named follow-up, not built here.
 *
 * The draft/dirty/budget/save flow itself is `useAllocationDraft` (passive-tree-todo.md I2) — this
 * page and `ProgressionTab.tsx` are its two callers, never two copies of the same logic.
 */
export function AptitudesPage() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const aptitudes = useAptitudes(playerId);
  const save = useSaveAptitudes();

  const allocation = useAllocationDraft({
    serverValues: aptitudes.data?.shares,
    budget: aptitudes.data?.budget ?? 0,
    isSaving: save.isPending,
    onSave: (draft) => save.mutateAsync({ playerId, shares: draft })
  });

  if (aptitudes.isLoading || !aptitudes.data || allocation.draft === null) {
    return (
      <Page title="Primary stats" testId="aptitudes-page">
        <EmptyState title="Loading aptitudes…" testId="aptitudes-loading" />
      </Page>
    );
  }

  const { draft, spent, withinBudget, dirty, error } = allocation;
  const budget = aptitudes.data.budget;

  return (
    <Page
      title="Primary stats"
      description="Spend commander points across the twelve aptitudes. Applies to every creature you field."
      testId="aptitudes-page"
    >
      {error && <Banner tone="error">{error}</Banner>}

      <Panel title="Budget" testId="aptitudes-budget">
        <StatBar label={`${spent} / ${budget} spent · Ladder ${aptitudes.data.theta}`} value={spent} max={Math.max(budget, 1)} />
      </Panel>

      <Panel title="Aptitudes" testId="aptitudes-grid">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(draft).map(([id, value]) => (
            <Field key={id} label={id}>
              <NumberInput
                min={0}
                value={value}
                data-testid={`aptitude-input-${id}`}
                onChange={(next) => allocation.setValue(id, next)}
              />
            </Field>
          ))}
        </div>
      </Panel>

      <Button
        onClick={allocation.save}
        disabled={!dirty || !withinBudget || save.isPending}
        title={!withinBudget ? `Over budget by ${spent - budget}` : !dirty ? "No changes to save" : undefined}
        data-testid="aptitudes-save"
      >
        {save.isPending ? "Saving…" : "Save allocation"}
      </Button>
    </Page>
  );
}
