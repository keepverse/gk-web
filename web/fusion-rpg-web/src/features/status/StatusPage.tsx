import { useSyncExternalStore } from "react";
import {
  apiBase,
  getLogEvents,
  subscribeLog,
  useHealth,
  usePlayers
} from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Button, JsonBlock, KeyValue, Panel } from "@/ui";

function useLastEconomy() {
  const events = useSyncExternalStore(subscribeLog, getLogEvents, getLogEvents);
  return events.find((e) => e.kind === "board.economy")?.payload ?? "none";
}

export function StatusPage() {
  const health = useHealth();
  const players = usePlayers();
  const economy = useLastEconomy();
  const currentId = players.data?.currentPlayerId ?? health.data?.currentPlayerId ?? 1;
  const name = players.data?.items.find((p) => p.id === currentId)?.name ?? "?";

  return (
    <Page
      testId="page-status"
      title="Status"
      description="Server health, injector link, and last economy snapshot."
      actions={
        <Button data-testid="status-refresh" onClick={() => void health.refetch()}>
          Refresh
        </Button>
      }
    >
      <Panel title="Connection" testId="panel-connection">
        <KeyValue
          items={[
            {
              label: "API",
              value: apiBase() || window.location.origin
            },
            {
              label: "Source",
              value: `${health.data?.source ?? "none"}${health.data?.simEnabled ? " (sim routes on)" : ""}`
            },
            {
              label: "Current player",
              value: `${currentId} (${name})`
            },
            {
              label: "Last heartbeat",
              value: health.data?.lastHeartbeatUtc ?? "none"
            },
            {
              label: "Ingest queue",
              value: `${health.data?.ingestQueued ?? 0} · last flush ${health.data?.lastFlushMs ?? 0} ms`
            }
          ]}
        />
      </Panel>
      <Panel
        title="Last economy"
        description="From live event log (board.economy)."
        testId="panel-economy"
      >
        <JsonBlock value={economy} />
      </Panel>
      <Panel testId="panel-help">
        <p className="text-sm text-muted">
          Open this page from the RPG server. Players only need the EXE — this UI is bundled.
        </p>
      </Panel>
    </Page>
  );
}
