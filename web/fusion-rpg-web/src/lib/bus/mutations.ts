import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { clearLogEvents } from "./log-store";
import { sendJson } from "./rest";
import { clearCheatFloatDirty } from "./cheat-dirty";
import { getHubConnection } from "./hub";
import { joinCurrentPlayer } from "./playerRouting";
import type {
  CheatEntry,
  CheatSnapshot,
  PlayerDto,
  ProbeRunResult,
  StatsConfig,
  StoragePurgeResult,
  UniqueActorDeployResultDto,
  UniqueActorDto,
  UniqueEquipmentListDto,
  AptitudesState,
  UniqueAptitudesState,
  AptitudeRespecQuote,
  SpeciesRespecResult,
  PassiveTreeState,
  PreviewTreeStateRequest
} from "./types";

/**
 * `meta.entity` on every mutation below (T11) is what the toast layer
 * (`shell/Toasts.tsx`) names in a failure — "Creature update failed —
 * nothing changed", not just "Something went wrong". A global
 * `MutationCache` listener (`app/providers.tsx`) reads it, so every
 * mutation gets a band-4 result without each call site wiring its own.
 */

export function useSaveStats() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Stats" },
    mutationFn: async (stats: StatsConfig) => {
      await sendJson("/api/stats", "PUT", stats);
      await sendJson("/api/commands/reload-stats", "POST", {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.stats });
    }
  });
}

function patchCheatEntry(
  snap: CheatSnapshot | undefined,
  id: string,
  patch: Partial<CheatEntry>
): CheatSnapshot {
  const entries = [...(snap?.entries ?? [])];
  const i = entries.findIndex((e) => e.id === id);
  if (i >= 0) {
    entries[i] = { ...entries[i]!, ...patch, isSet: true };
  } else {
    entries.push({
      id,
      kind: patch.floatValue != null ? "number" : "toggle",
      enabled: patch.enabled ?? true,
      floatValue: patch.floatValue,
      isSet: true
    });
  }
  return { ...(snap ?? {}), entries };
}

export function useSaveCheats() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Cheats" },
    mutationFn: (snap: CheatSnapshot) => sendJson("/api/cheats", "PUT", snap),
    onSuccess: (_data, snap) => {
      qc.setQueryData(queryKeys.cheats, snap);
    }
  });
}

export function useToggleCheat() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Cheat" },
    mutationFn: (body: { id: string; enabled: boolean }) => sendJson("/api/cheats/toggle", "POST", body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: queryKeys.cheats });
      const prev = qc.getQueryData<CheatSnapshot>(queryKeys.cheats);
      qc.setQueryData(queryKeys.cheats, patchCheatEntry(prev, body.id, { enabled: body.enabled }));
      return { prev };
    },
    onError: (_e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cheats, ctx.prev);
    }
  });
}

export function useSetCheatFloat() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Cheat" },
    mutationFn: (body: { id: string; value: number }) => sendJson("/api/cheats/set-float", "POST", body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: queryKeys.cheats });
      const prev = qc.getQueryData<CheatSnapshot>(queryKeys.cheats);
      qc.setQueryData(
        queryKeys.cheats,
        patchCheatEntry(prev, body.id, { enabled: true, floatValue: body.value, isSet: true })
      );
      return { prev };
    },
    onSuccess: (_data, body) => {
      clearCheatFloatDirty(body.id);
    },
    onError: (_e, body, ctx) => {
      clearCheatFloatDirty(body.id);
      if (ctx?.prev) qc.setQueryData(queryKeys.cheats, ctx.prev);
    }
  });
}

export function useClearCheatField() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Cheat" },
    mutationFn: (body: { id: string }) => sendJson("/api/cheats/clear-field", "POST", body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: queryKeys.cheats });
      const prev = qc.getQueryData<CheatSnapshot>(queryKeys.cheats);
      if (prev?.entries) {
        qc.setQueryData(queryKeys.cheats, {
          ...prev,
          entries: prev.entries.filter((e) => e.id !== body.id)
        });
      }
      return { prev };
    },
    onSuccess: (_d, body) => {
      clearCheatFloatDirty(body.id);
      void qc.invalidateQueries({ queryKey: queryKeys.cheats });
    },
    onError: (_e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.cheats, ctx.prev);
    }
  });
}

export function useCheatAction() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Cheat" },
    mutationFn: (body: Record<string, unknown>) => sendJson("/api/cheats/action", "POST", body),
    onSuccess: (_d, body) => {
      const a = body.action;
      if (a === "reset-all" || a === "reset-group" || a === "clear-field")
        void qc.invalidateQueries({ queryKey: queryKeys.cheats });
    }
  });
}

export function useRunProbePack() {
  return useMutation({
    meta: { entity: "Probe" },
    mutationFn: (body: { packId: string; probeId?: string }) =>
      sendJson<ProbeRunResult>("/api/cheats/probe", "POST", body)
  });
}

export function useEndProbe() {
  return useMutation({
    meta: { entity: "Probe" },
    mutationFn: (body: { probeId?: string; reason?: string } = {}) =>
      sendJson("/api/cheats/probe/end", "POST", body)
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Player" },
    mutationFn: (name: string) => sendJson<PlayerDto>("/api/players", "POST", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.players });
    }
  });
}

export function useSelectPlayer() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Player" },
    mutationFn: (id: number) => sendJson("/api/players/current", "PUT", { id }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.players });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
      void qc.invalidateQueries({ queryKey: queryKeys.health });
      // player-routing T3 - a save switch in THIS session, no reconnect. Another session that did
      // not switch keeps its own group (this call only joins the connection that made the switch).
      void joinCurrentPlayer(getHubConnection(), id);
    }
  });
}

export function useSimCommand() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Simulation" },
    mutationFn: ({ path, body = {} }: { path: string; body?: unknown }) =>
      sendJson("/api/sim" + path, "POST", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sim });
      void qc.invalidateQueries({ queryKey: queryKeys.types });
      void qc.invalidateQueries({ queryKey: queryKeys.recipes });
      void qc.invalidateQueries({ queryKey: queryKeys.metrics });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
      void qc.invalidateQueries({ queryKey: queryKeys.players });
    }
  });
}

export function useResetSim() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Simulation" },
    mutationFn: () => sendJson("/api/test/reset", "POST", {}),
    onSuccess: () => {
      clearLogEvents();
      for (const key of queryKeys.allSnapshots) {
        void qc.invalidateQueries({ queryKey: key });
      }
      void qc.invalidateQueries({ queryKey: ["pvzStats"] });
      void qc.invalidateQueries({ queryKey: ["pvzActivity"] });
      void qc.invalidateQueries({ queryKey: ["pvzActivityFacts"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionSummary"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionStats"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActors"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActor"] });
    }
  });
}

export function useSeedPvzStatsDemo() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "PvzStats" },
    mutationFn: (playerId?: number) =>
      sendJson("/api/test/seed-pvz-stats-demo", "POST", playerId != null ? { playerId } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pvzStats"] });
      void qc.invalidateQueries({ queryKey: ["pvzStatsChannel"] });
    }
  });
}

/** spec-specimen-respec-price.md EP1.9/EP1.11 — `correlationId` is required only when the server
 * decides the change is a respec (a take-back); an addition or a first allocation needs none. The
 * host calls `useAptitudeRespecQuote` on Confirm and sends a FRESH id here only when that quote
 * reports `isRespec` — never computed or decided by the FE itself. */
export function useSaveAptitudes() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Aptitudes" },
    mutationFn: (body: { playerId: number; shares: Record<string, number>; correlationId?: string }) =>
      sendJson<AptitudesState>("/api/aptitudes/allocate", "POST", body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitudes(vars.playerId) });
    }
  });
}

/** aptitude-sheet Mode A — POST UniqueCreature allocate. Not used by Mode C commander path.
 * `correlationId` — see `useSaveAptitudes`'s own note; same rule, same source (respec-quote). */
export function useSaveUniqueAptitudes() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "UniqueAptitudes" },
    mutationFn: (body: { instanceId: string; shares: Record<string, number>; correlationId?: string }) =>
      sendJson<UniqueAptitudesState>("/api/aptitudes/unique/allocate", "POST", body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.uniqueAptitudes(vars.instanceId) });
    }
  });
}

/**
 * spec-specimen-respec-price.md EP1.9/EP1.11 — POST /api/aptitudes/respec-quote. Deliberately a
 * MUTATION, never a `useQuery` (same reasoning as `usePreviewTree` above): this call is read-only
 * server-side but triggered by an explicit player action (Confirm), not by data the sheet
 * subscribes to. The host calls this FIRST on Confirm; when `isRespec` is true it shows
 * `soulPrice` and sends a fresh `correlationId` with the actual save that follows.
 */
export function useAptitudeRespecQuote() {
  return useMutation({
    meta: { entity: "AptitudeRespecQuote" },
    mutationFn: (body: { scope: "commander" | "unique"; playerId?: number; instanceId?: string; shares: Record<string, number> }) =>
      sendJson<AptitudeRespecQuote>("/api/aptitudes/respec-quote", "POST", body)
  });
}

/** passive-tree-todo.md I3 — POST /api/passive-tree/allocate. One WHOLE allocation (node id -> soul
 * level), the same "the step edits the draft, not the server" shape `useAllocationDraft` expects of
 * every `onSave` it is handed (spec-tree-surface.md §4 rule 3). */
export function useSaveTreeNodes() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "PassiveTree" },
    mutationFn: (body: { playerId: number; nodes: Record<string, number> }) =>
      sendJson<PassiveTreeState>("/api/passive-tree/allocate", "POST", body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.passiveTree(vars.playerId) });
    }
  });
}

/** I8's follow-up (spec-tree-surface.md §7.2 part 5) — POST /api/passive-tree/{playerId}/preview.
 * Deliberately a MUTATION, never a `useQuery`: this call is read-only server-side (nothing is ever
 * persisted), but it is triggered by an explicit player action ("what would moving these points
 * close?"), not by data this component subscribes to -- the same reason `useMutation` fits a POST
 * body assembled on demand rather than a cache key react-query would otherwise own. No `onSuccess`
 * invalidation: a preview changes nothing the committed `usePassiveTree` cache describes. Rejected
 * (never silently retried) on a 400 -- `aptitudeDelta.wouldGoNegative`/`.unknownId` are real refusals
 * the caller renders, not transient failures. */
export function usePreviewTree() {
  return useMutation({
    meta: { entity: "PassiveTreePreview" },
    mutationFn: (vars: { playerId: number; body: PreviewTreeStateRequest }) =>
      sendJson<PassiveTreeState>(`/api/passive-tree/${vars.playerId}/preview`, "POST", vars.body)
  });
}

/**
 * spec-species-respec.md — the ONE save path for a species' build: a first override, a revert (empty
 * `shares`), and a priced change all go through this single endpoint, which decides for itself which
 * of the three applies. The older, unpriced `/api/aptitudes/species/allocate` route (module 5) this
 * mutation was written to avoid was retired server-side (species-build-todo.md T4.3, 2026-09-05) — this
 * is now the only write path for a species aptitude override.
 */
export function useRespecSpecies() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "SpeciesRespec" },
    mutationFn: (body: {
      playerId: number;
      speciesId: string;
      shares: Record<string, number>;
      correlationId: string;
      /** respec-free-counter EP4.12 — the player's own choice, omitted until they make one. Omitting it
       * with no stock is exactly the pre-EP4.9 request, which the server answers as a soul charge. */
      payWith?: "souls" | "freeRespec";
    }) => sendJson<SpeciesRespecResult>("/api/species-build/respec", "POST", body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.speciesAptitudes(vars.playerId, vars.speciesId) });
      void qc.invalidateQueries({ queryKey: queryKeys.speciesRespecPrice(vars.playerId, vars.speciesId) });
    }
  });
}

export function useResetPvzStats() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "PvzStats" },
    mutationFn: (playerId: number) =>
      sendJson(`/api/pvz-stats/${playerId}/modifiers/reset`, "POST", {}),
    onSuccess: (_data, playerId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.pvzStats(playerId) });
      void qc.invalidateQueries({ queryKey: ["pvzStatsChannel"] });
    }
  });
}

export function useWithdrawPvzStat() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "PvzStats" },
    mutationFn: (body: {
      playerId: number;
      sourceKind?: string;
      sourceId?: string;
      channel?: string;
      op?: string;
      pluginId?: string;
    }) => {
      const { playerId, ...rest } = body;
      return sendJson(`/api/pvz-stats/${playerId}/modifiers/withdraw`, "POST", rest);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.pvzStats(vars.playerId) });
      void qc.invalidateQueries({ queryKey: ["pvzStatsChannel"] });
    }
  });
}

export function useSeedPvzActivityDemo() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "PvzActivity" },
    mutationFn: (playerId?: number) =>
      sendJson("/api/test/seed-pvz-activity-demo", "POST", playerId != null ? { playerId } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pvzActivity"] });
      void qc.invalidateQueries({ queryKey: ["pvzActivityFacts"] });
    }
  });
}

export function useSpawnExtraIntent() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Board" },
    mutationFn: (body: {
      typeId: number;
      row?: number;
      col?: number;
      side?: string;
      reason?: string;
      playerId?: number;
      correlationId?: string;
    }) => sendJson("/api/pvz-intent/spawn-extra", "POST", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pvzActivity"] });
      void qc.invalidateQueries({ queryKey: ["pvzActivityFacts"] });
    }
  });
}

/**
 * Thin debug POST for lawn inspector (W7). Path is `/api/debug/{path}`.
 * `silent: true` is for the ~1.5s board-stats poll (LawnPage) — a failure
 * still surfaces, but a poll succeeding every tick isn't a "you did
 * something" moment and would spam the toast stack (T11).
 */
export function useLawnDebugPost(options?: { silent?: boolean }) {
  return useMutation({
    meta: { entity: "Board", silent: options?.silent },
    mutationFn: (args: { path: string; body?: Record<string, unknown> }) => {
      const path = args.path.replace(/^\//, "");
      return sendJson(`/api/debug/${path}`, "POST", args.body ?? {});
    }
  });
}

function invalidateUniqueActors(
  qc: ReturnType<typeof useQueryClient>,
  playerId?: number,
  instanceId?: string
) {
  if (playerId != null) {
    void qc.invalidateQueries({ queryKey: queryKeys.uniqueActors(playerId) });
  } else {
    void qc.invalidateQueries({ queryKey: ["uniqueActors"] });
  }
  if (instanceId) {
    void qc.invalidateQueries({ queryKey: queryKeys.uniqueActor(instanceId) });
    void qc.invalidateQueries({ queryKey: queryKeys.uniqueEquipment(instanceId) });
  }
}

export function useCreateUniqueActor() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Creature" },
    mutationFn: (body: { side: string; typeId: number; playerId?: number }) =>
      sendJson<UniqueActorDto>("/api/unique/actors", "POST", body),
    onSuccess: (actor) => {
      invalidateUniqueActors(qc, actor.playerId, actor.instanceId);
    }
  });
}

export function useDeployUniqueActor() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Creature" },
    mutationFn: (args: {
      instanceId: string;
      col?: number;
      row?: number;
      correlationId?: string;
      matchKey?: string;
      playerId?: number;
    }) =>
      sendJson<UniqueActorDeployResultDto>(
        `/api/unique/actors/${encodeURIComponent(args.instanceId)}/deploy`,
        "POST",
        {
          col: args.col,
          row: args.row,
          correlationId: args.correlationId,
          matchKey: args.matchKey
        }
      ),
    onSuccess: (result, args) => {
      const pid = result.actor?.playerId ?? args.playerId;
      invalidateUniqueActors(qc, pid, args.instanceId);
    }
  });
}

export function useRetireUniqueActor() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Creature" },
    mutationFn: (args: { instanceId: string; playerId?: number }) =>
      sendJson<UniqueActorDto>(
        `/api/unique/actors/${encodeURIComponent(args.instanceId)}/retire`,
        "POST",
        {}
      ),
    onSuccess: (actor, args) => {
      invalidateUniqueActors(qc, actor.playerId ?? args.playerId, args.instanceId);
    }
  });
}

export function usePutUniqueEquipment() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Equipment" },
    mutationFn: (args: { instanceId: string; slot: string; itemId: string; playerId?: number }) =>
      sendJson<UniqueEquipmentListDto>(
        `/api/unique/actors/${encodeURIComponent(args.instanceId)}/equipment/${encodeURIComponent(args.slot)}`,
        "PUT",
        { itemId: args.itemId }
      ),
    onSuccess: (eq, args) => {
      invalidateUniqueActors(qc, args.playerId, args.instanceId);
      void qc.invalidateQueries({ queryKey: queryKeys.uniqueEquipment(eq.instanceId) });
    }
  });
}

export function useClearUniqueEquipment() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Equipment" },
    mutationFn: (args: { instanceId: string; slot: string; playerId?: number }) =>
      sendJson<UniqueEquipmentListDto>(
        `/api/unique/actors/${encodeURIComponent(args.instanceId)}/equipment/${encodeURIComponent(args.slot)}`,
        "DELETE"
      ),
    onSuccess: (eq, args) => {
      invalidateUniqueActors(qc, args.playerId, args.instanceId);
      void qc.invalidateQueries({ queryKey: queryKeys.uniqueEquipment(eq.instanceId) });
    }
  });
}

export function useAwardUniqueActorXp() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Creature" },
    mutationFn: (args: { instanceId: string; delta: number; reason?: string; playerId?: number }) =>
      sendJson<UniqueActorDto>(
        `/api/unique/actors/${encodeURIComponent(args.instanceId)}/xp`,
        "POST",
        { delta: args.delta, reason: args.reason }
      ),
    onSuccess: (actor, args) => {
      invalidateUniqueActors(qc, actor.playerId ?? args.playerId, args.instanceId);
    }
  });
}

export function useSeedRpgProgressionDemo() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Progression" },
    mutationFn: (playerId?: number) =>
      sendJson("/api/test/seed-rpg-progression-demo", "POST", playerId != null ? { playerId } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rpgProgressionSummary"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionStats"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActors"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger"] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActor"] });
    }
  });
}

export function useClearRpgDemotion() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Progression" },
    mutationFn: (args: { playerId: number; kind: string; typeId: number }) =>
      sendJson(`/api/rpg/progression/${args.playerId}/${args.kind}/${args.typeId}/clear-demotion`, "POST", {}),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: queryKeys.rpgProgressionSummary(args.playerId) });
      void qc.invalidateQueries({ queryKey: queryKeys.rpgProgressionStats(args.playerId) });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionActors", args.playerId] });
      void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger", args.playerId] });
      void qc.invalidateQueries({
        queryKey: queryKeys.rpgProgressionActor(args.playerId, args.kind, args.typeId)
      });
    }
  });
}

function invalidateStorage(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.storageSummary });
  void qc.invalidateQueries({ queryKey: queryKeys.storageArchives });
  void qc.invalidateQueries({ queryKey: queryKeys.runs });
  void qc.invalidateQueries({ queryKey: ["pvzActivity"] });
  void qc.invalidateQueries({ queryKey: ["pvzActivityFacts"] });
  void qc.invalidateQueries({ queryKey: ["rpgProgressionLedger"] });
}

export function useDeleteArchives() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Storage" },
    mutationFn: (uris: string[]) =>
      sendJson<StoragePurgeResult>("/api/storage/archives/delete", "POST", { uris }),
    onSuccess: () => invalidateStorage(qc)
  });
}

export function usePurgeRunCapture() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Storage" },
    mutationFn: (runIds: number[]) =>
      sendJson<StoragePurgeResult>("/api/storage/runs/purge-capture", "POST", { runIds }),
    onSuccess: () => invalidateStorage(qc)
  });
}

export function useDeleteClosedRuns() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Storage" },
    mutationFn: (runIds: number[]) =>
      sendJson<StoragePurgeResult>("/api/storage/runs/delete", "POST", { runIds }),
    onSuccess: () => invalidateStorage(qc)
  });
}

export function useTrimHotTails() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Storage" },
    mutationFn: () => sendJson<{ ok: boolean }>("/api/storage/trim-tails", "POST", {}),
    onSuccess: () => invalidateStorage(qc)
  });
}
