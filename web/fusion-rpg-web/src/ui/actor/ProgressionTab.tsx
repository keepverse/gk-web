import { useAptitudes, usePlayers, useSaveAptitudes } from "@/lib/bus";
import type { ActorView } from "@/contract/types";
import { useAllocationDraft } from "@/hooks/useAllocationDraft";
import { Banner, Button, EmptyState, Field, NumberInput, StatBar } from "@/ui";
import { PendingNote } from "./shared";

/**
 * actor-sheet program, progression-tab — level/XP (typed on ActorView, never rendered anywhere until
 * now) plus primary-stat distribution. The aptitude half now shares `useAllocationDraft`
 * (passive-tree-todo.md I2) with `AptitudesPage.tsx` rather than duplicating its draft/dirty/budget/
 * save logic — the extraction this file's own comment named before this task landed.
 *
 * Name collision, noted 2026-09-20 (`backlog-clean-up` BCU7.1): this is NOT the tab `ActorPanel.tsx`
 * renders in its own unified tab set — that slot is `AptitudesTab` (`./AptitudesTab`), a different
 * component. `ProgressionTab` here is used only by the standalone `AptitudesPage.tsx`. Do not assume
 * the two are the same component or that one supersedes the other from the name alone.
 */
export function ProgressionTab({ data }: { data: ActorView }) {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const aptitudes = useAptitudes(playerId);
  const save = useSaveAptitudes();

  return (
    <div className="mt-4" data-testid="progression-tab">
      <section data-testid="progression-level">
        <p className="text-2xs font-bold uppercase tracking-wide text-muted">Level &amp; XP</p>
        <p className="font-display text-lg text-text">Level {data.level}</p>
        {data.xpToNext.state === "known" ? (
          <StatBar label={`${data.xp} / ${data.xp + data.xpToNext.value} xp`} value={data.xp} max={data.xp + data.xpToNext.value} />
        ) : (
          <PendingNote pending={data.xpToNext} testId="progression-xp-pending" />
        )}
        <p className="text-xs text-muted" data-testid="progression-xp-raw">
          {data.xp} xp
        </p>
      </section>

      <section className="mt-4" data-testid="progression-aptitudes">
        <p className="text-2xs font-bold uppercase tracking-wide text-muted">Primary stats — commander scope</p>
        {aptitudes.isLoading || !aptitudes.data ? (
          <EmptyState title="Loading aptitudes…" testId="progression-aptitudes-loading" />
        ) : (
          <ProgressionAptitudes
            playerId={playerId}
            budget={aptitudes.data.budget}
            theta={aptitudes.data.theta}
            serverShares={aptitudes.data.shares}
            save={save}
          />
        )}
      </section>
    </div>
  );
}

function ProgressionAptitudes({
  playerId,
  budget,
  theta,
  serverShares,
  save
}: {
  playerId: number;
  budget: number;
  theta: number;
  serverShares: Record<string, number>;
  save: ReturnType<typeof useSaveAptitudes>;
}) {
  const allocation = useAllocationDraft({
    serverValues: serverShares,
    budget,
    isSaving: save.isPending,
    onSave: (draft) => save.mutateAsync({ playerId, shares: draft })
  });

  if (allocation.draft === null) return <EmptyState title="Loading aptitudes…" testId="progression-aptitudes-loading" />;

  const { draft, spent, withinBudget, dirty, error } = allocation;

  return (
    <>
      {error && <Banner tone="error">{error}</Banner>}
      <p className="text-xs text-muted">
        {spent} / {budget} spent · Ladder {theta}
      </p>
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
      <Button
        className="mt-3"
        onClick={allocation.save}
        disabled={!dirty || !withinBudget || save.isPending}
        title={!withinBudget ? `Over budget by ${spent - budget}` : !dirty ? "No changes to save" : undefined}
        data-testid="aptitudes-save"
      >
        {save.isPending ? "Saving…" : "Save allocation"}
      </Button>
      <p className="mt-2 text-xs italic text-muted">
        Only the commander scope is wired today — this is the same allocation the standalone Primary
        Stats layer already saves.
      </p>
    </>
  );
}
