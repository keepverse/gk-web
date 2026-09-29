import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClearRpgDemotion,
  usePlayers,
  useRpgProgressionActor,
  useRpgProgressionActors,
  useRpgProgressionLedger,
  useRpgProgressionStats,
  useRpgProgressionSummary,
  useSeedRpgProgressionDemo,
  type RpgActorProgression,
  type RpgXpLedgerEntry
} from "@/lib/bus";
import { foldActorLedger } from "./actorProgressionFold";
import { stripTmpRichText } from "@/lib/almanacText";
import { Page } from "@/layouts/Page";
import { Split } from "@/layouts/Split";
import {
  Badge,
  BarChart,
  Button,
  DataTable,
  DivergingBar,
  EmptyState,
  HelpText,
  KeyValue,
  KpiStat,
  Pager,
  Panel,
  Row,
  Select,
  Sparkline,
  StatBar,
  TabList,
  TypeIcon,
  type DataTableColumn
} from "@/ui";

/** Ledger deltas per event are bounded in practice (a single kill/spawn/run award); values past
 * this just clamp at the bar's edge rather than needing a per-render dynamic scale. */
const LEDGER_DELTA_SCALE = 500;

type TabId = "overview" | "plants" | "zombies" | "ledger";
type SelectedActor = { kind: string; typeId: number };

function actorLabel(a: RpgActorProgression) {
  return a.displayName || a.typeName || (a.kind === "player" ? "Player" : `${a.kind} #${a.typeId}`);
}

function reasonTone(reason: string): "sun" | "lawn" | "zombie" | "bad" | "ok" {
  if (reason === "kill") return "ok";
  if (reason === "defeat" || reason === "mower") return "bad";
  if (reason === "plant_place") return "lawn";
  if (reason === "zombie_spawn") return "zombie";
  return "sun";
}

const actorColumns: DataTableColumn<RpgActorProgression>[] = [
  {
    key: "icon",
    header: "",
    cell: (r) =>
      r.kind === "plant" || r.kind === "zombie" ? (
        <TypeIcon side={r.kind} typeId={r.typeId} size={36} testId={`type-icon-${r.kind}-${r.typeId}`} />
      ) : null
  },
  { key: "name", header: "Name", cell: (r) => actorLabel(r) },
  { key: "type", header: "Type", cell: (r) => String(r.typeId) },
  { key: "level", header: "Level", cell: (r) => String(r.level) },
  { key: "high", header: "Peak", cell: (r) => String(r.highestLevel) },
  {
    key: "xp",
    header: "XP",
    cell: (r) => `${r.xp.toFixed(0)} / ${r.xpToNext.toFixed(0)}`
  },
  { key: "demote", header: "Demotion", cell: (r) => String(r.demotionCount) },
  { key: "updated", header: "Updated", cell: (r) => r.updatedAt || "—" }
];

const ledgerColumns: DataTableColumn<RpgXpLedgerEntry>[] = [
  { key: "t", header: "Time", cell: (r) => r.t },
  { key: "actor", header: "Actor", cell: (r) => `${r.kind}/${r.typeName ?? r.typeId}` },
  { key: "reason", header: "Reason", cell: (r) => r.reason },
  {
    key: "delta",
    header: "Δ",
    cell: (r) => (
      <div className="flex min-w-24 items-center gap-2">
        <span className="tabular-nums">{r.delta >= 0 ? `+${r.delta}` : String(r.delta)}</span>
        <DivergingBar testId={`ledger-delta-${r.id}`} value={r.delta} scaleMax={LEDGER_DELTA_SCALE} className="w-16" />
      </div>
    )
  },
  { key: "level", header: "Level", cell: (r) => `${r.levelBefore}→${r.levelAfter}` },
  { key: "xp", header: "XP", cell: (r) => `${r.xpBefore.toFixed(0)}→${r.xpAfter.toFixed(0)}` },
  { key: "run", header: "Run", cell: (r) => String(r.runId) },
  {
    key: "payload",
    header: "Payload",
    cell: (r) => (r.payloadJson ? <span className="font-mono text-xs">{r.payloadJson}</span> : "—")
  }
];

function ActorDossier({
  playerId,
  selected,
  onClear
}: {
  playerId: number;
  selected: SelectedActor;
  onClear?: () => void;
}) {
  const actor = useRpgProgressionActor(playerId, selected.kind, selected.typeId);
  const ledger = useRpgProgressionLedger(playerId, {
    kind: selected.kind,
    typeId: selected.typeId,
    limit: 25
  });
  const clearDemotion = useClearRpgDemotion();
  const row = actor.data;

  const reasonBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of ledger.data?.items ?? []) {
      map.set(e.reason, (map.get(e.reason) ?? 0) + e.delta);
    }
    return [...map.entries()].map(([label, value]) => ({
      label,
      value,
      tone: reasonTone(label)
    }));
  }, [ledger.data]);

  if (actor.isLoading && !row) {
    return (
      <Panel title="Actor dossier" testId="progression-actor-panel">
        <HelpText data-testid="progression-actor-loading">Loading actor…</HelpText>
        {onClear ? (
          <Button data-testid="progression-actor-close" size="sm" variant="ghost" onClick={onClear}>
            Close
          </Button>
        ) : null}
      </Panel>
    );
  }

  if (!row) {
    return (
      <Panel title="Actor dossier" testId="progression-actor-panel">
        <EmptyState title="Actor missing" hint="No progression row for this type yet." />
        {onClear ? (
          <Button data-testid="progression-actor-close" size="sm" variant="ghost" onClick={onClear}>
            Close
          </Button>
        ) : null}
      </Panel>
    );
  }

  const xpPct = row.xpToNext > 0 ? Math.min(100, Math.round((row.xp / row.xpToNext) * 100)) : 0;
  const infoText = stripTmpRichText(row.almanacInfo);
  const introduceText = stripTmpRichText(row.almanacIntroduce);
  const costText = stripTmpRichText(row.almanacCost);
  const hasAlmanac = Boolean(infoText || introduceText || costText);

  return (
    <Panel
      title={actorLabel(row)}
      testId="progression-actor-panel"
      actions={
        onClear ? (
          <Button data-testid="progression-actor-close" size="sm" variant="ghost" onClick={onClear}>
            Close
          </Button>
        ) : null
      }
    >
      {(row.kind === "plant" || row.kind === "zombie") && (
        <div className="mb-3">
          <TypeIcon side={row.kind} typeId={row.typeId} size={72} testId="progression-actor-icon" />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Level</div>
          <div className="font-display text-4xl text-sun">L{row.level}</div>
        </div>
        <Badge tone={row.demotionCount > 0 ? "warn" : "ok"}>demotion {row.demotionCount}</Badge>
        <HelpText>
          Peak L{row.highestLevel} · rev {row.revision} · curve {row.curveFirst}/{row.curveStep}
        </HelpText>
      </div>
      <StatBar label={`XP ${xpPct}%`} value={row.xp} max={Math.max(row.xpToNext, 1)} />
      <KeyValue
        className="mt-3"
        items={[
          { label: "Kind", value: row.kind },
          { label: "Type id", value: String(row.typeId) },
          { label: "Type name", value: row.typeName ?? "—" },
          { label: "Highest", value: String(row.highestLevel) },
          { label: "Updated", value: row.updatedAt || "—" }
        ]}
      />
      {hasAlmanac ? (
        <div className="mt-4 space-y-3" data-testid="progression-actor-almanac">
          {infoText ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Info</div>
              <p
                className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"
                data-testid="progression-actor-almanac-info"
              >
                {infoText}
              </p>
            </div>
          ) : null}
          {introduceText ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Introduce</div>
              <p
                className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted"
                data-testid="progression-actor-almanac-introduce"
              >
                {introduceText}
              </p>
            </div>
          ) : null}
          {costText ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Cost</div>
              <p
                className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"
                data-testid="progression-actor-almanac-cost"
              >
                {costText}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <Button
        className="mt-3"
        data-testid="progression-actor-clear-demotion"
        size="sm"
        disabled={clearDemotion.isPending || row.demotionCount === 0}
        title={clearDemotion.isPending ? "Clearing…" : row.demotionCount === 0 ? "No demotions to clear" : undefined}
        onClick={() =>
          void clearDemotion.mutateAsync({
            playerId,
            kind: selected.kind,
            typeId: selected.typeId
          })
        }
      >
        Clear demotion
      </Button>
      <div className="mt-4">
        <HelpText>Reason mix (this page)</HelpText>
        <BarChart testId="progression-actor-reason-chart" items={reasonBars} />
      </div>
      <Panel title="Actor ledger" testId="progression-actor-ledger" className="mt-3">
        {foldActorLedger(ledger.data?.items ?? []).length === 0 ? (
          <EmptyState title="No ledger for actor" />
        ) : (
          <DataTable columns={ledgerColumns} rows={foldActorLedger(ledger.data!.items)} rowKey={(r) => String(r.id)} />
        )}
      </Panel>
    </Panel>
  );
}

function KindBrowser({
  playerId,
  kind,
  selected,
  onSelect
}: {
  playerId: number;
  kind: "plant" | "zombie";
  selected: SelectedActor | null;
  onSelect: (s: SelectedActor | null) => void;
}) {
  const [sort, setSort] = useState<"level" | "xp" | "updated" | "typeId">("level");
  const [pageSize, setPageSize] = useState(25);
  const [offset, setOffset] = useState(0);
  const list = useRpgProgressionActors(playerId, kind, sort, pageSize, offset);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <Split
      list={
        <Panel title={kind === "plant" ? "Plant types" : "Zombie types"} testId={`progression-${kind}s`}>
          <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="progression-sort">
            <HelpText>Sort</HelpText>
            <Select
              data-testid="progression-sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setOffset(0);
              }}
            >
              <option value="level">level</option>
              <option value="xp">xp</option>
              <option value="updated">updated</option>
              <option value="typeId">Type</option>
            </Select>
            <HelpText>Page</HelpText>
            <Select
              data-testid="progression-page-size"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setOffset(0);
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
          {rows.length === 0 ? (
            <EmptyState title={`No ${kind}s`} hint="Play or seed demo to earn type XP." />
          ) : (
            <DataTable
              columns={actorColumns}
              rows={rows}
              rowKey={(r) => `${kind}-${r.typeId}`}
              onRowClick={(r) => onSelect({ kind: r.kind, typeId: r.typeId })}
            />
          )}
          <Pager
            testId={`progression-${kind}-pager`}
            label={`${Math.min(offset + 1, total)}–${Math.min(offset + rows.length, total)} of ${total}`}
            canPrev={offset > 0}
            canNext={offset + pageSize < total}
            onPrev={() => setOffset((o) => Math.max(0, o - pageSize))}
            onNext={() => setOffset((o) => o + pageSize)}
          />
        </Panel>
      }
      detail={
        selected && selected.kind === kind ? (
          <ActorDossier playerId={playerId} selected={selected} onClear={() => onSelect(null)} />
        ) : (
          <Panel title="Select a type" testId="progression-actor-placeholder">
            <EmptyState title="Pick a row" hint="Click a plant or zombie type for the full dossier." />
          </Panel>
        )
      }
    />
  );
}

export function RpgProgressionPage() {
  const qc = useQueryClient();
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 1;
  const [tab, setTab] = useState<TabId>("overview");
  const [selected, setSelected] = useState<SelectedActor | null>(null);
  const [ledgerKind, setLedgerKind] = useState("");
  const [ledgerReason, setLedgerReason] = useState("");
  const [ledgerTypeId, setLedgerTypeId] = useState("");
  const [ledgerAfterId, setLedgerAfterId] = useState<number | undefined>(undefined);
  const [ledgerStack, setLedgerStack] = useState<(number | undefined)[]>([undefined]);

  const summary = useRpgProgressionSummary(playerId);
  const stats = useRpgProgressionStats(playerId);
  const seed = useSeedRpgProgressionDemo();
  const clearDemotion = useClearRpgDemotion();
  const playerActor = summary.data?.player;

  const ledgerTypeIdNum = (() => {
    if (ledgerTypeId.trim() === "") return undefined;
    const n = Number(ledgerTypeId);
    return Number.isFinite(n) ? n : undefined;
  })();
  const ledger = useRpgProgressionLedger(playerId, {
    kind: ledgerKind || undefined,
    reason: ledgerReason || undefined,
    typeId: ledgerTypeIdNum,
    limit: 40,
    afterId: ledgerAfterId,
    enabled: tab === "ledger"
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["rpgProgressionSummary"] });
    void qc.invalidateQueries({ queryKey: ["rpgProgressionStats"] });
    void qc.invalidateQueries({ queryKey: ["rpgProgressionActors"] });
    void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger"] });
    void qc.invalidateQueries({ queryKey: ["rpgProgressionActor"] });
  };

  const xpPct =
    playerActor && playerActor.xpToNext > 0
      ? Math.min(100, Math.round((playerActor.xp / playerActor.xpToNext) * 100))
      : 0;

  const reasonBars = (stats.data?.xpByReason ?? []).map((r) => ({
    label: r.reason,
    value: r.sumDelta,
    tone: reasonTone(r.reason)
  }));
  const plantBars = (stats.data?.plantLevels ?? []).map((b) => ({
    label: `L${b.level}`,
    value: b.count,
    tone: "lawn" as const
  }));
  const zombieBars = (stats.data?.zombieLevels ?? []).map((b) => ({
    label: `L${b.level}`,
    value: b.count,
    tone: "zombie" as const
  }));
  const sparkValues = [...(stats.data?.recentDeltas ?? [])].reverse().map((d) => d.delta);

  const openTop = (a: RpgActorProgression) => {
    setSelected({ kind: a.kind, typeId: a.typeId });
    setTab(a.kind === "zombie" ? "zombies" : "plants");
  };

  return (
    <Page
      testId="page-rpg-progression"
      title="Progression"
      description="Per-save actor XP for player, plant types, and zombie types. Kill XP is reserved for power-scale (×1 today)."
      actions={
        <>
          <Button
            data-testid="rpg-progression-seed"
            onClick={() => void seed.mutateAsync(playerId)}
            disabled={seed.isPending}
            title={seed.isPending ? "Seeding…" : undefined}
          >
            Seed demo
          </Button>
          <Button data-testid="rpg-progression-refresh" onClick={refreshAll}>
            Refresh
          </Button>
        </>
      }
    >
      <TabList
        testId="progression-tabs"
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: "overview", label: "Overview", testId: "progression-tab-overview" },
          { id: "plants", label: "Plants", testId: "progression-tab-plants" },
          { id: "zombies", label: "Zombies", testId: "progression-tab-zombies" },
          { id: "ledger", label: "Ledger", testId: "progression-tab-ledger" }
        ]}
      />

      {tab === "overview" && (
        <>
          <Panel title="Player dossier" testId="progression-player-hero">
            {!playerActor ? (
              <EmptyState title="No player progression" hint="Play a match or seed demo." />
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted">Save {playerId}</div>
                    <div className="font-display text-5xl leading-none text-sun">L{playerActor.level}</div>
                  </div>
                  <Badge tone={playerActor.demotionCount > 0 ? "warn" : "ok"}>
                    demotion {playerActor.demotionCount}
                  </Badge>
                  <HelpText>
                    Peak L{playerActor.highestLevel} · rev {playerActor.revision} · curve{" "}
                    {playerActor.curveFirst}/{playerActor.curveStep}
                  </HelpText>
                </div>
                <StatBar
                  className="mt-4 max-w-xl"
                  label={`XP to next (${xpPct}%)`}
                  value={playerActor.xp}
                  max={Math.max(playerActor.xpToNext, 1)}
                />
                <Button
                  className="mt-3"
                  data-testid="progression-clear-demotion"
                  size="sm"
                  disabled={clearDemotion.isPending || playerActor.demotionCount === 0}
                  title={
                    clearDemotion.isPending
                      ? "Clearing…"
                      : playerActor.demotionCount === 0
                        ? "No demotions to clear"
                        : undefined
                  }
                  onClick={() =>
                    void clearDemotion.mutateAsync({ playerId, kind: "player", typeId: 0 })
                  }
                >
                  Clear demotion
                </Button>
              </>
            )}
          </Panel>

          <Panel title="Snapshot" testId="progression-kpis">
            <Row className="flex-wrap gap-3">
              <KpiStat label="Player L" value={playerActor?.level ?? 1} />
              <KpiStat label="XP %" value={`${xpPct}%`} />
              <KpiStat label="Demotion" value={playerActor?.demotionCount ?? 0} />
              <KpiStat label="Plants" value={summary.data?.plantActorCount ?? 0} />
              <KpiStat label="Zombies" value={summary.data?.zombieActorCount ?? 0} />
              <KpiStat label="Peak plant" value={summary.data?.highestPlantLevel ?? 0} />
              <KpiStat label="Peak zombie" value={summary.data?.highestZombieLevel ?? 0} />
            </Row>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="XP by reason" testId="progression-chart-reason">
              <BarChart items={reasonBars} emptyLabel="No ledger awards yet." />
            </Panel>
            <Panel title="Recent XP" testId="progression-chart-spark">
              <Sparkline values={sparkValues} />
            </Panel>
            <Panel title="Plant levels" testId="progression-chart-plants">
              <BarChart items={plantBars} emptyLabel="No plant actors yet." />
            </Panel>
            <Panel title="Zombie levels" testId="progression-chart-zombies">
              <BarChart items={zombieBars} emptyLabel="No zombie actors yet." />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top plants" testId="progression-top-plants">
              {(summary.data?.topPlants.length ?? 0) === 0 ? (
                <EmptyState title="No plant actors" />
              ) : (
                <DataTable
                  columns={actorColumns}
                  rows={summary.data!.topPlants}
                  rowKey={(r) => `top-p-${r.typeId}`}
                  onRowClick={openTop}
                />
              )}
            </Panel>
            <Panel title="Top zombies" testId="progression-top-zombies">
              {(summary.data?.topZombies.length ?? 0) === 0 ? (
                <EmptyState title="No zombie actors" />
              ) : (
                <DataTable
                  columns={actorColumns}
                  rows={summary.data!.topZombies}
                  rowKey={(r) => `top-z-${r.typeId}`}
                  onRowClick={openTop}
                />
              )}
            </Panel>
          </div>
        </>
      )}

      {tab === "plants" && (
        <KindBrowser playerId={playerId} kind="plant" selected={selected} onSelect={setSelected} />
      )}
      {tab === "zombies" && (
        <KindBrowser playerId={playerId} kind="zombie" selected={selected} onSelect={setSelected} />
      )}

      {tab === "ledger" && (
        <Split
          list={
            <Panel title="XP ledger" testId="progression-advanced-ledger">
              <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="progression-ledger-filters">
                <Select
                  data-testid="ledger-filter-kind"
                  value={ledgerKind}
                  onChange={(e) => {
                    setLedgerKind(e.target.value);
                    setLedgerAfterId(undefined);
                    setLedgerStack([undefined]);
                  }}
                >
                  <option value="">all kinds</option>
                  <option value="player">player</option>
                  <option value="plant">plant</option>
                  <option value="zombie">zombie</option>
                </Select>
                <Select
                  data-testid="ledger-filter-reason"
                  value={ledgerReason}
                  onChange={(e) => {
                    setLedgerReason(e.target.value);
                    setLedgerAfterId(undefined);
                    setLedgerStack([undefined]);
                  }}
                >
                  <option value="">all reasons</option>
                  <option value="kill">kill</option>
                  <option value="defeat">defeat</option>
                  <option value="mower">mower</option>
                  <option value="plant_place">plant_place</option>
                  <option value="zombie_spawn">zombie_spawn</option>
                </Select>
                <input
                  data-testid="ledger-filter-typeid"
                  className="rounded-sm border border-border bg-soil px-2 py-1.5 text-sm"
                  placeholder="Type"
                  value={ledgerTypeId}
                  onChange={(e) => {
                    setLedgerTypeId(e.target.value);
                    setLedgerAfterId(undefined);
                    setLedgerStack([undefined]);
                  }}
                />
              </div>
              {foldActorLedger(ledger.data?.items ?? []).length === 0 ? (
                <EmptyState title="No ledger rows" hint="Awards appear after capture." />
              ) : (
                <DataTable
                  columns={ledgerColumns}
                  rows={foldActorLedger(ledger.data!.items)}
                  rowKey={(r) => String(r.id)}
                  onRowClick={(r) => {
                    if (r.kind === "plant" || r.kind === "zombie") {
                      setSelected({ kind: r.kind, typeId: r.typeId });
                      setTab(r.kind === "plant" ? "plants" : "zombies");
                    }
                  }}
                />
              )}
              <Pager
                testId="progression-ledger-pager"
                label={`${foldActorLedger(ledger.data?.items ?? []).length} rows`}
                canPrev={ledgerStack.length > 1}
                canNext={ledger.data?.nextAfterId != null}
                onPrev={() => {
                  const next = ledgerStack.slice(0, -1);
                  setLedgerStack(next);
                  setLedgerAfterId(next[next.length - 1]);
                }}
                onNext={() => {
                  const nextId = ledger.data?.nextAfterId;
                  if (nextId == null) return;
                  setLedgerStack((s) => [...s, nextId]);
                  setLedgerAfterId(nextId);
                }}
              />
            </Panel>
          }
          detail={
            selected ? (
              <ActorDossier playerId={playerId} selected={selected} onClear={() => setSelected(null)} />
            ) : (
              <Panel title="Actor" testId="progression-ledger-detail-empty">
                <EmptyState title="Optional detail" hint="Click a plant/zombie ledger row to open its dossier." />
              </Panel>
            )
          }
        />
      )}
    </Page>
  );
}
