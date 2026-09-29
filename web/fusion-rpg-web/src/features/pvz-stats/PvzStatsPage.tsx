import { useMemo, useState } from "react";
import {
  usePlayers,
  usePvzStatsChannel,
  usePvzStatsSheet,
  useResetPvzStats,
  useSeedPvzStatsDemo,
  useWithdrawPvzStat,
  type PvzStatContribution,
  type PvzStatsChannelSummary
} from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Split } from "@/layouts/Split";
import {
  Button,
  DataTable,
  EmptyState,
  HelpText,
  JsonBlock,
  Panel,
  type DataTableColumn
} from "@/ui";

const channelColumns: DataTableColumn<PvzStatsChannelSummary>[] = [
  { key: "channel", header: "Channel", cell: (r) => r.channel },
  { key: "final", header: "Sheet final", cell: (r) => r.final },
  { key: "sources", header: "Sources", cell: (r) => r.sourceCount }
];

const contribColumns: DataTableColumn<PvzStatContribution>[] = [
  { key: "plugin", header: "Plugin", cell: (r) => r.pluginId },
  { key: "source", header: "Source", cell: (r) => `${r.sourceKind}/${r.sourceId}` },
  { key: "op", header: "Op", cell: (r) => r.op },
  { key: "value", header: "Value", cell: (r) => r.value }
];

function parseDetail(raw?: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function PvzStatsPage() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 1;
  const sheet = usePvzStatsSheet(playerId);
  const [channel, setChannel] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<PvzStatContribution | null>(null);
  const detail = usePvzStatsChannel(playerId, channel);
  const seed = useSeedPvzStatsDemo();
  const reset = useResetPvzStats();
  const withdraw = useWithdrawPvzStat();

  const playerName = useMemo(
    () => players.data?.items.find((p) => p.id === playerId)?.name ?? "?",
    [players.data, playerId]
  );

  return (
    <Page
      testId="page-pvz-stats"
      title="PvzStats"
      description="Player-bound modifier sheet (monitor cache). Not living combat HP — sheet compose at Y0=0."
      actions={
        <>
          <Button
            data-testid="pvz-stats-seed"
            onClick={() => void seed.mutateAsync(playerId)}
            disabled={seed.isPending}
            title={seed.isPending ? "Seeding…" : undefined}
          >
            Seed demo (+10/−5)
          </Button>
          <Button
            data-testid="pvz-stats-reset"
            onClick={() => void reset.mutateAsync(playerId)}
            disabled={reset.isPending}
            title={reset.isPending ? "Resetting…" : undefined}
          >
            Reset
          </Button>
          <Button data-testid="pvz-stats-refresh" onClick={() => void sheet.refetch()}>
            Refresh
          </Button>
        </>
      }
    >
      <Panel title="Sheet" testId="panel-pvz-sheet">
        <HelpText>
          Player {playerId} ({playerName}) · revision {sheet.data?.revision ?? "—"} ·{" "}
          {sheet.data?.updatedAt ?? "no snapshot yet"}
        </HelpText>
        {(sheet.data?.channels.length ?? 0) === 0 ? (
          <EmptyState title="No modified channels" hint="Seed the demo pair or upsert modifiers via API." />
        ) : (
          <DataTable
            columns={channelColumns}
            rows={sheet.data!.channels}
            rowKey={(r) => r.channel}
            onRowClick={(r) => {
              setChannel(r.channel);
              setSelectedSource(null);
            }}
          />
        )}
      </Panel>

      <Split
        list={
          <Panel title={channel ? `Sources · ${channel}` : "Sources"} testId="panel-pvz-sources">
            {!channel ? (
              <EmptyState title="Pick a channel" hint="Click a row in the sheet." />
            ) : (detail.data?.contributions.length ?? 0) === 0 ? (
              <EmptyState title="No contributions" hint="Channel has no enabled modifiers." />
            ) : (
              <>
                <HelpText>
                  Channel final {detail.data?.final ?? "—"} · {detail.data?.contributions.length} source
                  row(s)
                </HelpText>
                <DataTable
                  columns={contribColumns}
                  rows={detail.data!.contributions}
                  rowKey={(r) => `${r.pluginId}|${r.sourceKind}|${r.sourceId}|${r.op}`}
                  onRowClick={(r) => setSelectedSource(r)}
                />
                {selectedSource ? (
                  <div className="mt-2">
                    <Button
                      data-testid="pvz-stats-withdraw"
                      onClick={() =>
                        void withdraw.mutateAsync({
                          playerId,
                          pluginId: selectedSource.pluginId,
                          sourceKind: selectedSource.sourceKind,
                          sourceId: selectedSource.sourceId,
                          channel: selectedSource.channel,
                          op: selectedSource.op
                        })
                      }
                    >
                      Withdraw selected
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        }
        detail={
          <Panel title="Source detail" testId="panel-pvz-detail">
            {!selectedSource ? (
              <EmptyState title="Pick a source" hint="Item deep-links come later; detail_json shows now." />
            ) : (
              <JsonBlock
                value={{
                  pluginId: selectedSource.pluginId,
                  sourceKind: selectedSource.sourceKind,
                  sourceId: selectedSource.sourceId,
                  channel: selectedSource.channel,
                  op: selectedSource.op,
                  value: selectedSource.value,
                  detail: parseDetail(selectedSource.detailJson),
                  itemLink: null
                }}
              />
            )}
          </Panel>
        }
      />
    </Page>
  );
}
