import {
  usePlayers,
  usePvzActivityFacts,
  usePvzActivityRollup,
  useSeedPvzActivityDemo,
  useSpawnExtraIntent,
  type PvzActivityFact
} from "@/lib/bus";
import { Page } from "@/layouts/Page";
import {
  Button,
  DataTable,
  EmptyState,
  HelpText,
  Panel,
  type DataTableColumn
} from "@/ui";

const factColumns: DataTableColumn<PvzActivityFact>[] = [
  { key: "kind", header: "Kind", cell: (r) => r.kind },
  { key: "source", header: "Source", cell: (r) => `${r.sourceKind}/${r.sourceId}` },
  { key: "run", header: "Run", cell: (r) => r.runId ?? "—" },
  { key: "t", header: "Time", cell: (r) => r.t }
];

export function PvzActivityPage() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 1;
  const rollup = usePvzActivityRollup(playerId);
  const facts = usePvzActivityFacts(playerId);
  const seed = useSeedPvzActivityDemo();
  const spawnExtra = useSpawnExtraIntent();

  const r = rollup.data;

  return (
    <Page
      testId="page-pvz-activity"
      title="PvzActivity"
      description="Player-bound typed play facts + rollups. Progression reads this — not raw events."
      actions={
        <>
          <Button
            data-testid="pvz-activity-seed"
            onClick={() => void seed.mutateAsync(playerId)}
            disabled={seed.isPending}
            title={seed.isPending ? "Seeding…" : undefined}
          >
            Seed demo
          </Button>
          <Button
            data-testid="pvz-activity-spawn-extra"
            onClick={() => void spawnExtra.mutateAsync({ typeId: 0, reason: "luck-demo", playerId })}
            disabled={spawnExtra.isPending}
            title={spawnExtra.isPending ? "Enqueuing…" : undefined}
          >
            Intent: extra spawn
          </Button>
          <Button data-testid="pvz-activity-refresh" onClick={() => void rollup.refetch()}>
            Refresh
          </Button>
        </>
      }
    >
      <Panel title="Rollup" testId="panel-pvz-activity-rollup">
        <HelpText>
          Player {playerId} · revision {r?.revision ?? "—"} · {r?.updatedAt ?? "no rollup yet"}
        </HelpText>
        {!r ? (
          <EmptyState title="No rollup" hint="Seed demo or play a match." />
        ) : (
          <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem 1.5rem", margin: 0 }}>
            <dt>Matches started</dt>
            <dd>{r.matchesStarted}</dd>
            <dt>Matches ended</dt>
            <dd>{r.matchesEnded}</dd>
            <dt>Victories / defeats</dt>
            <dd>
              {r.victories} / {r.defeats}
            </dd>
            <dt>Zombies killed</dt>
            <dd>{r.zombiesKilled}</dd>
            <dt>Plants lost / placed</dt>
            <dd>
              {r.plantsLost} / {r.plantsPlaced}
            </dd>
            <dt>Extra spawns</dt>
            <dd>{r.extraSpawnsFired}</dd>
          </dl>
        )}
      </Panel>
      <Panel title="Facts" testId="panel-pvz-activity-facts">
        {(facts.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No facts" hint="Capture projects Match/Kill/Place; Intent adds ExtraSpawnFired." />
        ) : (
          <DataTable columns={factColumns} rows={facts.data!.items} rowKey={(row) => String(row.id)} />
        )}
      </Panel>
    </Page>
  );
}
