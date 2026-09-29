import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHubStatus } from "./hub-provider";
import { queryKeys } from "./keys";
import { getJson, tryGetJson } from "./rest";
import type {
  HealthDto,
  MetricItem,
  PlayersListDto,
  RecipeItem,
  RunItem,
  SimState,
  SpawnStatItem,
  StatsConfig,
  CheatSnapshot,
  CheatSchemaDto,
  PvzStatsChannelDetail,
  PvzStatsSheet,
  PvzActivityRollup,
  PvzActivityFactsPage,
  RpgProgressionList,
  RpgProgressionSummary,
  RpgProgressionStats,
  RpgActorProgression,
  RpgXpLedgerPage,
  ProbePackDto,
  StorageArchiveItem,
  StorageSummary,
  TypeItem,
  UniqueActorDto,
  UniqueActorListDto,
  UniqueEquipmentListDto,
  RelicCatalogListDto,
  AptitudesState,
  SpeciesAptitudesState,
  UniqueAptitudesState,
  SpeciesRespecPrice,
  PassiveTreeState
} from "./types";

function hubConnected(status: string): boolean {
  return status === "on";
}

export function useHealth() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => getJson<HealthDto>("/health"),
    refetchInterval: hubConnected(hub) ? false : 5000
  });
}

export function usePlayers() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.players,
    queryFn: () => getJson<PlayersListDto>("/api/players"),
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => getJson<StatsConfig>("/api/stats")
  });
}

export function useCheats() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.cheats,
    queryFn: () => getJson<CheatSnapshot>("/api/cheats"),
    // When hub is on, prefer CheatsUpdated; avoid 8s poll fighting edits.
    refetchInterval: hubConnected(hub) ? false : 8000,
    refetchOnWindowFocus: false
  });
}

export function useCheatSchema() {
  return useQuery({
    queryKey: queryKeys.cheatSchema,
    queryFn: () => getJson<CheatSchemaDto>("/api/cheats/schema"),
    staleTime: Infinity
  });
}

export function usePvzStatsSheet(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.pvzStats(playerId ?? 0),
    queryFn: () => getJson<PvzStatsSheet>(`/api/pvz-stats/${playerId}`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useAptitudes(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.aptitudes(playerId ?? 0),
    queryFn: () => getJson<AptitudesState>(`/api/aptitudes/${playerId}`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

/** aptitude-sheet Mode A — UniqueCreature by specimen instanceId. Unused by Mode C commander path. */
export function useUniqueAptitudes(instanceId: string | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.uniqueAptitudes(instanceId ?? ""),
    queryFn: () => getJson<UniqueAptitudesState>(`/api/aptitudes/unique/${encodeURIComponent(instanceId!)}`),
    enabled: !!instanceId,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

/** passive-tree-todo.md I2/I3 — GET /api/passive-tree/{playerId}, the shared-corpus resolve report
 * (spec-tree-surface.md §10). The hub's `PassiveTreeUpdated` broadcast (`RpgHub`) invalidates this
 * same key on both a web-driven allocate and an injector-side event, matching `useAptitudes`' own
 * poll-vs-hub tradeoff. */
export function usePassiveTree(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.passiveTree(playerId ?? 0),
    queryFn: () => getJson<PassiveTreeState>(`/api/passive-tree/${playerId}`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

/** spec-allocation-surface.md — the shipped baseline + effective override for one species. */
export function useSpeciesAptitudes(playerId: number | null | undefined, speciesId: string | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.speciesAptitudes(playerId ?? 0, speciesId ?? ""),
    queryFn: () =>
      getJson<SpeciesAptitudesState>(`/api/aptitudes/species/${playerId}/${encodeURIComponent(speciesId!)}`),
    enabled: playerId != null && playerId > 0 && !!speciesId,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

/** spec-species-respec.md — read-only preview so the price is shown BEFORE the confirm, never after. */
export function useSpeciesRespecPrice(playerId: number | null | undefined, speciesId: string | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.speciesRespecPrice(playerId ?? 0, speciesId ?? ""),
    queryFn: () =>
      getJson<SpeciesRespecPrice>(`/api/species-build/respec-price/${playerId}/${encodeURIComponent(speciesId!)}`),
    enabled: playerId != null && playerId > 0 && !!speciesId,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function usePvzStatsChannel(playerId: number | null | undefined, channel: string | null) {
  return useQuery({
    queryKey: queryKeys.pvzStatsChannel(playerId ?? 0, channel ?? ""),
    queryFn: () =>
      getJson<PvzStatsChannelDetail>(`/api/pvz-stats/${playerId}/channels/${encodeURIComponent(channel!)}`),
    enabled: playerId != null && playerId > 0 && !!channel
  });
}

export function usePvzActivityRollup(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.pvzActivity(playerId ?? 0),
    queryFn: () => getJson<PvzActivityRollup>(`/api/pvz-activity/${playerId}`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function usePvzActivityFacts(playerId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.pvzActivityFacts(playerId ?? 0),
    queryFn: () => getJson<PvzActivityFactsPage>(`/api/pvz-activity/${playerId}/facts?limit=100`),
    enabled: playerId != null && playerId > 0
  });
}

export function useRpgProgressionSummary(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.rpgProgressionSummary(playerId ?? 0),
    queryFn: () => getJson<RpgProgressionSummary>(`/api/rpg/progression/${playerId}/summary`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useRpgProgressionStats(playerId: number | null | undefined) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.rpgProgressionStats(playerId ?? 0),
    queryFn: () => getJson<RpgProgressionStats>(`/api/rpg/progression/${playerId}/stats`),
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useRpgProgressionActors(
  playerId: number | null | undefined,
  kind?: string,
  sort = "level",
  limit = 50,
  offset = 0
) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: [...queryKeys.rpgProgressionActors(playerId ?? 0, kind), sort, limit, offset],
    queryFn: () => {
      const q = new URLSearchParams();
      if (kind) q.set("kind", kind);
      q.set("sort", sort);
      q.set("limit", String(limit));
      q.set("offset", String(offset));
      return getJson<RpgProgressionList>(`/api/rpg/progression/${playerId}?${q}`);
    },
    enabled: playerId != null && playerId > 0,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useRpgProgressionActor(
  playerId: number | null | undefined,
  kind: string | null | undefined,
  typeId: number | null | undefined
) {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.rpgProgressionActor(playerId ?? 0, kind ?? "", typeId ?? 0),
    queryFn: () => getJson<RpgActorProgression>(`/api/rpg/progression/${playerId}/${kind}/${typeId}`),
    enabled: playerId != null && playerId > 0 && !!kind && typeId != null,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useRpgProgressionLedger(
  playerId: number | null | undefined,
  filters?: {
    kind?: string;
    typeId?: number;
    reason?: string;
    limit?: number;
    afterId?: number;
    enabled?: boolean;
  }
) {
  const hub = useHubStatus();
  const limit = filters?.limit ?? 100;
  return useQuery({
    queryKey: queryKeys.rpgProgressionLedger(playerId ?? 0, filters),
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", String(limit));
      if (filters?.kind) q.set("kind", filters.kind);
      if (filters?.typeId != null) q.set("typeId", String(filters.typeId));
      if (filters?.reason) q.set("reason", filters.reason);
      if (filters?.afterId != null) q.set("afterId", String(filters.afterId));
      return getJson<RpgXpLedgerPage>(`/api/rpg/progression/${playerId}/ledger?${q}`);
    },
    enabled: playerId != null && playerId > 0 && filters?.enabled !== false,
    refetchInterval: hubConnected(hub) ? false : 8000
  });
}

export function useProbePacks() {
  return useQuery({
    queryKey: queryKeys.cheatPacks,
    queryFn: async () => {
      const r = await getJson<{ items: ProbePackDto[] }>("/api/cheats/packs");
      return r.items;
    }
  });
}

export function useTypes() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.types,
    queryFn: async () => {
      const r = await getJson<{ items: TypeItem[] }>("/api/types");
      return r.items;
    },
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useRecipes() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: async () => {
      const r = await getJson<{ items: RecipeItem[] }>("/api/recipes");
      return r.items;
    },
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useMetrics() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: async () => {
      const r = await getJson<{ items: MetricItem[] }>("/api/metrics");
      return r.items;
    },
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useRuns() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: async () => {
      const r = await getJson<{ items: RunItem[] }>("/api/runs");
      return r.items;
    },
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useRunSpawns(runId: number | null) {
  return useQuery({
    queryKey: runId != null ? queryKeys.runSpawns(runId) : ["runSpawns", "none"],
    queryFn: async () => {
      if (runId == null) return [] as SpawnStatItem[];
      const r = await getJson<{ items: SpawnStatItem[] }>(`/api/runs/${runId}/spawns`);
      return r.items;
    },
    enabled: runId != null
  });
}

export function useSimState() {
  const hub = useHubStatus();
  return useQuery({
    queryKey: queryKeys.sim,
    queryFn: () => tryGetJson<SimState>("/api/sim/state"),
    refetchInterval: hubConnected(hub) ? false : 10000
  });
}

export function useStorageSummary() {
  return useQuery({
    queryKey: queryKeys.storageSummary,
    queryFn: () => getJson<StorageSummary>("/api/storage/summary"),
    staleTime: 5_000
  });
}

export function useStorageArchives() {
  return useQuery({
    queryKey: queryKeys.storageArchives,
    queryFn: async () => {
      const r = await getJson<{ items: StorageArchiveItem[] }>("/api/storage/archives");
      return r.items;
    },
    staleTime: 5_000
  });
}

/** Cold UniqueActor read for Bound lawn selection (W7-B). 404 → null. */
export function useUniqueActor(instanceId: string | null | undefined) {
  const id = instanceId?.trim() || "";
  return useQuery({
    queryKey: queryKeys.uniqueActor(id),
    queryFn: () => tryGetJson<UniqueActorDto>(`/api/unique/actors/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
    staleTime: 5_000,
    retry: false
  });
}

/** Roster list for current (or given) player — W8-C. */
export function useUniqueActors(playerId: number | null | undefined) {
  const hub = useHubStatus();
  const pid = playerId ?? 0;
  return useQuery({
    queryKey: queryKeys.uniqueActors(pid),
    queryFn: () => getJson<UniqueActorListDto>(`/api/unique/actors?playerId=${pid}`),
    enabled: pid > 0,
    refetchInterval: hubConnected(hub) ? false : 10_000,
    staleTime: 5_000
  });
}

/** Equipment slots + compiled mods_json for a specimen — W8-A. */
export function useUniqueEquipment(instanceId: string | null | undefined) {
  const id = instanceId?.trim() || "";
  return useQuery({
    queryKey: queryKeys.uniqueEquipment(id),
    queryFn: () =>
      getJson<UniqueEquipmentListDto>(
        `/api/unique/actors/${encodeURIComponent(id)}/equipment`
      ),
    enabled: id.length > 0,
    staleTime: 5_000,
    retry: false
  });
}

/** T14: the seeded relic catalog — small and real, no acquisition system yet (every
 * player holds it in full), so this rarely changes and needs no refetch interval. */
export function useRelics() {
  return useQuery({
    queryKey: queryKeys.relics,
    queryFn: () => getJson<RelicCatalogListDto>("/api/relics"),
    staleTime: 60_000
  });
}

export function useInvalidateAllSnapshots() {
  const qc = useQueryClient();
  return () => {
    for (const key of queryKeys.allSnapshots) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}
