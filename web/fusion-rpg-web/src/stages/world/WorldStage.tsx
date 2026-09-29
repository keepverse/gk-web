import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StageHost, useStageMountGuard } from "@/shell/stageHost";
import { claimStageEscape, handleEscape } from "@/shell/keymap";
import { Rail } from "@/shell/Rail";
import { deriveRailEntries, type RailEntry, type RailUnlockInputs } from "@/shell/railState";
import {
  initialWorldUi,
  orderId,
  reachableFromLegion,
  routeForLegion,
  worldUiReducer,
  type PendingOrder
} from "@/stages/world/worldSelection";
import { toGraph, summarizeLoam } from "@/stages/world/worldViewModel";
import { sectorLabel } from "@/stages/world/labels";
import { useCreatureRoster, usePlayers, useRelics, useRuns, newCorrelationId } from "@/lib/bus";
import { useContracts } from "@/lib/bus/contracts";
import {
  useWorldHeader,
  useWorldState,
  useDelveDomainOffers,
  useStartDelveFromWorldDoor,
  buildDelveDoorStartBody,
  useSectorStorage,
  useLegionCargo,
  useWorldCatalog,
  useSubmitWorldCommands,
  buildDepositCargoCommand,
  buildWithdrawCargoCommand
} from "@/lib/bus/world";
import { useExpeditionReturnWatcher } from "@/layers/expeditions/expeditionReturnWatcher";
import { adaptWorldState, adaptWorldLegion, adaptSectorStorage } from "@/contract/adapt";
import { pendingWithReason } from "@/contract/pending";
import firstLight from "@/stages/world/fixtures/first-light.json";
import { WorldGameHost } from "@/stages/world/host/WorldGameHost";
import { useWorldVerbs, type WorldVerb } from "@/stages/world/turn/worldVerbs";
import { delveRoute } from "@/stages/delve/route";
import { SectorInspector } from "./inspector/SectorInspector";
import { CacheClaimPrompt } from "./cacheClaim";
import { CEDE_ORDER_AVAILABLE } from "./inspector/cedeCapability";
import { delveDoorSlot, delveDoorLabel, DELVE_DOOR_NONE_DISCOVERED_REASON } from "./inspector/delveDoorCapability";
import type { ActionVerb } from "./inspector/ActionCluster";
import { QueuedOrders } from "./targeting/QueuedOrders";
import { WorldHud } from "./hud/WorldHud";
import { TopStrip } from "./hud/TopStrip";
import { TurnCluster } from "./turn/TurnCluster";
import { UnresolvedCount } from "./turn/UnresolvedCount";
import { PlaybackPanel } from "./playback/PlaybackPanel";
import { NotifyRail } from "@/shell/notify/rail/NotifyRail";
import type { NotifySetState } from "@/shell/notify/catalog";
import { useNotificationFeed } from "@/shell/notify/feed/feedStore";
import { railItemsFrom } from "@/shell/notify/rail/railItems";
import { worldLatestTurn } from "@/shell/notify/rail/mountPolicies";
import { registerTargetActionResolver } from "@/shell/notify/targetActions";
import { useSetNotificationState } from "@/lib/bus/notifications";
import { useLegacyCaptureLoss, worldRailRows } from "./notify/legacyCaptureLoss";
import { Outliner } from "./outliner/Outliner";
import { OutlinerFilter } from "./outliner/OutlinerFilter";
import {
  applyOutlinerFilter,
  buildOutlinerGroups,
  type OutlinerFilter as OutlinerFilterId,
  type OutlinerRow
} from "./outliner/outlinerModel";
import { centreTargetForOutlinerRow } from "./outliner/outlinerCentre";
import { worldBusEmit, type WorldIgnoreRect, type WorldSelectPayload } from "@/game/EventBus";
import { LensPicker } from "./lenses/LensPicker";
import { initialLensState, lensReducer } from "./lenses/lensState";
import { useLensData } from "./lenses/useLensData";
import { isWorldMapChromeMuted } from "./mapChromeMute";
import { buildWorldIgnoreRects, fitPadLeft, rectRelativeToCanvas, type MeasuredIgnoreAnchors } from "./worldIgnoreRects";

/**
 * World stage — Phaser map plane + React HUD/inspector (world-map-runtime).
 * Falls back to first-light fixture when no live world.
 * Does not import SVG WorldScene / camera / cameraGestures (R15).
 * Shell Rail mounts like Lawn (gaps D22); chrome order Notify → Outliner → Playback (D24).
 */
export function WorldStage() {
  useStageMountGuard("world");
  const navigate = useNavigate();

  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 0;
  const header = useWorldHeader(playerId);
  const worldId = header.data?.worldId ?? null;
  const live = useWorldState(worldId);

  // Unlock queries duplicate Sanctum's — react-query dedupes by key (gaps D22 / Lawn pattern).
  const runsQuery = useRuns();
  const contractsQuery = useContracts(playerId);
  const relicsQuery = useRelics();
  const creatureRosterQuery = useCreatureRoster(playerId);
  const { returnedCount } = useExpeditionReturnWatcher(playerId);
  const railInputs: RailUnlockInputs = {
    currentStageId: "world",
    hasCompletedARun: (runsQuery.data?.length ?? 0) > 0,
    hasAnyCreature: (creatureRosterQuery.data?.items.length ?? 0) > 0,
    hasAnyContract: (contractsQuery.data?.contracts.length ?? 0) > 0,
    hasAnyRelic: (relicsQuery.data?.items.length ?? 0) > 0,
    hasAnyBoundCreature: contractsQuery.data?.contracts.some((c) => c.bound) ?? false,
    returnedExpeditionCount: returnedCount,
    unreadResultCount: 0
  };
  const railEntries = deriveRailEntries(railInputs);

  function openLayerOnSanctum(id: Exclude<RailEntry["id"], "sanctum">) {
    navigate(`/sanctum?panel=${id}`);
  }

  const [lens, dispatchLens] = useReducer(lensReducer, initialLensState);
  const lensData = useLensData(worldId, lens.active);

  const dto = live.data ?? (firstLight as Parameters<typeof adaptWorldState>[0]);
  const fixtureWorld = useMemo(
    () => adaptWorldState(dto, { lifelinesRequested: lens.active === "supply" }),
    [dto, lens.active]
  );
  /** Prefer lens-4 adapted fetch when it has resolved; otherwise fixture/plain adapt. */
  const world = lensData.displayed ?? fixtureWorld;
  const playerFactionId = useMemo(
    () => dto.factions.find((f) => f.kind === "Player")?.factionId ?? null,
    [dto]
  );

  const [overlayEpoch, setOverlayEpoch] = useState(0);
  useEffect(() => {
    setOverlayEpoch((n) => n + 1);
  }, [lens.active, lensData.displayed, lensData.isLensFourLoading]);

  const [worldGeneration, setWorldGeneration] = useState(0);
  const mapPaneRef = useRef<HTMLDivElement | null>(null);
  const [mapPaneSize, setMapPaneSize] = useState({ w: 1280, h: 720 });
  const [measuredAnchors, setMeasuredAnchors] = useState<MeasuredIgnoreAnchors>({});
  useEffect(() => {
    const el = mapPaneRef.current;
    if (!el) return;
    const sync = () => setMapPaneSize({ w: Math.max(2, el.clientWidth), h: Math.max(2, el.clientHeight) });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [ui, dispatch] = useReducer(worldUiReducer, initialWorldUi);
  const [outlinerFilter, setOutlinerFilter] = useState<OutlinerFilterId>("all");

  // notify-client §5/§6 + world-notify-source §4 — the rail renders the FEED's own selection now,
  // bounded by its mount policy: the most recently resolved turn of this world, the same one-turn
  // bound the playback keyframe rail has. There is no local `useState` feed: the server is the one
  // source for the feed (boundary), and the click budget's 0-click rows ride that bound (W89).
  const feed = useNotificationFeed();
  const setNotificationState = useSetNotificationState();
  const legacyNotices = useLegacyCaptureLoss((s) => s.items);
  const adoptLegacyNotice = useLegacyCaptureLoss((s) => s.adopt);
  const lastResolvedTurn = Math.max(0, dto.currentTurn - 1);
  const railRows = useMemo(
    () => worldRailRows(railItemsFrom(feed, worldLatestTurn, { worldId, lastResolvedTurn }), legacyNotices),
    [feed, worldId, lastResolvedTurn, legacyNotices]
  );

  /**
   * A server row's open/dismiss/undo is a SERVER state change (notify-service §4) — the same row, on
   * every surface that shows it. A locally built debt row has no server row to change (`seq` is
   * null), so its transition stays in `legacyCaptureLoss.ts` and goes nowhere.
   */
  function setRailItemState(id: string, state: NotifySetState) {
    const row = railRows.find((r) => r.id === id);
    if (!row) return;
    if (row.seq === null) {
      const local = useLegacyCaptureLoss.getState();
      if (state === "read") local.open(id);
      else local.dismiss(id);
      return;
    }
    if (feed.playerId === null) return; // no save joined yet: there is nothing to address
    setNotificationState.mutate({ playerId: feed.playerId, seqs: [row.seq], state });
  }

  // notify-client §6 — the active mount registers the target kinds it can act on, so an item gets a
  // button only where the world stage has a real handler for it.
  useEffect(() => {
    const offSector = registerTargetActionResolver("sector", (target) => ({
      label: "Select sector",
      run: () => dispatch({ type: "select-sector", sectorId: target.id })
    }));
    const offLegion = registerTargetActionResolver("legion", (target) => ({
      label: "Select legion",
      run: () => dispatch({ type: "select-entity", entityId: target.id })
    }));
    return () => {
      offSector();
      offLegion();
    };
  }, []);

  useEffect(
    () => claimStageEscape("world-stage", () => dispatch({ type: "select-sector", sectorId: null })),
    []
  );

  /** Arrow pan when map owns input. W is not pan (world-stage arbitration). GG-18 mutes under panel. */
  const panVerbs = useMemo((): WorldVerb[] => {
    const step = 48;
    const pan = (dx: number, dy: number) => {
      if (isWorldMapChromeMuted()) return;
      if (!worldGeneration) return;
      worldBusEmit("world:camera", { generation: worldGeneration, op: "pan", dx, dy });
    };
    return [
      { key: "ArrowLeft", id: "world-pan-left", handler: () => pan(-step, 0) },
      { key: "ArrowRight", id: "world-pan-right", handler: () => pan(step, 0) },
      { key: "ArrowUp", id: "world-pan-up", handler: () => pan(0, -step) },
      { key: "ArrowDown", id: "world-pan-down", handler: () => pan(0, step) }
    ];
  }, [worldGeneration]);
  useWorldVerbs(panVerbs);

  const selectedSector = world.sectors.find((s) => s.sectorId === ui.selectedSectorId) ?? null;
  const prospectedSectorIds: string[] = dto.prospectedSectorIds ?? [];

  // party-dungeon D1.28 (the world-map door) — one action row, additive only. Hooks live here, not
  // in SectorInspector: that component stays pure/presentational (no QueryClientProvider needed by
  // its own tests), the same split TurnCluster already established for `useSubmitWorldCommands`.
  const eligibleDelveSlot = selectedSector
    ? delveDoorSlot(world.slotsBySectorId[selectedSector.sectorId] ?? [])
    : null;
  const delveOffers = useDelveDomainOffers(playerId);
  const startDelveFromDoor = useStartDelveFromWorldDoor();
  const firstDelveOffer = delveOffers.data?.[0] ?? null;
  const delveDoorVerb: ActionVerb | null =
    eligibleDelveSlot && worldId
      ? {
          id: "delve-door",
          label: delveDoorLabel(eligibleDelveSlot),
          disabledReason: firstDelveOffer ? null : DELVE_DOOR_NONE_DISCOVERED_REASON,
          onActivate: firstDelveOffer
            ? () => {
                const body = buildDelveDoorStartBody({
                  offer: firstDelveOffer,
                  worldId,
                  playerId,
                  correlationId: newCorrelationId()
                });
                void startDelveFromDoor.mutateAsync(body).then((result) => navigate(delveRoute(result.delveId)));
              }
            : undefined
        }
      : null;

  useEffect(() => {
    const el = mapPaneRef.current;
    if (!el) return;
    const syncMeasured = () => {
      const canvas = el.querySelector("canvas");
      if (!canvas) {
        setMeasuredAnchors({});
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const measure = (testid: string) => {
        const node = document.querySelector(`[data-testid="${testid}"]`);
        if (!node) return undefined;
        return rectRelativeToCanvas(canvasRect, node.getBoundingClientRect()) ?? undefined;
      };
      setMeasuredAnchors({
        top: measure("world-hud-anchor-top-strip"),
        bottomLeft: measure("world-hud-anchor-bottom-left"),
        right: measure("world-hud-right-column"),
        dock: measure("sector-inspector")
      });
    };
    syncMeasured();
    const ro = new ResizeObserver(syncMeasured);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ui.selectedSectorId, mapPaneSize.w, mapPaneSize.h]);

  const graph = useMemo(() => toGraph(dto), [dto]);
  const loamSummary = useMemo(() => summarizeLoam(graph.nodes.map((n) => n.data)), [graph]);
  /** All entities for map markers (gaps D26) — turn cluster still filters to mine. */
  const allLegions = useMemo(() => dto.entities.map(adaptWorldLegion), [dto]);
  const myLegions = useMemo(
    () => allLegions.filter((e) => e.kind === "Legion" && e.ownerFactionId === playerFactionId),
    [allLegions, playerFactionId]
  );
  const mySectors = useMemo(
    () => world.sectors.filter((s) => s.ownerFactionId === playerFactionId),
    [world.sectors, playerFactionId]
  );
  const myLegionDisplayNames = useMemo(
    () => Object.fromEntries(dto.entities.map((e) => [e.entityId, e.displayName])),
    [dto]
  );
  const selectedLegion = useMemo(
    () => (ui.selectedEntityId ? dto.entities.find((e) => e.entityId === ui.selectedEntityId) ?? null : null),
    [dto, ui.selectedEntityId]
  );

  // empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault block's
  // one-sector read plus its action-row verbs. One sector's `GET .../storage` per inspector
  // open (re-read per selection; the query key carries the sector id, so no cross-sector
  // fetch), one legion's `GET .../cargo` for the band standing there. Both hooks gate on
  // their own ids (disabled against the first-light fixture, which has no world id).
  // Filing goes through the EXISTING `POST /api/world/{worldId}/commands` filer — no new
  // route; the outcome answers via the turn report plus the read-backs above (GG-15).
  const vaultQuery = useSectorStorage(worldId, selectedSector?.sectorId);
  const catalog = useWorldCatalog();
  const standingLegion = useMemo(
    () =>
      selectedSector
        ? (myLegions.find(
            (e) => e.position.kind === "sector" && e.position.sectorId === selectedSector.sectorId
          ) ?? null)
        : null,
    [myLegions, selectedSector]
  );
  const standingCargoQuery = useLegionCargo(worldId, standingLegion?.entityId);
  const submitWorldCommands = useSubmitWorldCommands(worldId);
  const vaultView = useMemo(
    () => (vaultQuery.data ? adaptSectorStorage(vaultQuery.data) : null),
    [vaultQuery.data]
  );
  const vaultVerbs: ActionVerb[] = useMemo(() => {
    if (!selectedSector || !standingLegion || !worldId) return [];
    const depositSeq = standingCargoQuery.data?.rows[0]?.seq ?? null;
    const withdrawSeq = vaultQuery.data?.rows[0]?.seq ?? null;
    return [
      {
        id: "vault-deposit",
        label: "Put in",
        disabledReason: depositSeq == null ? "vault.no-cargo-rows" : null,
        onActivate:
          depositSeq == null
            ? undefined
            : () => {
                void submitWorldCommands.mutateAsync({
                  commands: [
                    buildDepositCargoCommand({
                      commandId: newCorrelationId(),
                      entityId: standingLegion.entityId,
                      sectorId: selectedSector.sectorId,
                      seq: depositSeq
                    })
                  ]
                });
              }
      },
      {
        id: "vault-withdraw",
        label: "Take out",
        disabledReason: withdrawSeq == null ? "vault.no-stored-rows" : null,
        onActivate:
          withdrawSeq == null
            ? undefined
            : () => {
                void submitWorldCommands.mutateAsync({
                  commands: [
                    buildWithdrawCargoCommand({
                      commandId: newCorrelationId(),
                      entityId: standingLegion.entityId,
                      sectorId: selectedSector.sectorId,
                      seq: withdrawSeq
                    })
                  ]
                });
              }
      }
    ];
  }, [selectedSector, standingLegion, worldId, standingCargoQuery.data, vaultQuery.data, submitWorldCommands]);
  const reachableSectors = useMemo(() => {
    if (!selectedLegion) return null;
    return Array.from(reachableFromLegion(graph, selectedLegion), ([sectorId, hops]) => ({ sectorId, hops }));
  }, [graph, selectedLegion]);

  const outlinerGroups = useMemo(
    () => applyOutlinerFilter(buildOutlinerGroups(myLegions, mySectors, ui.pending), outlinerFilter),
    [myLegions, mySectors, ui.pending, outlinerFilter]
  );

  const outlinerSelectedId = ui.selectedEntityId ?? ui.selectedSectorId;

  const [blockedTarget, setBlockedTarget] = useState<{ sectorId: string; reason: string } | null>(null);
  useEffect(() => setBlockedTarget(null), [ui.selectedEntityId]);

  const ignoreRects = useMemo((): WorldIgnoreRect[] => {
    // Canvas sits beside the shell rail (flex frame) — do not double-subtract 92px (gaps D22).
    return buildWorldIgnoreRects({
      width: mapPaneSize.w,
      height: mapPaneSize.h,
      dockOpen: selectedSector != null,
      canvasBesideRail: true,
      measured: measuredAnchors
    });
  }, [selectedSector, mapPaneSize, measuredAnchors]);

  const targeting = useMemo(
    () =>
      reachableSectors || blockedTarget || ui.pending.length > 0
        ? { reachable: reachableSectors, blocked: blockedTarget, pending: ui.pending }
        : null,
    [reachableSectors, blockedTarget, ui.pending]
  );

  function handleSelectSector(sectorId: string) {
    if (selectedLegion) {
      const path = routeForLegion(graph, selectedLegion, sectorId);
      if (path) {
        const order: PendingOrder = {
          commandId: orderId(dto.currentTurn, "move", selectedLegion.entityId),
          kind: "move",
          entityId: selectedLegion.entityId,
          sectorId,
          lanePath: path,
          label: `March to ${sectorLabel(sectorId)}`
        };
        dispatch({ type: "queue", order });
        setBlockedTarget(null);
      } else {
        setBlockedTarget({ sectorId, reason: "path.empty" });
      }
      return;
    }
    dispatch({ type: "select-sector", sectorId });
  }

  function handleWorldSelect(payload: WorldSelectPayload) {
    if (payload.kind === "empty") {
      handleEscape();
      return;
    }
    if (payload.kind === "sector" && payload.id) {
      handleSelectSector(payload.id);
      return;
    }
    if (payload.kind === "force" && payload.id) {
      dispatch({
        type: "select-entity",
        entityId: ui.selectedEntityId === payload.id ? null : payload.id
      });
      if (ui.selectedSectorId != null) dispatch({ type: "select-sector", sectorId: null });
    }
  }

  function handleOutlinerSelect(id: string, kind: OutlinerRow["kind"]) {
    if (kind === "legion") {
      dispatch({ type: "select-entity", entityId: id });
      if (ui.selectedSectorId != null) dispatch({ type: "select-sector", sectorId: null });
      return;
    }
    dispatch({ type: "select-sector", sectorId: id });
    if (ui.selectedEntityId != null) dispatch({ type: "select-entity", entityId: null });
  }

  function handleOutlinerCentre(row: OutlinerRow) {
    if (!worldGeneration) return;
    const point = centreTargetForOutlinerRow(row, world.sectors);
    if (!point) return;
    worldBusEmit("world:camera", {
      generation: worldGeneration,
      op: "centre",
      x: point.x,
      y: point.y
    });
  }

  return (
    <StageHost>
      <div className="flex h-full min-h-0 items-stretch" data-testid="world-frame">
        <Rail
          entries={railEntries}
          onSelect={(id) => (id === "sanctum" ? navigate("/sanctum") : openLayerOnSanctum(id))}
        />
        <div className="min-w-0 flex-1" ref={mapPaneRef}>
          <WorldHud
            topStrip={
              <TopStrip
                turn={dto.currentTurn}
                calendar={dto.calendar}
                income={{ unit: "loamUnits", value: loamSummary.production }}
                upkeep={{ unit: "loamUnits", value: loamSummary.upkeep }}
                net={{ unit: "loamUnits", value: loamSummary.net }}
                stock={{ unit: "loamUnits", value: loamSummary.stock }}
                stockCapacity={pendingWithReason("capacity not yet exposed by the server")}
              />
            }
            bottomRight={
              <div
                className="pointer-events-auto flex flex-col items-end gap-2 p-2"
                data-testid="world-hud-turn-wrap"
              >
                <UnresolvedCount
                  legions={myLegions}
                  pending={ui.pending}
                  displayNames={myLegionDisplayNames}
                  onFocus={(entityId) => dispatch({ type: "select-entity", entityId })}
                />
                {worldId ? (
                  <TurnCluster
                    worldId={worldId}
                    currentTurn={dto.currentTurn}
                    commanderId={playerFactionId ?? ""}
                    legions={myLegions}
                    pending={ui.pending}
                    onOrdersFiled={() => dispatch({ type: "clear-queue" })}
                  />
                ) : null}
              </div>
            }
            bottomLeft={
              <div className="pointer-events-auto flex flex-col items-start gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="world-map-fit"
                    className="rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
                    onClick={() => {
                      if (!worldGeneration) return;
                      worldBusEmit("world:camera", {
                        generation: worldGeneration,
                        op: "fit",
                        padLeft: fitPadLeft(selectedSector != null, measuredAnchors.dock?.width),
                        padRight: 40,
                        padTop: measuredAnchors.top?.height ?? 56,
                        padBottom: 80
                      });
                    }}
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    data-testid="world-map-zoom-in"
                    className="rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
                    aria-label="Zoom in"
                    onClick={() => {
                      if (!worldGeneration) return;
                      worldBusEmit("world:camera", {
                        generation: worldGeneration,
                        op: "zoom",
                        factor: 1.15
                      });
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    data-testid="world-map-zoom-out"
                    className="rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
                    aria-label="Zoom out"
                    onClick={() => {
                      if (!worldGeneration) return;
                      worldBusEmit("world:camera", {
                        generation: worldGeneration,
                        op: "zoom",
                        factor: 1 / 1.15
                      });
                    }}
                  >
                    −
                  </button>
                </div>
                <LensPicker
                  active={lens.active}
                  onSelect={(id) => dispatchLens({ type: "select", id })}
                  isLensFourLoading={lensData.isLensFourLoading}
                />
                <QueuedOrders orders={ui.pending} onTakeBack={(commandId) => dispatch({ type: "unqueue", commandId })} />
              </div>
            }
            rightEdge={
              <div
                className="pointer-events-auto flex w-[280px] flex-col gap-2 p-2"
                data-testid="world-hud-right-column"
              >
                <NotifyRail
                  items={railRows}
                  onOpen={(id) => setRailItemState(id, "read")}
                  onDismiss={(id) => setRailItemState(id, "dismissed")}
                  onUndoDismiss={(id) => setRailItemState(id, "read")}
                />
                <OutlinerFilter filter={outlinerFilter} onChange={setOutlinerFilter} />
                <Outliner
                  groups={outlinerGroups}
                  selectedId={outlinerSelectedId}
                  onSelect={handleOutlinerSelect}
                  onCentreRequest={handleOutlinerCentre}
                />
                {worldId ? <PlaybackPanel worldId={worldId} turn={dto.currentTurn - 1} /> : null}
              </div>
            }
          >
            <div className="h-full w-full min-h-0">
              <WorldGameHost
                model={world}
                legions={allLegions}
                playerFactionId={playerFactionId}
                overlayEpoch={overlayEpoch}
                selectedSectorId={ui.selectedSectorId}
                selectedEntityId={ui.selectedEntityId}
                ignoreRects={ignoreRects}
                targeting={targeting}
                lens={lens.active}
                onGeneration={setWorldGeneration}
                onSelect={handleWorldSelect}
              />
            </div>
          </WorldHud>
        </div>
      </div>

      {selectedSector ? (
        <SectorInspector
          open
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "select-sector", sectorId: null });
          }}
          sector={selectedSector}
          slots={world.slotsBySectorId[selectedSector.sectorId] ?? []}
          forces={world.forcesBySectorId[selectedSector.sectorId] ?? []}
          cedeOrderAvailable={CEDE_ORDER_AVAILABLE}
          prospected={prospectedSectorIds.includes(selectedSector.sectorId)}
          delveDoorVerb={delveDoorVerb}
          vault={vaultView}
          vaultState={vaultQuery.isError ? "error" : vaultQuery.data ? "ready" : "loading"}
          vaultError={vaultQuery.isError ? "The vault could not be read." : null}
          onVaultRetry={() => void vaultQuery.refetch()}
          vaultVerbs={vaultVerbs}
          catalogStructures={catalog.data?.structures ?? null}
        />
      ) : null}

      {/* empire-inventory-surfaces `storage-cache-ui` §§Design 2–4 (plan Task 4D.2b):
          pin → prompt → pick-up for the selected legion, plus the capture-loss
          toast wire. One legion's list per selection (the prompt's own hook);
          unmounted when nothing is selected, so no fetch fires. The prompt is
          a band-2 sheet over the exact map state (GG-12); the capture header
          stays the vault block's live read — this only hands the loser's one
          toast to the existing NotifyRail (deduped by id). */}
      {ui.selectedEntityId && worldId ? (
        <CacheClaimPrompt
          worldId={worldId}
          entityId={ui.selectedEntityId}
          turn={dto.currentTurn}
          commanderId={playerFactionId ?? undefined}
          sectorId={selectedSector?.sectorId}
          ownerFactionId={vaultView?.ownerFactionId}
          viewerFactionId={playerFactionId}
          onNotify={adoptLegacyNotice}
        />
      ) : null}
    </StageHost>
  );
}
