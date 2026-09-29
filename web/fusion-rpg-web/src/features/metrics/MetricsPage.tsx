import { useState } from "react";
import { useMetrics, useRunSpawns, useRuns, type RunItem } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Split } from "@/layouts/Split";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  HelpText,
  JsonBlock,
  KpiStat,
  Panel,
  Row,
  type DataTableColumn
} from "@/ui";

const runColumns: DataTableColumn<RunItem>[] = [
  {
    key: "id",
    header: "Run",
    cell: (row) => `#${row.id}`
  },
  {
    key: "level",
    header: "Level",
    cell: (row) => `${row.levelName ?? "?"} ${row.levelType ?? ""}`
  },
  {
    key: "result",
    header: "Result",
    cell: (row) => (
      <Badge
        tone={
          row.result === "victory" || row.result === "win"
            ? "ok"
            : row.result
              ? "bad"
              : "warn"
        }
      >
        {row.result ?? "open"}
      </Badge>
    )
  },
  {
    key: "plants",
    header: "Plants",
    cell: (row) => `${row.plantsPlanted ?? 0}/${row.plantsDied ?? 0}`
  },
  {
    key: "zombies",
    header: "Zombies",
    cell: (row) => row.zombiesKilled ?? 0
  },
  {
    key: "mowers",
    header: "Mowers",
    cell: (row) => row.mowersUsed ?? 0
  },
  {
    key: "time",
    header: "Started",
    cell: (row) => row.startedUtc
  }
];

export function MetricsPage() {
  const metrics = useMetrics();
  const runs = useRuns();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const spawns = useRunSpawns(selectedRunId);
  const selected = runs.data?.find((r) => r.id === selectedRunId) ?? null;

  return (
    <Page testId="page-runs" title="Runs" description="Global metrics and per-player run history.">
      <Panel title="Metrics" testId="panel-metrics">
        {(metrics.data?.length ?? 0) === 0 ? (
          <EmptyState title="No metrics yet" hint="Play a match or run sim." />
        ) : (
          <ul className="list-disc pl-5 text-sm" data-testid="metrics-list">
            {metrics.data?.map((m) => (
              <li key={m.name}>
                {m.name}: {m.value}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Split
        list={
          <Panel title="Runs (this player)" testId="panel-runs">
            <HelpText>
              Click a run to load spawn_stats dumps. Types HP is not this table.
            </HelpText>
            <DataTable
              columns={runColumns}
              rows={runs.data ?? []}
              rowKey={(row) => String(row.id)}
              onRowClick={(row) => setSelectedRunId(row.id)}
              empty={
                <EmptyState title="No runs yet" hint="Finish a match to see history." className="mt-3" />
              }
            />
          </Panel>
        }
        detail={
          selected ? (
            <Panel
              testId="panel-run-detail"
              title={`Run #${selected.id}`}
              actions={
                <Button
                  data-testid="run-close"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRunId(null)}
                >
                  Close
                </Button>
              }
            >
              <Row className="mb-3 gap-2" data-testid="run-kpis">
                <KpiStat label="Result" value={selected.result ?? "open"} />
                <KpiStat
                  label="Plants"
                  value={`${selected.plantsPlanted ?? 0}/${selected.plantsDied ?? 0}`}
                />
                <KpiStat label="Zombies" value={selected.zombiesKilled ?? 0} />
                <KpiStat label="Mowers" value={selected.mowersUsed ?? 0} />
              </Row>
              <HelpText className="mb-2">Spawn dumps (combat SSOT)</HelpText>
              <JsonBlock value={spawns.data ?? []} />
            </Panel>
          ) : (
            <Panel title="Inspector" testId="panel-run-inspector">
              <EmptyState title="Select a run" hint="Click a row to inspect spawn dumps." />
            </Panel>
          )
        }
      />
    </Page>
  );
}
