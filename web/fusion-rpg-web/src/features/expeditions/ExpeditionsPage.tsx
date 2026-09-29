import { useEffect, useMemo, useState } from "react";
import { usePlayers } from "@/lib/bus";
import { newCorrelationId, useCreatureRoster, useSpeciesIndex } from "@/lib/bus/creatures";
import {
  useCollectExpedition,
  useCreatureMaterials,
  useDispatchExpedition,
  useExpeditions,
  type ExpeditionCollectDto,
  type ExpeditionRowDto,
  type ExpeditionTierDto
} from "@/lib/bus/expeditions";
import { Page } from "@/layouts/Page";
import { Badge, Banner, Button, EmptyState, Panel, TypeIcon } from "@/ui";
import { cn } from "@/lib/cn";
import { expeditionProgress, formatRemaining } from "./expeditionTime";
import { useContracts } from "@/lib/bus/contracts";
import { conditionOf, contractIndex, fieldingBlockReason } from "../creatures/contractView";

/**
 * Expeditions (spec-expeditions.md): dispatch from the Active roster with tier slot gating,
 * live due timers, collect reveal battle-by-battle with event cards, materials shelf.
 */
export function ExpeditionsPage() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const speciesById = useSpeciesIndex();
  const roster = useCreatureRoster(playerId);
  // Contracts gate dispatch server-side; showing the same rule here means the refusal never
  // arrives as a surprise error banner.
  const contractRows = contractIndex(useContracts(playerId).data);
  const expeditions = useExpeditions(playerId);
  const materials = useCreatureMaterials(playerId);
  const dispatch = useDispatchExpedition();
  const collect = useCollectExpedition();

  const [tierId, setTierId] = useState<string>("scout-30m");
  const [squad, setSquad] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<ExpeditionCollectDto | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const tiers = expeditions.data?.tiers ?? [];
  const tier = tiers.find((t) => t.tierId === tierId) ?? tiers[0];
  const items = expeditions.data?.items ?? [];
  const active = items.filter((e) => e.state === "Dispatched");
  const history = items.filter((e) => e.state !== "Dispatched").slice(0, 8);

  // The 1s clock exists only for countdown rows — don't re-render an idle page every second.
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  const rosterById = useMemo(
    () => new Map((roster.data?.items ?? []).map((s) => [s.profile.instanceId, s])),
    [roster.data]
  );

  const returnedCount = useMemo(
    () =>
      active.filter((e) => {
        const t = tiers.find((x) => x.tierId === e.tierId);
        return t ? expeditionProgress(e.dispatchedUtc, e.dueUtc, t.tickMinutes, t.tickCount, nowMs).due : false;
      }).length,
    [active, tiers, nowMs]
  );

  const lockedIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of expeditions.data?.items ?? [])
      if (e.state === "Dispatched") for (const id of e.squadInstanceIds) set.add(id);
    return set;
  }, [expeditions.data]);

  function toggle(instanceId: string) {
    setSquad((prev) =>
      prev.includes(instanceId)
        ? prev.filter((x) => x !== instanceId)
        : prev.length < (tier?.squadSlots ?? 0)
          ? [...prev, instanceId]
          : prev
    );
  }

  async function sendDispatch() {
    if (!tier || squad.length === 0) return;
    setError(null);
    try {
      await dispatch.mutateAsync({ playerId, correlationId: newCorrelationId(), tierId: tier.tierId, squad });
      setSquad([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function sendCollect(expedition: ExpeditionRowDto, recall: boolean) {
    setError(null);
    try {
      const result = await collect.mutateAsync({ expeditionId: expedition.id, playerId, recall });
      setReveal(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // T30 (plate 03 §C): an icon-framed card per expedition — status pill, a real progress meter with
  // its %, and roster chips for the real squad (`squadInstanceIds` is real; `roster.data` resolves
  // each into a species/nickname the same way the Dispatch picker already does below). The plate's
  // card also shows a reward chip row (items/XP/souls) on the *returned* card, before it's
  // collected — `ExpeditionRowDto` carries no reward preview at all (rewards roll server-side at
  // collect time, in `ExpeditionCollectDto`), so that row would be fabricated here. It's real on the
  // `reveal` panel below, right after a real collect — this card stays honest and omits it.
  function activeRow(e: ExpeditionRowDto) {
    const t = tiers.find((x) => x.tierId === e.tierId);
    const p = t
      ? expeditionProgress(e.dispatchedUtc, e.dueUtc, t.tickMinutes, t.tickCount, nowMs)
      : null;
    const isReady = p?.due ?? false;
    return (
      <div
        key={e.id}
        className={cn("rounded-md border p-3", isReady ? "border-ok" : "border-border")}
        data-testid={`expedition-${e.id}`}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-md border-2 border-border-control bg-panel-inset text-lg"
          >
            ⛵
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{t?.name ?? e.tierId}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={isReady ? "ok" : "neutral"}>{isReady ? "returned" : "away"}</Badge>
              {t?.hasBossWave ? <Badge tone="neutral">boss</Badge> : null}
              <span className="text-xs text-muted">
                {isReady ? "Ready to collect" : `${formatRemaining(p?.remainingMs ?? 0)} remaining`}
              </span>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Button
              size="sm"
              onClick={() => void sendCollect(e, false)}
              disabled={!isReady || collect.isPending}
              title={collect.isPending ? "Collecting…" : !isReady ? "Not back yet" : undefined}
            >
              Collect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void sendCollect(e, true)}
              disabled={collect.isPending}
              title={collect.isPending ? "Recalling…" : undefined}
            >
              Recall
            </Button>
          </div>
        </div>

        {!isReady ? (
          <div className="mt-2" data-testid={`expedition-progress-${e.id}`}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Progress</span>
              <span>{Math.round((p?.progress ?? 0) * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-soil-sunken">
              <div className="h-full bg-leaf" style={{ width: `${Math.round((p?.progress ?? 0) * 100)}%` }} />
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`expedition-roster-${e.id}`}>
          {e.squadInstanceIds.map((id) => {
            const specimen = rosterById.get(id);
            const species = specimen ? speciesById.get(specimen.profile.speciesId) : undefined;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-pill border border-border bg-panel-inset px-2 py-0.5 text-xs text-text"
              >
                {species ? <TypeIcon side={species.side} typeId={species.gameTypeId} size={16} /> : null}
                {specimen?.profile.nickname ?? species?.name ?? id}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  function tickCard(tick: ExpeditionCollectDto["ticks"][number]) {
    const battle = reveal?.battles.find((b) => b.battleIndex === tick.battleIndex);
    const label =
      tick.kind === "battle" || tick.kind === "boss-battle"
        ? `${tick.kind === "boss-battle" ? "Boss battle" : "Battle"} — ${battle?.outcome ?? "?"}`
        : tick.kind === "found-souls"
          ? `Found ${tick.souls} Souls`
          : tick.kind === "wild-creature-met"
            ? tick.wildJoins
              ? `A wild ${speciesById.get(tick.wildSpeciesId ?? "")?.name ?? tick.wildSpeciesId} joined!`
              : `Met a wild ${speciesById.get(tick.wildSpeciesId ?? "")?.name ?? tick.wildSpeciesId} — it slipped away`
            : tick.kind === "injury"
              ? "A squad member was injured"
              : "Quiet march";
    return (
      <li key={tick.tickIndex} className="text-sm">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-muted">tick {tick.tickIndex}</span>
          <span className={tick.kind === "quiet" ? "text-muted" : ""}>{label}</span>
        </div>
        {/* battle-tempo forecast-rail FR3: a RECORD of who acted, in order -- the battle already
            resolved before this renders, so this names what happened, never what will. */}
        {battle && battle.turnOrder.length > 0 ? (
          <div className="ml-16 mt-0.5 text-xs text-muted">
            Acting order: {battle.turnOrder.map((t) => t.displayName).join(" → ")}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <Page title="Expeditions" description="Send creature squads into the rifts — timers run without the game.">
      {error ? <Banner tone="error">{error}</Banner> : null}

      {reveal ? (
        <Panel title={`Expedition ${reveal.state === "Recalled" ? "recalled" : "collected"}`}>
          <ul className="space-y-1">{reveal.ticks.map(tickCard)}</ul>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge>+{reveal.soulsAwarded} Souls</Badge>
            {reveal.materials.map((m) => (
              <Badge key={m.materialId}>
                {m.materialId} ×{m.qty}
              </Badge>
            ))}
            {reveal.specimenXp.map((x) => (
              <Badge key={x.instanceId}>+{Math.round(x.xp)} XP</Badge>
            ))}
          </div>
          {reveal.wildJoins.length > 0 ? (
            <p className="mt-2 text-sm">
              New recruits: {reveal.wildJoins.map((w) => w.profile.speciesId).join(", ")}
            </p>
          ) : null}
          <Button className="mt-3" size="sm" variant="ghost" onClick={() => setReveal(null)}>
            Close
          </Button>
        </Panel>
      ) : null}

      <Panel
        title="Active expeditions"
        // T30: the plate's subtitle reads "N returned · N away · N berths free" — "berths" implies a
        // single shared capacity number, but squad slots are per-tier (`tier.squadSlots`), not a
        // roster-wide pool, so that exact number isn't real here. "creatures available" (roster minus
        // whoever's already out) is the honest equivalent: it answers the same question — can I
        // dispatch another one right now — with a real count instead of an invented one.
        description={
          active.length > 0 || (roster.data?.items.length ?? 0) > 0
            ? `${returnedCount} returned · ${active.length - returnedCount} away · ${(roster.data?.items.length ?? 0) - lockedIds.size} creatures available`
            : undefined
        }
      >
        {active.length === 0 ? (
          <EmptyState title="No expeditions out" hint="Pick a tier and a squad below to dispatch one." />
        ) : (
          <div className="flex flex-col gap-3">{active.map(activeRow)}</div>
        )}
      </Panel>

      <Panel title="Dispatch">
        <div className="mb-3 flex flex-wrap gap-2">
          {tiers.map((t: ExpeditionTierDto) => (
            <Button
              key={t.tierId}
              size="sm"
              variant={t.tierId === tier?.tierId ? "primary" : "ghost"}
              onClick={() => {
                setTierId(t.tierId);
                setSquad([]);
              }}
            >
              {t.name} · {t.durationMinutes >= 60 ? `${t.durationMinutes / 60}h` : `${t.durationMinutes}m`} ·{" "}
              {t.squadSlots} slots
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(roster.data?.items ?? []).map((s) => {
            const id = s.profile.instanceId;
            const species = speciesById.get(s.profile.speciesId);
            const onExpedition = lockedIds.has(id);
            const contractBlock = fieldingBlockReason(contractRows[id]);
            const blocked = onExpedition || contractBlock !== null;
            const picked = squad.includes(id);
            return (
              <button
                key={id}
                type="button"
                disabled={blocked}
                title={onExpedition ? "Already on an expedition" : (contractBlock ?? undefined)}
                onClick={() => toggle(id)}
                className={`flex items-center gap-2 rounded-sm border p-2 text-left text-sm ${
                  picked ? "border-leaf" : "border-border"
                } ${blocked ? "opacity-40" : "cursor-pointer"}`}
                data-testid={`squad-pick-${id}`}
              >
                {species ? <TypeIcon side={species.side} typeId={species.gameTypeId} size={28} /> : null}
                <span className="min-w-0 flex-1 truncate">
                  {s.profile.nickname ?? species?.name ?? s.profile.speciesId} · L{s.actor.level}
                </span>
                {s.profile.star > 0 ? (
                  <span className="text-xs text-amber-300">{"★".repeat(s.profile.star)}</span>
                ) : null}
                {onExpedition ? (
                  <Badge>on expedition</Badge>
                ) : contractBlock ? (
                  <Badge data-testid={`squad-blocked-${id}`}>{conditionOf(contractRows[id])}</Badge>
                ) : picked ? (
                  <Badge>picked</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            onClick={() => void sendDispatch()}
            disabled={!tier || squad.length === 0 || dispatch.isPending}
            title={
              dispatch.isPending
                ? "Dispatching…"
                : squad.length === 0
                  ? "Pick at least one creature"
                  : undefined
            }
          >
            Dispatch {squad.length}/{tier?.squadSlots ?? 0}
          </Button>
          <span className="text-xs text-muted">
            {tier
              ? `${tier.battleCount}${tier.hasBossWave ? "+boss" : ""} battles over ${tier.tickCount} ticks`
              : ""}
          </span>
        </div>
      </Panel>

      <Panel title="Materials shelf">
        {(materials.data?.items ?? []).length === 0 ? (
          <EmptyState title="No materials yet" hint="Expedition battles and encounters drop essences and shards." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {materials.data!.items.map((m) => (
              <Badge key={m.materialId}>
                {m.materialId} ×{m.qty}
              </Badge>
            ))}
          </div>
        )}
      </Panel>

      {history.length > 0 ? (
        <Panel title="Recent">
          <ul className="space-y-1 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Badge>{e.state}</Badge>
                <span>{tiers.find((t) => t.tierId === e.tierId)?.name ?? e.tierId}</span>
                <span className="text-xs text-muted">{e.collectedUtc ?? ""}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </Page>
  );
}
