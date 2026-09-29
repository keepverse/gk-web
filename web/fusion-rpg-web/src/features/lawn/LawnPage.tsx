import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getLastHitEvent,
  getLawnMembershipRing,
  getLawnRecoveryState,
  newCorrelationId,
  subscribeLastHit,
  subscribeLawnRecovery,
  subscribeLog,
  useCommanders,
  useCreatureRoster,
  useDeployUniqueActor,
  useHubStatus,
  useLawnDebugPost,
  usePlayers,
  useSetDefaultCommander,
  useSpawnExtraIntent,
  useSpeciesIndex,
  useUniqueActor,
  useUniqueActors
} from "@/lib/bus";
import type { LawnSelectPayload } from "@/game/EventBus";
import { cn } from "@/lib/cn";
import { claimStageEscape } from "@/shell/keymap";
import { useDevModeLive } from "@/dev/useDevModeLive";
import { adaptCommanderSheet, adaptActor } from "@/contract/adapt";
import { Page } from "@/layouts/Page";
import { Split } from "@/layouts/Split";
import {
  Badge,
  Banner,
  Button,
  Field,
  HelpText,
  KeyValue,
  NumberInput,
  Panel,
  Select,
  TextInput,
  TypeIcon
} from "@/ui";
import { LawnGameHost } from "./LawnGameHost";
import { LawnScreenshotPanel } from "./LawnScreenshotPanel";
import { ActorHudInspector } from "./ActorHudInspector";
import { LawnOccupantList } from "./LawnOccupantList";
import { LawnStatsModal } from "./LawnStatsModal";
import { ActorPanel, type ActorRungState } from "@/ui/actor";
import { LawnMatchHud } from "@/ui/lawn/LawnMatchHud";
import { CellOccupancyDock } from "@/ui/lawn/CellOccupancyDock";
import { SpawnTray } from "@/ui/lawn/SpawnTray";
import { CommanderActionBar } from "@/ui/lawn/CommanderActionBar";
import { encodeLawnSel, type LawnCollectionRow } from "@/ui/lawn/adaptOccupant";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";
import { setLawnKeyboardMuted } from "@/game/focusGate";
import {
  boardArrowsLive,
  canEnterSpawnTargeting,
  idleInteraction,
  reduceInteraction,
  type InteractionState
} from "./interactionMode";
import { formatLastHit, lastHitFromEnvelope } from "./lawnLogFilter";
import { selectionStillValid } from "./lawnProjectorFold";
import { applyLawnSession } from "./lawnSessionFold";
import {
  isLargeCanvas,
  loadLawnViewMode,
  saveLawnViewMode,
  type LawnViewMode
} from "./lawnViewMode";
import {
  emptyLawnViewModel,
  findMarker,
  findOccupant,
  listOccupants,
  normalizePtr,
  shouldPollBoardStats,
  tilesAt
} from "./lawnViewModel";
import { PHASER_OCCUPANT_BUDGET, pickPhaserOccupants } from "./pickPhaserOccupants";

const VIEW_MODES: LawnViewMode[] = ["split", "large", "stack"];

/**
 * Lawn projector page (W6 monitor + W7 Intent/debug interact).
 *
 * Living membership comes only from event/Snapshot fold — NEVER from
 * PvzActivity rollups. Intent never writes Occupants (RT-12).
 */
export function LawnPage() {
  const navigate = useNavigate();
  const players = usePlayers();
  const hubStatus = useHubStatus();
  const recovery = useSyncExternalStore(
    subscribeLawnRecovery,
    getLawnRecoveryState,
    getLawnRecoveryState
  );
  const playerId = players.data?.currentPlayerId ?? 1;
  const commandersQuery = useCommanders(playerId);
  const setDefaultCommander = useSetDefaultCommander(playerId);
  const [commanderSheetOpen, setCommanderSheetOpen] = useState(false);
  const events = useSyncExternalStore(
    subscribeLog,
    getLawnMembershipRing,
    getLawnMembershipRing
  );
  const hitEvent = useSyncExternalStore(
    subscribeLastHit,
    getLastHitEvent,
    getLastHitEvent
  );
  const lastHit = lastHitFromEnvelope(hitEvent);
  const sessionRef = useRef({ model: emptyLawnViewModel(), lastEventId: 0 });
  const model = useMemo(() => {
    const next = applyLawnSession(
      sessionRef.current.model,
      events,
      sessionRef.current.lastEventId
    );
    sessionRef.current = next;
    return next.model;
  }, [events]);
  const chrome = useMemo(
    () => (lastHit ? { ...model, lastHit } : model),
    [model, lastHit]
  );
  const recoveryMessage =
    recovery.kind === "loading"
      ? "Loading the authoritative lawn state…"
      : recovery.kind === "stale"
        ? "Reconnected. Showing the last known lawn state until the authoritative snapshot arrives."
        : recovery.kind === "error"
          ? recovery.message
          : recovery.kind === "empty"
            ? "No active lawn match."
            : null;
  const recoveryTone =
    recovery.kind === "error" ? "error" : recovery.kind === "stale" ? "warn" : "info";
  const connection =
    recovery.kind === "error" || hubStatus === "err"
      ? "disconnected"
      : hubStatus === "on"
        ? "connected"
        : "optional";

  const [viewMode, setViewMode] = useState<LawnViewMode>(loadLawnViewMode);
  const large = isLargeCanvas(viewMode);
  const [statsOpen, setStatsOpen] = useState(() => isLargeCanvas(loadLawnViewMode()));
  const userClosedStats = useRef(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const [interaction, setInteraction] = useState<InteractionState>(idleInteraction);
  const [spawnTypeId, setSpawnTypeId] = useState(0);
  const [spawnSide, setSpawnSide] = useState<"plant" | "zombie">("zombie");
  const [statusName, setStatusName] = useState("butter");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [spawnTrayOpen, setSpawnTrayOpen] = useState(false);
  const [dockSelectionKey, setDockSelectionKey] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<LawnCollectionRow | null>(null);
  const [armedOrderId, setArmedOrderId] = useState<string | null>(null);

  const spawnExtra = useSpawnExtraIntent();
  const debugPost = useLawnDebugPost();
  const boardStatsPost = useLawnDebugPost({ silent: true });

  useEffect(() => {
    if (!shouldPollBoardStats(model.phase)) return;
    let inFlight = false;
    const tick = () => {
      if (inFlight) return;
      inFlight = true;
      boardStatsPost.mutate(
        { path: "board-stats", body: {} },
        { onSettled: () => { inFlight = false; } }
      );
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
    // Poll while InMatch or Paused; mutate identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.phase]);

  useEffect(() => {
    setInteraction((prev) => {
      let next = reduceInteraction(
        prev,
        { type: "phaseChanged", phase: model.phase },
        model.phase
      );
      if (
        next.mode === "OccupantSelected" &&
        next.ptr &&
        !selectionStillValid(model, next.ptr)
      ) {
        next = idleInteraction();
      }
      return next;
    });
  }, [model]);

  const selected = interaction.ptr
    ? findOccupant(model, interaction.ptr)
    : undefined;
  const selectedMarker =
    !selected && interaction.ptr ? findMarker(model, interaction.ptr) : undefined;

  const uniqueQ = useUniqueActor(sheetRow?.instanceId ?? selected?.instanceId);

  const onSelect = useCallback(
    (payload: LawnSelectPayload) => {
      setInteraction((prev) => {
        if (payload.kind === "occupant" && payload.ptr) {
          // Occupant / Band B HUD hit → OccupantSelected → left dock (T12).
          logLawnInteractive("hud.click_dock", {
            ptr: payload.ptr,
            row: payload.row,
            col: payload.col
          });
          return reduceInteraction(
            prev,
            {
              type: "selectOccupant",
              ptr: payload.ptr,
              row: payload.row,
              col: payload.col
            },
            model.phase
          );
        }
        if (payload.kind === "tile" && payload.row != null && payload.col != null) {
          logLawnInteractive("tile.dock", { row: payload.row, col: payload.col });
          return reduceInteraction(
            prev,
            { type: "selectTile", row: payload.row, col: payload.col },
            model.phase
          );
        }
        return prev;
      });
    },
    [model.phase]
  );

  // Developer Spawn/Inspector stays GG-41. Player chrome: LawnMatchHud + dock + tray + action bar.
  const devMode = useDevModeLive();
  const living = listOccupants(model);
  const livingCount = living.length;
  const deployedChips = useMemo(
    () =>
      living
        .filter((o) => Boolean(o.instanceId))
        .map((o) => ({
          ptr: o.ptr,
          side: o.side,
          typeId: o.typeId,
          typeName: o.typeName,
          instanceId: o.instanceId
        })),
    [living]
  );
  const uniqueActorsQ = useUniqueActors(playerId);
  const spawnTrayEntries = useMemo(() => {
    const items = uniqueActorsQ.data?.items ?? [];
    const bound = new Set(
      living.filter((o) => o.instanceId).map((o) => o.instanceId as string)
    );
    // Bound uniques stay visible as locked rows — never filtered out of the tray (T7).
    return items.map((a) => ({
      actor: a,
      lockedReason: bound.has(a.instanceId) ? "Already Bound on the lawn" : undefined
    }));
  }, [uniqueActorsQ.data?.items, living]);
  const picked = pickPhaserOccupants(
    living,
    PHASER_OCCUPANT_BUDGET,
    interaction.ptr
  );
  const canvasPtrs = new Set(picked.onCanvas.map((o) => normalizePtr(o.ptr)));
  const canvasCount = picked.onCanvas.length;
  const canSpawn = canEnterSpawnTargeting(model.phase);
  const targetRow = interaction.row;
  const targetCol = interaction.col;
  const hasCell = targetRow != null && targetCol != null;
  const dockOpen =
    !spawnTrayOpen &&
    (interaction.mode === "TileSelected" || interaction.mode === "OccupantSelected") &&
    hasCell;
  const cellOccupants =
    hasCell && targetRow != null && targetCol != null
      ? model.cells.get(`${targetRow},${targetCol}`) ?? []
      : [];
  const selectionLabel =
    hasCell && targetRow != null && targetCol != null
      ? `Lane ${targetRow + 1} · Column ${targetCol + 1}`
      : undefined;

  useEffect(() => {
    const dockOrSheetOpen =
      dockOpen || Boolean(sheetRow) || commanderSheetOpen || spawnTrayOpen;
    // Spawn/Action targeting keep board arrows (GG-18); dock/sheet mute Idle inspect only.
    setLawnKeyboardMuted(!boardArrowsLive(interaction.mode, dockOrSheetOpen));
    return () => setLawnKeyboardMuted(false);
  }, [dockOpen, spawnTrayOpen, sheetRow, commanderSheetOpen, interaction.mode]);

  const matchCommanderChip = model.matchCommander;
  const commanderListRow = matchCommanderChip
    ? commandersQuery.data?.commanders.find((row) => row.id === matchCommanderChip.id)
    : undefined;
  const commanderSheetState: ActorRungState | null =
    commanderListRow && matchCommanderChip
      ? { kind: "ready", data: adaptCommanderSheet(commanderListRow, playerId) }
      : null;

  async function handleCommanderSetDefault(commanderId: string) {
    await setDefaultCommander.mutateAsync(commanderId);
  }

  useEffect(() => {
    if (!matchCommanderChip) setCommanderSheetOpen(false);
  }, [matchCommanderChip]);

  const cellTiles =
    hasCell &&
    (interaction.mode === "TileSelected" || interaction.mode === "SpawnTargeting")
      ? tilesAt(model, targetRow, targetCol)
      : [];
  const busy = spawnExtra.isPending || debugPost.isPending;

  const changeViewMode = (mode: LawnViewMode) => {
    setViewMode(mode);
    saveLawnViewMode(mode);
    if (
      isLargeCanvas(mode) &&
      !isLargeCanvas(viewMode) &&
      !userClosedStats.current
    ) {
      setStatsOpen(true);
    }
  };

  const clearMsgs = () => {
    setActionError(null);
    setActionOk(null);
  };

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    clearMsgs();
    try {
      await fn();
      setActionOk(label);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const enterTargeting = () => {
    clearMsgs();
    setInteraction((prev) =>
      reduceInteraction(prev, { type: "enterSpawnTargeting" }, model.phase)
    );
  };

  // T22 — deploying a real, player-owned creature (Creatures layer's "Deploy to the lawn"),
  // distinct from the debug Spawn panel below: reuses the same SpawnTargeting FSM and the same
  // ghost-preview board (interactionMode.ts, LawnWorldScene) rather than inventing a second one,
  // but confirms through the real `useDeployUniqueActor` endpoint instead of the debug intent
  // paths — nothing is spent and no occupant exists until the server actually admits it (the
  // mutation only invalidates on success; there is no optimistic write to react to before that).
  const [searchParams, setSearchParams] = useSearchParams();
  const deployInstanceId = searchParams.get("deploy");
  const deployActorQ = useUniqueActor(deployInstanceId);
  // UniqueActorDto has no resolved display name (T4/T8's honest-Pending precedent — names
  // resolve from the almanac catalog, not wired to any reader yet); build the label from what's
  // actually real (side, typeId, level) rather than fabricating one.
  const deployActor = deployActorQ.data;
  const deployActorName = deployActor
    ? `${deployActor.side === "zombie" ? "zombie" : "plant"} #${deployActor.typeId} (Lv ${deployActor.level})`
    : "your creature";
  const deployMutation = useDeployUniqueActor();

  const clearDeploy = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("deploy");
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    if (!deployInstanceId) return;
    setInteraction((prev) =>
      reduceInteraction(prev, { type: "enterSpawnTargeting" }, model.phase)
    );
    // Only re-arm when the target itself changes — model.phase changes on every board tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployInstanceId]);

  // Esc precedence (lawn-interactive §10.1): cancel armed order → pop sheet → pop dock/tray.
  // claimStageEscape pushes LIFO — register lower layers first so ActionTargeting is topmost.
  useEffect(() => {
    if (!dockOpen) return undefined;
    return claimStageEscape("lawn-occupancy-dock", () => {
      setDockSelectionKey(null);
      setSheetRow(null);
      setInteraction(idleInteraction());
    });
  }, [dockOpen]);

  useEffect(() => {
    if (!spawnTrayOpen) return undefined;
    return claimStageEscape("lawn-spawn-tray", () => {
      setSpawnTrayOpen(false);
      setInteraction((prev) => reduceInteraction(prev, { type: "cancelArmed" }, model.phase));
    });
  }, [spawnTrayOpen, model.phase]);

  useEffect(() => {
    if (!sheetRow) return undefined;
    return claimStageEscape("lawn-actor-sheet", () => setSheetRow(null));
  }, [sheetRow]);

  useEffect(() => {
    if (!commanderSheetOpen) return undefined;
    return claimStageEscape("lawn-commander-sheet", () => setCommanderSheetOpen(false));
  }, [commanderSheetOpen]);

  useEffect(() => {
    if (interaction.mode !== "ActionTargeting" && interaction.mode !== "SpawnTargeting") {
      return undefined;
    }
    // Deploy URL path owns its own Esc claim; Field tray uses lawn-spawn-tray above.
    if (deployInstanceId || spawnTrayOpen) return undefined;
    return claimStageEscape("lawn-armed-order", () => {
      setArmedOrderId(null);
      setInteraction((prev) => reduceInteraction(prev, { type: "cancelArmed" }, model.phase));
    });
  }, [interaction.mode, deployInstanceId, spawnTrayOpen, model.phase]);

  useEffect(() => {
    if (!deployInstanceId) return undefined;
    return claimStageEscape("lawn-deploy-targeting", cancelDeploy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployInstanceId]);

  const confirmDeploy = () => {
    if (!deployInstanceId || !hasCell) return;
    void runAction(`Deployed ${deployActorName}`, async () => {
      await deployMutation.mutateAsync({
        instanceId: deployInstanceId,
        col: targetCol,
        row: targetRow,
        matchKey: model.matchKey ?? undefined
      });
      clearDeploy();
      setInteraction(idleInteraction());
    });
  };

  const cancelDeploy = () => {
    clearMsgs();
    clearDeploy();
    setInteraction(idleInteraction());
  };

  // creature-lawn-deploy T2.4 — a server-fired "reinforcements available" trigger (lawn-deploy-events'
  // own evaluator), distinct from T22's own player-INITIATED deploy above: no cell-targeting, the
  // server picks the spawn side/typeId from the specimen's own species (lawn-deploy-core). Stage
  // chrome, same "no scrim, inline banner" convention as the T22 banner — this is a live-match
  // reaction, blocking the board with a Dialog would hide the exact thing the player needs to see.
  const [respondedLawnDeployCaseId, setRespondedLawnDeployCaseId] = useState<string | null>(null);
  const pendingLawnDeploy = model.pendingLawnDeploy;
  useEffect(() => {
    // A new match can legitimately fire the same caseId again — the "already responded" memory is
    // per-match, matching how pendingLawnDeploy itself resets on the fold's own board.start.
    setRespondedLawnDeployCaseId(null);
  }, [model.matchKey]);
  const showLawnDeployPrompt =
    !!pendingLawnDeploy && pendingLawnDeploy.caseId !== respondedLawnDeployCaseId;
  const lawnDeployRosterQ = useCreatureRoster(playerId);
  const speciesIndex = useSpeciesIndex();
  const lawnDeployMutation = useDeployUniqueActor();
  const lawnDeployEligible = useMemo(() => {
    if (!pendingLawnDeploy) return [];
    const bySpecimenId = new Map(
      (lawnDeployRosterQ.data?.items ?? []).map((it) => [it.actor.instanceId, it] as const)
    );
    return pendingLawnDeploy.eligibleInstanceIds
      .map((id) => bySpecimenId.get(id))
      .filter((it): it is NonNullable<typeof it> => !!it);
  }, [pendingLawnDeploy, lawnDeployRosterQ.data]);

  const dismissLawnDeployPrompt = () => {
    if (pendingLawnDeploy) setRespondedLawnDeployCaseId(pendingLawnDeploy.caseId);
  };

  const acceptLawnDeployPrompt = (instanceId: string) => {
    if (!pendingLawnDeploy) return;
    const caseId = pendingLawnDeploy.caseId;
    void runAction("Deployed reinforcement", async () => {
      await lawnDeployMutation.mutateAsync({
        instanceId,
        correlationId: newCorrelationId(),
        matchKey: model.matchKey ?? undefined
      });
      setRespondedLawnDeployCaseId(caseId);
    });
  };

  const enqueueIntentSpawn = () => {
    if (!hasCell) {
      setActionError("Select a cell first (Target cell, then click a tile).");
      setActionOk(null);
      return;
    }
    void runAction("Intent spawn enqueued", () =>
      spawnExtra.mutateAsync({
        typeId: spawnTypeId,
        row: targetRow,
        col: targetCol,
        side: spawnSide,
        reason: "lawn-w7"
      })
    );
  };

  const debugCellSpawn = () => {
    if (!hasCell) {
      setActionError("Select a cell first.");
      setActionOk(null);
      return;
    }
    const path = spawnSide === "plant" ? "spawn-plant" : "spawn-zombie";
    void runAction(`Debug ${path} enqueued`, async () => {
      await debugPost.mutateAsync({
        path: "spawn-cell",
        body: { row: targetRow, col: targetCol }
      });
      await debugPost.mutateAsync({
        path,
        body: { typeId: spawnTypeId }
      });
    });
  };

  const combatHitSelected = () => {
    if (!selected?.ptr) return;
    void runAction("Fire-synthetic enqueued", async () => {
      await debugPost.mutateAsync({
        path: "select",
        body: { ptr: selected.ptr, side: selected.side }
      });
      await debugPost.mutateAsync({
        path: "effect/fire-synthetic",
        body: { trigger: "OnDamageDealt", side: "plant", targetPtr: selected.ptr }
      });
    });
  };

  const combatDeltaSelected = () => {
    if (!selected?.ptr) return;
    void runAction("Enqueue-delta enqueued", async () => {
      await debugPost.mutateAsync({
        path: "select",
        body: { ptr: selected.ptr, side: selected.side }
      });
      await debugPost.mutateAsync({
        path: "effect/enqueue-delta",
        body: { amount: -50, targetPtr: selected.ptr }
      });
    });
  };

  const probeShaders = () => {
    void runAction("Shader probe enqueued", async () => {
      await debugPost.mutateAsync({ path: "fx/probe-shaders", body: {} });
    });
  };

  const cellFlash = () => {
    if (!hasCell) {
      setActionError("Select a cell first.");
      setActionOk(null);
      return;
    }
    void runAction("Cell flash enqueued", async () => {
      await debugPost.mutateAsync({
        path: "fx/world-flash",
        body: { row: targetRow, col: targetCol }
      });
    });
  };

  const killSelected = () => {
    if (!selected?.ptr) return;
    const path = selected.side === "plant" ? "kill-plant" : "kill";
    void runAction("Kill enqueued", async () => {
      await debugPost.mutateAsync({
        path: "select",
        body: { ptr: selected.ptr, side: selected.side }
      });
      await debugPost.mutateAsync({
        path,
        body: { target: "selected", ptr: selected.ptr }
      });
    });
  };

  const applyStatus = () => {
    if (!selected?.ptr || selected.side !== "zombie") {
      setActionError("Apply status requires a selected zombie.");
      setActionOk(null);
      return;
    }
    void runAction("Apply status enqueued", () =>
      debugPost.mutateAsync({
        path: "apply-status",
        body: {
          status: statusName,
          duration: 4,
          level: 1,
          ptr: selected.ptr,
          target: "ptr"
        }
      })
    );
  };

  const clearStatus = () => {
    if (!selected?.ptr || selected.side !== "zombie") {
      setActionError("Clear status requires a selected zombie.");
      setActionOk(null);
      return;
    }
    void runAction("Clear status enqueued", () =>
      debugPost.mutateAsync({
        path: "clear-status",
        body: { ptr: selected.ptr, target: "ptr" }
      })
    );
  };

  const inspector = (
    <Panel title="Inspector" testId="panel-lawn-inspector">
      <KeyValue
        items={[
          { label: "Match", value: model.matchKey ?? "—" },
          { label: "Phase", value: model.phase },
          { label: "Level", value: model.levelName ?? "—" },
          { label: "Result", value: model.result ?? "—" },
          { label: "Revision", value: String(model.revision) },
          { label: "Living", value: String(livingCount) },
          {
            label: "Canvas",
            value: `${canvasCount} / ${livingCount}`
          },
          {
            label: "Economy",
            value: model.economy
              ? `sun ${model.economy.sun ?? "?"} · money ${model.economy.money ?? "?"} · wave ${model.economy.wave ?? "?"}${model.economy.hugeWave ? " · huge" : ""}`
              : "—"
          },
          {
            label: "Hand",
            value: model.hand.length
              ? model.hand
                  .map((c) => c.typeName ?? `#${c.typeId ?? "?"}`)
                  .join(", ")
              : "—"
          },
          {
            label: "Travel",
            value: model.travelBuffs.length
              ? model.travelBuffs.map((b) => `${b.kind}:${b.name}`).join(", ")
              : "—"
          },
          {
            label: "Last action",
            value: model.lastAction
              ? `${model.lastAction.kind} ${model.lastAction.summary}`
              : "—"
          },
          {
            label: "Last hit",
            value: formatLastHit(chrome.lastHit)
          },
          {
            label: "Invade",
            value: model.lastInvade
              ? `${model.lastInvade.typeName ?? model.lastInvade.ptr}`
              : "—"
          },
          { label: "Mode", value: interaction.mode }
        ]}
      />
      <LawnScreenshotPanel />

      {(interaction.mode === "TileSelected" ||
        interaction.mode === "SpawnTargeting") &&
      hasCell ? (
        <div className="mt-3" data-testid="lawn-tile-sel">
          <p className="text-sm text-muted">
            Cell ({targetRow}, {targetCol})
            {interaction.mode === "SpawnTargeting" ? " · targeting" : ""}
          </p>
          {cellTiles.length ? (
            <KeyValue
              items={cellTiles.map((t) => ({
                label: t.typeName ?? `grid #${t.typeId}`,
                value: t.ptr
              }))}
            />
          ) : (
            <p className="mt-1 text-xs text-muted">No grid item on this cell.</p>
          )}
        </div>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-border pt-3" data-testid="lawn-spawn-panel">
        <p className="text-sm font-semibold text-text">Spawn</p>
        <Field label="Side">
          <Select
            value={spawnSide}
            onChange={(e) =>
              setSpawnSide(e.target.value === "plant" ? "plant" : "zombie")
            }
            data-testid="lawn-spawn-side"
          >
            <option value="zombie">zombie</option>
            <option value="plant">plant</option>
          </Select>
        </Field>
        <Field label="typeId">
          <NumberInput
            value={spawnTypeId}
            onChange={(v) => setSpawnTypeId(Number.isFinite(v) ? v : 0)}
            data-testid="lawn-spawn-typeid"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canSpawn || busy}
            title={busy ? "Working…" : !canSpawn ? `Spawn targeting disabled in ${model.phase}` : undefined}
            onClick={enterTargeting}
            data-testid="lawn-target-cell"
          >
            Target cell
          </Button>
          <Button
            size="sm"
            disabled={!canSpawn || busy || !hasCell}
            title={
              busy
                ? "Working…"
                : !canSpawn
                  ? `Spawn targeting disabled in ${model.phase}`
                  : !hasCell
                    ? "Target a cell first"
                    : undefined
            }
            onClick={enqueueIntentSpawn}
            data-testid="lawn-intent-spawn"
          >
            Enqueue Intent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canSpawn || busy || !hasCell}
            title={
              busy
                ? "Working…"
                : !canSpawn
                  ? `Spawn targeting disabled in ${model.phase}`
                  : !hasCell
                    ? "Target a cell first"
                    : undefined
            }
            onClick={debugCellSpawn}
            data-testid="lawn-debug-spawn"
          >
            Debug spawn
          </Button>
        </div>
        {!canSpawn ? (
          <HelpText>Spawn targeting disabled in {model.phase}.</HelpText>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-3" data-testid="lawn-overlay-fx">
        <p className="text-sm font-semibold text-text">Overlay FX</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            title={busy ? "Working…" : undefined}
            onClick={probeShaders}
            data-testid="lawn-probe-shaders"
          >
            Probe shaders
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || !hasCell}
            title={busy ? "Working…" : !hasCell ? "Target a cell first" : undefined}
            onClick={cellFlash}
            data-testid="lawn-cell-flash"
          >
            Cell flash
          </Button>
        </div>
        <HelpText>
          World quad at the selected cell. HP still uses overlay hit / HP −50.
        </HelpText>
      </div>

      {selected ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3" data-testid="lawn-occupant-sel">
          <div className="flex items-center gap-2">
            <TypeIcon side={selected.side} typeId={selected.typeId} size={48} />
            <div>
              <p className="font-semibold text-text">
                {selected.typeName ?? selected.side} #{selected.typeId}
              </p>
              <p className="font-mono text-xs text-muted">{selected.ptr}</p>
            </div>
          </div>
          {selected.hud ? <ActorHudInspector hud={selected.hud} /> : null}
          <KeyValue
            items={[
              {
                label: "Cell",
                value:
                  selected.row != null && selected.col != null
                    ? `${selected.row}, ${selected.col}`
                    : "orphan"
              },
              {
                label: "HP",
                value:
                  selected.hp != null
                    ? `${selected.hp}/${selected.maxHp ?? "?"}`
                    : "—"
              },
              {
                label: "ATK",
                value: selected.atk != null ? String(selected.atk) : "—"
              },
              {
                label: "Armor",
                value:
                  selected.armor != null
                    ? `${selected.armor}/${selected.armorMax ?? "?"}`
                    : "—"
              },
              {
                label: "Armor2",
                value:
                  selected.armor2 != null
                    ? `${selected.armor2}/${selected.armor2Max ?? "?"}`
                    : "—"
              },
              ...(selected.hud
                ? []
                : [
                    {
                      label: "Shield",
                      value:
                        selected.rpgShield != null
                          ? `${selected.rpgShield}/${selected.rpgShieldMax ?? "?"}`
                          : "—"
                    }
                  ]),
              {
                label: "Speed",
                value: selected.speed != null ? String(selected.speed) : "—"
              },
              {
                label: "Interval",
                value: selected.interval != null ? String(selected.interval) : "—"
              },
              ...(selected.hud
                ? []
                : [
                    {
                      label: "Chips",
                      value: selected.statusChips.length
                        ? selected.statusChips.join(", ")
                        : "—"
                    }
                  ]),
              {
                label: "instanceId",
                value: selected.instanceId ?? "binding unknown/stale"
              },
              {
                label: "Hypno",
                value: selected.flags.hypnotized ? "yes" : "no"
              },
              {
                label: "Flags",
                value: [
                  selected.flags.mixed ? "mix" : null,
                  selected.flags.unique ? "unique" : null,
                  selected.flags.crashed ? "crash" : null
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            ]}
          />

          {selected.instanceId ? (
            <div className="space-y-1" data-testid="lawn-bound-observe">
              {uniqueQ.data ? (
                <>
                  <Badge tone="ok">Bound</Badge>
                  <KeyValue
                    items={[
                      { label: "Cold phase", value: uniqueQ.data.phase },
                      { label: "Cold side", value: uniqueQ.data.side },
                      {
                        label: "Cold typeId",
                        value: String(uniqueQ.data.typeId)
                      },
                      {
                        label: "Level",
                        value: String(uniqueQ.data.level)
                      }
                    ]}
                  />
                </>
              ) : uniqueQ.isFetching ? (
                <p className="text-sm text-muted">Loading Cold UniqueActor…</p>
              ) : (
                <p className="text-sm text-muted" data-testid="lawn-bound-stale">
                  Binding unknown/stale (no UniqueActor for instanceId).
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2" data-testid="lawn-occupant-actions">
            <p className="text-sm font-semibold text-text">Occupant actions</p>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              title={busy ? "Working…" : undefined}
              onClick={killSelected}
              data-testid="lawn-kill"
            >
              Kill
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              title={busy ? "Working…" : undefined}
              onClick={combatHitSelected}
              data-testid="lawn-combat-hit"
            >
              Overlay hit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              title={busy ? "Working…" : undefined}
              onClick={combatDeltaSelected}
              data-testid="lawn-combat-delta"
            >
              HP −50
            </Button>
            {selected.side === "zombie" ? (
              <>
                <Field label="Status">
                  <TextInput
                    value={statusName}
                    onChange={(e) => setStatusName(e.target.value)}
                    data-testid="lawn-status-name"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    title={busy ? "Working…" : undefined}
                    onClick={applyStatus}
                    data-testid="lawn-apply-status"
                  >
                    Apply status
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    title={busy ? "Working…" : undefined}
                    onClick={clearStatus}
                    data-testid="lawn-clear-status"
                  >
                    Clear status
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : selectedMarker ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3" data-testid="lawn-marker-sel">
          <p className="font-semibold text-text">
            {selectedMarker.kind} {selectedMarker.typeName ?? `#${selectedMarker.typeId}`}
          </p>
          <KeyValue
            items={[
              { label: "ptr", value: selectedMarker.ptr },
              {
                label: "Cell",
                value:
                  selectedMarker.row != null
                    ? `${selectedMarker.row}, ${selectedMarker.col ?? "—"}`
                    : "orphan"
              },
              {
                label: "Started",
                value: selectedMarker.started ? "yes" : "no"
              }
            ]}
          />
        </div>
      ) : interaction.mode === "TileSelected" ||
        interaction.mode === "SpawnTargeting" ? null : (
        <p className="mt-3 text-sm text-muted" data-testid="lawn-inspector-empty">
          Select a tile or occupant on the lawn.
        </p>
      )}

      <LawnOccupantList
        living={living}
        onCanvasPtrs={canvasPtrs}
        selectedPtr={interaction.ptr}
        onSelect={(occ) =>
          setInteraction((prev) =>
            reduceInteraction(
              prev,
              {
                type: "selectOccupant",
                ptr: occ.ptr,
                row: occ.row,
                col: occ.col
              },
              model.phase
            )
          )
        }
      />
    </Panel>
  );

  const canvas = (
    <Panel title="Projector" testId="panel-lawn-canvas">
      <LawnGameHost
        model={model}
        interaction={interaction}
        viewMode={viewMode}
        onSelect={onSelect}
      />
      <HelpText className="mt-2">
        Click a tile or occupant. Use Target cell + Spawn in the inspector for
        Intent enqueue.
      </HelpText>
      {large && !inspectorOpen ? (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="lawn-action-strip">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setInspectorOpen(true)}
            data-testid="lawn-open-inspector"
          >
            Inspector
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canSpawn || busy}
            title={busy ? "Working…" : !canSpawn ? `Spawn targeting disabled in ${model.phase}` : undefined}
            onClick={enterTargeting}
          >
            Target cell
          </Button>
          <Button
            size="sm"
            disabled={!canSpawn || busy || !hasCell}
            title={
              busy
                ? "Working…"
                : !canSpawn
                  ? `Spawn targeting disabled in ${model.phase}`
                  : !hasCell
                    ? "Target a cell first"
                    : undefined
            }
            onClick={enqueueIntentSpawn}
          >
            Enqueue Intent
          </Button>
        </div>
      ) : null}
    </Panel>
  );

  const devToolbarAndInspector = (
    <>
      <div className="mb-3 flex flex-wrap gap-2" data-testid="lawn-view-toolbar">
        {VIEW_MODES.map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={viewMode === mode ? "primary" : "ghost"}
            aria-pressed={viewMode === mode}
            onClick={() => changeViewMode(mode)}
            data-testid={`lawn-view-${mode}`}
          >
            {mode === "split" ? "Split" : mode === "large" ? "Large" : "Stack"}
          </Button>
        ))}
        <Button
          size="sm"
          variant={statsOpen ? "primary" : "ghost"}
          onClick={() =>
            setStatsOpen((v) => {
              const next = !v;
              userClosedStats.current = !next;
              return next;
            })
          }
          data-testid="lawn-stats-toggle"
        >
          Stats
        </Button>
        {large ? (
          <Button
            size="sm"
            variant={inspectorOpen ? "primary" : "ghost"}
            onClick={() => setInspectorOpen((v) => !v)}
            data-testid="lawn-inspector-toggle"
          >
            Inspector
          </Button>
        ) : null}
      </div>
      <Banner tone="info" className="mb-3">
        Living set is folded from hub events / debug snapshots — not from Activity
        rollups. Mutations enqueue only; Server/Injector Admit gates apply.
      </Banner>
      {viewMode === "split" ? (
        <Split
          className="lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,24rem)]"
          list={canvas}
          detail={inspector}
        />
      ) : (
        <>
          {canvas}
          {inspectorOpen ? (
            <div
              className="band-panel fixed inset-0 bg-black/40"
              data-testid="lawn-inspector-drawer-backdrop"
              onClick={() => setInspectorOpen(false)}
            >
              <div
                className={cn(
                  "absolute inset-y-0 right-0 w-full max-w-md overflow-auto border-l border-border bg-panel p-3 shadow-panel"
                )}
                data-testid="lawn-inspector-drawer"
                onClick={(e) => e.stopPropagation()}
              >
                {inspector}
              </div>
            </div>
          ) : null}
        </>
      )}
      <LawnStatsModal
        open={statsOpen}
        model={chrome}
        canvasCount={canvasCount}
        onClose={() => {
          userClosedStats.current = true;
          setStatsOpen(false);
        }}
      />
    </>
  );

  return (
    <>
    <Page
      testId="page-lawn"
      title="Lawn"
      description={devMode ? "Observe projector + Intent/debug enqueue — never FE Admit or optimistic living." : undefined}
      className={devMode && large ? "max-w-none" : "max-w-[1600px]"}
      actions={
        devMode ? (
          <>
            <Badge tone={model.phase === "InMatch" ? "ok" : "neutral"}>{model.phase}</Badge>
            <Badge tone="neutral">canvas {canvasCount} / living {livingCount}</Badge>
          </>
        ) : undefined
      }
    >
      <LawnMatchHud
        sun={model.economy?.sun}
        wave={model.economy?.wave}
        maxWave={model.economy?.maxWave}
        hugeWave={model.economy?.hugeWave}
        phase={model.phase}
        connection={connection}
        selectionLabel={selectionLabel}
        matchCommander={matchCommanderChip}
        deployed={deployedChips}
        onOpenCommanderSheet={
          matchCommanderChip && commanderListRow ? () => setCommanderSheetOpen(true) : undefined
        }
        onField={() => {
          setSpawnTrayOpen(true);
          setInteraction((prev) => reduceInteraction(prev, { type: "enterSpawnTargeting" }, model.phase));
        }}
      />

      {recoveryMessage ? (
        <Banner
          tone={recoveryTone}
          className="mb-3"
          data-testid={`lawn-recovery-${recovery.kind}`}
        >
          {recoveryMessage}
        </Banner>
      ) : null}

      <div className="flex min-h-0 items-stretch gap-0" data-testid="lawn-board-chrome">
        <CellOccupancyDock
          open={dockOpen}
          occupants={cellOccupants}
          cellLabel={selectionLabel ?? "Cell"}
          selectionKey={dockSelectionKey}
          onClose={() => {
            setDockSelectionKey(null);
            setSheetRow(null);
            setInteraction(idleInteraction());
          }}
          onSelectRow={(row) => {
            setDockSelectionKey(row.key);
            setSheetRow(row);
            logLawnInteractive("sheet.push", { key: row.key, sel: encodeLawnSel(row) });
            if (row.instanceId) {
              setSearchParams((p) => {
                const next = new URLSearchParams(p);
                if (hasCell && targetRow != null && targetCol != null) {
                  next.set("cell", `${targetRow},${targetCol}`);
                }
                next.set("sel", row.instanceId!);
                return next;
              });
            }
          }}
        />
        <SpawnTray
          open={spawnTrayOpen}
          entries={spawnTrayEntries}
          canSpawn={canSpawn}
          lockedReason={!canSpawn ? `Fielding is unavailable in ${model.phase}` : undefined}
          onClose={() => {
            setSpawnTrayOpen(false);
            setInteraction((prev) => reduceInteraction(prev, { type: "cancelArmed" }, model.phase));
          }}
          onPick={(instanceId) => {
            setSpawnTrayOpen(false);
            navigate(`/lawn?deploy=${encodeURIComponent(instanceId)}`);
          }}
        />
        <div className="min-w-0 flex-1" style={dockOpen || spawnTrayOpen ? { marginLeft: 0 } : undefined}>

      {actionError ? (
        <Banner tone="error" className="mb-3" data-testid="lawn-action-error">
          {actionError}
        </Banner>
      ) : null}
      {actionOk ? (
        <Banner tone="info" className="mb-3" data-testid="lawn-action-ok">
          {actionOk}
        </Banner>
      ) : null}
      {deployInstanceId ? (
        // Stage chrome (plate 07 §B): no scrim, the board stays fully visible and interactive
        // underneath — this is an inline banner, never a Dialog/layer. Unconditional — deploying a
        // real, owned creature (T22) is a player feature, not diagnostic tooling.
        <Banner tone="info" className="mb-3 flex flex-wrap items-center justify-between gap-2" data-testid="lawn-deploy-banner">
          <span>
            Choosing a place for {deployActorName}
            {hasCell ? ` — cell (${targetRow}, ${targetCol})` : ""}
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancelDeploy} data-testid="lawn-deploy-cancel">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!hasCell || deployMutation.isPending}
              title={deployMutation.isPending ? "Deploying…" : !hasCell ? "Click a cell on the board first" : undefined}
              onClick={confirmDeploy}
              data-testid="lawn-deploy-confirm"
            >
              Deploy here
            </Button>
          </span>
        </Banner>
      ) : null}
      {showLawnDeployPrompt && pendingLawnDeploy ? (
        <Banner
          tone="info"
          className="mb-3 flex flex-wrap items-center justify-between gap-2"
          data-testid="lawn-deploy-event-banner"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span>Reinforcements available —</span>
            {lawnDeployEligible.length === 0 ? (
              <span>no eligible creature found</span>
            ) : (
              lawnDeployEligible.map((it) => {
                const species = speciesIndex.get(it.profile.speciesId);
                return (
                  <Button
                    key={it.actor.instanceId}
                    size="sm"
                    variant="ghost"
                    disabled={lawnDeployMutation.isPending}
                    title={lawnDeployMutation.isPending ? "Deploying…" : undefined}
                    onClick={() => acceptLawnDeployPrompt(it.actor.instanceId)}
                    data-testid="lawn-deploy-event-accept"
                  >
                    {species ? (
                      <TypeIcon side={species.side} typeId={species.gameTypeId} size={20} />
                    ) : null}
                    {species?.name ?? it.profile.speciesId}
                  </Button>
                );
              })
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={dismissLawnDeployPrompt}
            data-testid="lawn-deploy-event-dismiss"
          >
            Dismiss
          </Button>
        </Banner>
      ) : null}

      {devMode ? (
        devToolbarAndInspector
      ) : (
        <div data-testid="lawn-canvas-plain">
          <LawnGameHost model={model} interaction={interaction} viewMode="stack" onSelect={onSelect} />
        </div>
      )}

      <CommanderActionBar
        slots={[]}
        armedId={armedOrderId}
        onArm={(slot) => {
          setArmedOrderId(slot.id);
          setInteraction((prev) =>
            reduceInteraction(prev, { type: "enterActionTargeting", actionId: slot.id }, model.phase)
          );
        }}
      />
        </div>
      </div>
    </Page>

    {sheetRow?.instanceId ? (
      <ActorPanel
        state={
          uniqueQ.data
            ? { kind: "ready", data: adaptActor(uniqueQ.data) }
            : selected?.instanceId === sheetRow.instanceId && uniqueQ.isLoading
              ? { kind: "loading" }
              : { kind: "empty" }
        }
        open={Boolean(sheetRow)}
        onOpenChange={(open) => {
          if (!open) setSheetRow(null);
        }}
        role="creature"
      />
    ) : null}

    {commanderSheetState && commanderListRow && matchCommanderChip ? (
      <ActorPanel
        state={commanderSheetState}
        open={commanderSheetOpen}
        onOpenChange={setCommanderSheetOpen}
        role="commander"
        matchBanner={{
          displayName: matchCommanderChip.displayName,
          auraDisplayName: matchCommanderChip.auraDisplayName
        }}
        commanderMeta={{
          isDefault: commanderListRow.isDefault,
          activeAuraName: commanderListRow.activeAuraName,
          locationStub: commanderListRow.locationStub,
          legionStub: commanderListRow.legionStub
        }}
        setDefaultPending={setDefaultCommander.isPending}
        onSetDefault={() => void handleCommanderSetDefault(commanderListRow.id)}
        onDefendLawn={() => setCommanderSheetOpen(false)}
        onOpenCommandersList={() => {
          setCommanderSheetOpen(false);
          navigate(`/sanctum?panel=commanders&sel=${encodeURIComponent(commanderListRow.id)}`);
        }}
      />
    ) : null}
    </>
  );
}
