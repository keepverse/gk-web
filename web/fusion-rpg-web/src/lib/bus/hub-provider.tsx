import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getHubConnection } from "./hub";
import { keysForEventKind } from "./invalidate";
import {
  appendLogEvent,
  appendLogEvents,
  beginLawnRecovery,
  markLawnRecoverySnapshot,
  markLawnRecoveryStatus,
  type LawnRecoveryStatus
} from "./log-store";
import { queryKeys } from "./keys";
import type { EventEnvelope, HealthDto, HubStatus } from "./types";
import { mergeCheatsPreservingDirty } from "./cheat-dirty";
import { bumpIconEpoch } from "./icon-epoch";
import { joinShownPlayer } from "./playerRouting";
import type { CheatSnapshot } from "./types";

const HubStatusContext = createContext<HubStatus>("off");

export function useHubStatus(): HubStatus {
  return useContext(HubStatusContext);
}

export function HubProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HubStatus>("off");
  const qc = useQueryClient();

  useEffect(() => {
    const c = getHubConnection();

    const invalidateRecoveryQueries = () => {
      for (const key of queryKeys.allSnapshots) {
        void qc.invalidateQueries({ queryKey: key });
      }
      // Match bindings and the cold actor surfaces are dependent reads, not part of the
      // snapshot event itself. Refetch them at the recovery edge so a stale id cannot survive it.
      for (const key of [
        ["pvzActivity"],
        ["pvzActivityFacts"],
        ["uniqueActor"],
        ["uniqueActors"],
        ["creatureRoster"],
        ["commanders"],
        ["speciesIndex"]
      ] as const) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };

    const beginRecovery = (reason: "entry" | "reconnect") => {
      beginLawnRecovery(reason);
      invalidateRecoveryQueries();
    };

    const consumeEvent = (e: EventEnvelope) => {
      if (e.kind === "debug.snapshot") markLawnRecoverySnapshot(e);
    };

    const onEvent = (e: EventEnvelope) => {
      appendLogEvent(e);
      consumeEvent(e);
      for (const key of keysForEventKind(e.kind)) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };

    const onBatch = (batch: { events?: EventEnvelope[] }) => {
      const items = batch?.events ?? [];
      if (!items.length) return;
      appendLogEvents(items);
      const seen = new Set<string>();
      for (const e of items) {
        consumeEvent(e);
        for (const key of keysForEventKind(e.kind)) {
          const id = JSON.stringify(key);
          if (seen.has(id)) continue;
          seen.add(id);
          void qc.invalidateQueries({ queryKey: key });
        }
      }
    };

    const onLawnRecovery = (next: LawnRecoveryStatus | null | undefined) => {
      markLawnRecoveryStatus(next);
      if (next?.state === "ready" || next?.state === "error") {
        invalidateRecoveryQueries();
      }
    };

    const onHealth = (h: HealthDto) => {
      qc.setQueryData(queryKeys.health, h);
    };

    const onCheatsUpdated = (snap: unknown) => {
      if (!snap || typeof snap !== "object") return;
      const local = qc.getQueryData<CheatSnapshot>(queryKeys.cheats);
      qc.setQueryData(
        queryKeys.cheats,
        mergeCheatsPreservingDirty(snap as Record<string, unknown>, local)
      );
    };

    const onPvzStatsUpdated = (sheet: { playerId?: number } | null) => {
      if (sheet?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.pvzStats(sheet.playerId) });
      }
      void qc.invalidateQueries({ queryKey: ["pvzStats"] });
      void qc.invalidateQueries({ queryKey: ["pvzStatsChannel"] });
    };

    const onPvzActivityUpdated = (rollup: { playerId?: number } | null) => {
      if (rollup?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.pvzActivity(rollup.playerId) });
        void qc.invalidateQueries({ queryKey: queryKeys.pvzActivityFacts(rollup.playerId) });
      }
      void qc.invalidateQueries({ queryKey: ["pvzActivity"] });
      void qc.invalidateQueries({ queryKey: ["pvzActivityFacts"] });
      // Soul earns ride the fact transaction (spec-soul-economy) — refresh balances with facts.
      void qc.invalidateQueries({ queryKey: ["souls"] });
      void qc.invalidateQueries({ queryKey: ["creatureSummonState"] });
    };

    const onRpgProgressionUpdated = (msg: { playerId?: number } | null) => {
      if (msg?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.rpgProgressionSummary(msg.playerId) });
        void qc.invalidateQueries({ queryKey: queryKeys.rpgProgressionStats(msg.playerId) });
        void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger", msg.playerId] });
        void qc.invalidateQueries({ queryKey: ["rpgProgressionActors", msg.playerId] });
        void qc.invalidateQueries({ queryKey: ["rpgProgressionActor", msg.playerId] });
      }
      void qc.invalidateQueries({ queryKey: ["rpgProgressionSummary"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionStats"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActors"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActor"] });
    };

    const onTypeIconUpdated = () => {
      bumpIconEpoch();
      void qc.invalidateQueries({ queryKey: ["iconDumps"] });
    };

    const onCreaturesUpdated = () => {
      void qc.invalidateQueries({ queryKey: ["creatureRoster"] });
      void qc.invalidateQueries({ queryKey: ["creatureCodex"] });
      void qc.invalidateQueries({ queryKey: ["creatureSummonState"] });
      // Expeditions ride specimen state: locks, wild-join mints, and materials all land here.
      void qc.invalidateQueries({ queryKey: ["expeditions"] });
      void qc.invalidateQueries({ queryKey: ["creatureMaterials"] });
    };

    const onSoulsUpdated = () => {
      void qc.invalidateQueries({ queryKey: ["souls"] });
      void qc.invalidateQueries({ queryKey: ["creatureSummonState"] });
    };

    const onAlmanacTextUpdated = () => {
      void qc.invalidateQueries({ queryKey: ["almanacDumps"] });
      // Promoted fields land on progression actor DTOs + types catalog.
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActors"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActor"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionSummary"] });
      void qc.invalidateQueries({ queryKey: ["types"] });
    };

    const onCommandersUpdated = (msg: { playerId?: number } | null) => {
      if (msg?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.commanders(msg.playerId) });
      }
      void qc.invalidateQueries({ queryKey: ["commanders"] });
    };

    // species-build-todo.md T5.1 — real gap found and fixed while wiring the species-build panel:
    // the SERVER has broadcast "AptitudesUpdated" since `creature-type-allocation` (module 5) shipped,
    // but nothing on the web side ever subscribed to it (confirmed by direct grep across this whole
    // assembly). Every `useAptitudes`/species-aptitudes query relied entirely on its own
    // `refetchInterval` fallback, which is disabled whenever the hub IS connected — so a commander or
    // species allocation change from ANOTHER client (e.g. the injector reloading it) never live-
    // updated a connected web client. Mirrors `onCommandersUpdated`'s exact shape: player-scoped when
    // the payload carries one, plus a bare invalidation so an unscoped broadcast still refreshes.
    const onAptitudesUpdated = (msg: {
      playerId?: number;
      scope?: string;
      instanceId?: string | null;
      speciesId?: string | null;
    } | null) => {
      if (msg?.scope === "unique" && msg.instanceId) {
        void qc.invalidateQueries({ queryKey: queryKeys.uniqueAptitudes(msg.instanceId) });
      }
      if (msg?.scope === "species" && msg.playerId != null && msg.speciesId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.speciesAptitudes(msg.playerId, msg.speciesId)
        });
      }
      if (msg?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.aptitudes(msg.playerId) });
      }
      // Legacy thin { playerId } / unscoped: refresh all aptitude query families
      void qc.invalidateQueries({ queryKey: ["aptitudes"] });
      void qc.invalidateQueries({ queryKey: ["uniqueAptitudes"] });
      void qc.invalidateQueries({ queryKey: ["speciesAptitudes"] });
    };

    // passive-tree-todo.md I3 — PassiveTreeEndpoints.cs already broadcasts "PassiveTreeUpdated" to
    // both groups (I2), but T5.1's exact gap (a broadcast with no web subscriber, relying entirely
    // on the disabled-while-connected refetchInterval) repeats for every new endpoint that skips this
    // wiring. Same shape as `onAptitudesUpdated`.
    const onPassiveTreeUpdated = (msg: { playerId?: number } | null) => {
      if (msg?.playerId != null) {
        void qc.invalidateQueries({ queryKey: queryKeys.passiveTree(msg.playerId) });
      }
      void qc.invalidateQueries({ queryKey: ["passiveTree"] });
    };

    // CG-A5 — Hot bag update refreshes Condition + Shield via same actorSheet query.
    const onActorLiveStateChanged = (msg: { instanceId?: string } | null) => {
      if (msg?.instanceId) {
        void qc.invalidateQueries({ queryKey: ["actorSheet", msg.instanceId] });
      } else {
        void qc.invalidateQueries({ queryKey: ["actorSheet"] });
      }
    };

    c.on("Event", onEvent);
    c.on("EventBatch", onBatch);
    c.on("Health", onHealth);
    c.on("CheatsUpdated", onCheatsUpdated);
    c.on("PvzStatsUpdated", onPvzStatsUpdated);
    c.on("PvzActivityUpdated", onPvzActivityUpdated);
    c.on("RpgProgressionUpdated", onRpgProgressionUpdated);
    c.on("TypeIconUpdated", onTypeIconUpdated);
    c.on("CreaturesUpdated", onCreaturesUpdated);
    c.on("SoulsUpdated", onSoulsUpdated);
    c.on("AlmanacTextUpdated", onAlmanacTextUpdated);
    c.on("CommandersUpdated", onCommandersUpdated);
    c.on("AptitudesUpdated", onAptitudesUpdated);
    c.on("PassiveTreeUpdated", onPassiveTreeUpdated);
    c.on("ActorLiveStateChanged", onActorLiveStateChanged);
    c.on("LawnRecovery", onLawnRecovery);

    // player-routing T1/T2 - a failed join attempt is a routing hiccup, never a connection
    // failure: it must not flip `status` to "err" (that is reserved for the SignalR connection
    // itself, per c.onclose below).
    const joinShownPlayerSafely = () => {
      void joinShownPlayer(c).catch((err) =>
        console.warn("[hub-provider] joinShownPlayer failed", err)
      );
    };

    let cancelled = false;
    c.onreconnecting(() => {
      if (cancelled) return;
      beginRecovery("reconnect");
      setStatus("off");
    });
    c.onreconnected(() => {
      if (cancelled) return;
      beginRecovery("reconnect");
      setStatus("on");
      // player-routing T2 - a reconnected connection has a NEW connection id and no groups.
      void c
        .invoke("Join", "web")
        .then(joinShownPlayerSafely)
        .catch((err) => {
          if (cancelled) return;
          setStatus("err");
          markLawnRecoveryStatus({
            state: "error",
            message: err instanceof Error ? err.message : "Lawn reconnection failed."
          });
        });
    });
    c.onclose(() => {
      if (cancelled) return;
      setStatus("err");
      markLawnRecoveryStatus({ state: "error", message: "Live connection closed." });
    });

    beginRecovery("entry");
    c.start()
      .then(async () => {
        if (cancelled) return;
        setStatus("on");
        await c.invoke("Join", "web");
        // player-routing T1 - joins the save the web is showing, right after Join("web").
        if (!cancelled) joinShownPlayerSafely();
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("err");
        markLawnRecoveryStatus({
          state: "error",
          message: err instanceof Error ? err.message : "Live connection failed."
        });
      });

    return () => {
      cancelled = true;
      c.off("Event", onEvent);
      c.off("EventBatch", onBatch);
      c.off("Health", onHealth);
      c.off("CheatsUpdated", onCheatsUpdated);
      c.off("PvzStatsUpdated", onPvzStatsUpdated);
      c.off("PvzActivityUpdated", onPvzActivityUpdated);
      c.off("RpgProgressionUpdated", onRpgProgressionUpdated);
      c.off("TypeIconUpdated", onTypeIconUpdated);
      c.off("AlmanacTextUpdated", onAlmanacTextUpdated);
      c.off("CreaturesUpdated", onCreaturesUpdated);
      c.off("SoulsUpdated", onSoulsUpdated);
      c.off("CommandersUpdated", onCommandersUpdated);
      c.off("AptitudesUpdated", onAptitudesUpdated);
      c.off("PassiveTreeUpdated", onPassiveTreeUpdated);
      c.off("ActorLiveStateChanged", onActorLiveStateChanged);
      c.off("LawnRecovery", onLawnRecovery);
      void c.stop();
    };
  }, [qc]);

  return <HubStatusContext.Provider value={status}>{children}</HubStatusContext.Provider>;
}
