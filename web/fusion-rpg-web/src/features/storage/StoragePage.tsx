import { useMemo, useState } from "react";
import {
  useDeleteArchives,
  useDeleteClosedRuns,
  usePurgeRunCapture,
  useRuns,
  useStorageArchives,
  useStorageSummary,
  useTrimHotTails,
  type RunItem,
  type StorageArchiveItem
} from "@/lib/bus";
import { Page } from "@/layouts/Page";
import {
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  HelpText,
  KeyValue,
  Panel,
  Row,
  type DataTableColumn
} from "@/ui";

function formatResult(deleted: number, refused: number) {
  return `Deleted ${deleted}${refused > 0 ? `, refused ${refused}` : ""}.`;
}

type PendingConfirm =
  | { kind: "delete-archives"; count: number }
  | { kind: "purge-capture"; count: number }
  | { kind: "delete-runs"; count: number }
  | { kind: "trim-tails" };

export function StoragePage() {
  const summary = useStorageSummary();
  const archives = useStorageArchives();
  const runs = useRuns();
  const deleteArchives = useDeleteArchives();
  const purgeCapture = usePurgeRunCapture();
  const deleteRuns = useDeleteClosedRuns();
  const trimTails = useTrimHotTails();

  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const closedRuns = useMemo(
    () => (runs.data ?? []).filter((r) => !!r.endedUtc),
    [runs.data]
  );

  const archiveColumns: DataTableColumn<StorageArchiveItem>[] = [
    {
      key: "sel",
      header: "",
      cell: (row) => (
        <input
          type="checkbox"
          className="accent-lawn"
          aria-label={`Select archive ${row.uri}`}
          checked={selectedUris.has(row.uri)}
          onChange={(e) => {
            setSelectedUris((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(row.uri);
              else next.delete(row.uri);
              return next;
            });
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    { key: "uri", header: "URI", cell: (row) => row.uri },
    { key: "kind", header: "Kind", cell: (row) => row.kind },
    {
      key: "run",
      header: "Run",
      cell: (row) => (row.runId != null ? `#${row.runId}` : "—")
    },
    { key: "created", header: "Created", cell: (row) => row.createdUtc }
  ];

  const runColumns: DataTableColumn<RunItem>[] = [
    {
      key: "sel",
      header: "",
      cell: (row) => (
        <input
          type="checkbox"
          className="accent-lawn"
          aria-label={`Select run ${row.id}`}
          checked={selectedRunIds.has(row.id)}
          onChange={(e) => {
            setSelectedRunIds((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(row.id);
              else next.delete(row.id);
              return next;
            });
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    { key: "id", header: "Run", cell: (row) => `#${row.id}` },
    {
      key: "level",
      header: "Level",
      cell: (row) => row.levelName ?? "?"
    },
    { key: "ended", header: "Ended", cell: (row) => row.endedUtc ?? "—" },
    {
      key: "archive",
      header: "Archive",
      cell: (row) => row.archiveUri ?? "hot"
    },
    {
      key: "result",
      header: "Result",
      cell: (row) => row.result ?? "—"
    }
  ];

  const busy =
    deleteArchives.isPending ||
    purgeCapture.isPending ||
    deleteRuns.isPending ||
    trimTails.isPending;

  const dialogCopy = (() => {
    if (!pendingConfirm) return null;
    switch (pendingConfirm.kind) {
      case "delete-archives":
        return {
          title: "Delete archives?",
          message: `Delete ${pendingConfirm.count} cold archive(s)? This cannot be undone.`,
          confirmLabel: "Delete",
          tone: "danger" as const
        };
      case "purge-capture":
        return {
          title: "Purge capture?",
          message: `Purge hot capture for ${pendingConfirm.count} closed run(s)? Run rows and archives stay.`,
          confirmLabel: "Purge",
          tone: "primary" as const
        };
      case "delete-runs":
        return {
          title: "Delete runs?",
          message: `Delete ${pendingConfirm.count} closed run(s) and their hot capture? Open runs are refused.`,
          confirmLabel: "Delete",
          tone: "danger" as const
        };
      case "trim-tails":
        return {
          title: "Trim tails?",
          message:
            "Trim activity/XP ledgers to sealed hot-tail limits now? This is user-triggered only.",
          confirmLabel: "Trim now",
          tone: "primary" as const
        };
    }
  })();

  async function runPendingConfirm() {
    if (!pendingConfirm) return;
    setError(null);
    setMessage(null);
    try {
      switch (pendingConfirm.kind) {
        case "delete-archives": {
          const uris = [...selectedUris];
          const r = await deleteArchives.mutateAsync(uris);
          setSelectedUris(new Set());
          setMessage(formatResult(r.deleted, r.refused));
          break;
        }
        case "purge-capture": {
          const ids = [...selectedRunIds];
          const r = await purgeCapture.mutateAsync(ids);
          setSelectedRunIds(new Set());
          setMessage(formatResult(r.deleted, r.refused));
          break;
        }
        case "delete-runs": {
          const ids = [...selectedRunIds];
          const r = await deleteRuns.mutateAsync(ids);
          setSelectedRunIds(new Set());
          setMessage(formatResult(r.deleted, r.refused));
          break;
        }
        case "trim-tails": {
          await trimTails.mutateAsync();
          setMessage("Trimmed activity/XP tails to sealed limits.");
          break;
        }
      }
      setPendingConfirm(null);
    } catch (e) {
      setMessage(null);
      setError(e instanceof Error ? e.message : String(e));
      setPendingConfirm(null);
    }
  }

  const s = summary.data;

  return (
    <Page
      testId="page-storage"
      title="Storage"
      description="User-driven clear of cold archives and closed-run capture. No automatic GC."
      actions={
        <Button
          data-testid="storage-refresh"
          onClick={() => {
            void summary.refetch();
            void archives.refetch();
            void runs.refetch();
          }}
        >
          Refresh
        </Button>
      }
    >
      {message ? (
        <Banner tone="info" data-testid="storage-message">
          {message}
        </Banner>
      ) : null}
      {error ? (
        <Banner tone="error" data-testid="storage-error">
          {error}
        </Banner>
      ) : null}

      <Panel title="Summary" testId="panel-storage-summary">
        <KeyValue
          items={[
            { label: "Archives", value: String(s?.archiveCount ?? "—") },
            { label: "Closed runs still hot", value: String(s?.closedRunsStillHot ?? "—") },
            { label: "Open runs", value: String(s?.openRuns ?? "—") },
            {
              label: "Activity over tail",
              value: s == null ? "—" : s.activityOverTail ? "yes" : "no"
            },
            {
              label: "XP over tail",
              value: s == null ? "—" : s.xpOverTail ? "yes" : "no"
            }
          ]}
        />
        <HelpText>
          Open runs are never deleted. Background archive GC is off — clear only what you select.
        </HelpText>
      </Panel>

      <Panel
        title="Compacted archives"
        testId="panel-storage-archives"
        actions={
          <Button
            data-testid="storage-delete-archives"
            size="sm"
            disabled={busy || selectedUris.size === 0}
            title={busy ? "Working…" : selectedUris.size === 0 ? "Select an archive first" : undefined}
            onClick={() =>
              setPendingConfirm({ kind: "delete-archives", count: selectedUris.size })
            }
          >
            Delete selected
          </Button>
        }
      >
        <DataTable
          columns={archiveColumns}
          rows={archives.data ?? []}
          rowKey={(row) => row.uri}
          empty={<EmptyState title="No compacted archives" hint="Closed runs archive after compact." />}
        />
      </Panel>

      <Panel
        title="Closed runs"
        testId="panel-storage-runs"
        actions={
          <Row className="gap-2">
            <Button
              data-testid="storage-purge-capture"
              size="sm"
              disabled={busy || selectedRunIds.size === 0}
              title={busy ? "Working…" : selectedRunIds.size === 0 ? "Select a run first" : undefined}
              onClick={() =>
                setPendingConfirm({ kind: "purge-capture", count: selectedRunIds.size })
              }
            >
              Purge capture
            </Button>
            <Button
              data-testid="storage-delete-runs"
              size="sm"
              variant="danger"
              disabled={busy || selectedRunIds.size === 0}
              title={busy ? "Working…" : selectedRunIds.size === 0 ? "Select a run first" : undefined}
              onClick={() =>
                setPendingConfirm({ kind: "delete-runs", count: selectedRunIds.size })
              }
            >
              Delete run
            </Button>
          </Row>
        }
      >
        <HelpText>Only closed runs (`endedUtc` set). Open runs are refused by the API.</HelpText>
        <DataTable
          columns={runColumns}
          rows={closedRuns}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState title="No closed runs" hint="Finish a match to list history." />}
        />
      </Panel>

      <Panel title="Trim tails" testId="panel-storage-trim">
        <HelpText>
          Calls the existing post-run compactor for activity/XP retain tails. User-triggered only —
          not scheduled.
        </HelpText>
        <Button
          data-testid="storage-trim-tails"
          disabled={busy}
          title={busy ? "Working…" : undefined}
          onClick={() => setPendingConfirm({ kind: "trim-tails" })}
        >
          Trim activity/XP to sealed limits now
        </Button>
      </Panel>

      {dialogCopy ? (
        <ConfirmDialog
          open={pendingConfirm != null}
          title={dialogCopy.title}
          message={dialogCopy.message}
          confirmLabel={dialogCopy.confirmLabel}
          tone={dialogCopy.tone}
          busy={busy}
          testId="storage-confirm"
          onCancel={() => {
            if (!busy) setPendingConfirm(null);
          }}
          onConfirm={() => void runPendingConfirm()}
        />
      ) : null}
    </Page>
  );
}
