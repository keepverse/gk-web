import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";
import type { CreatureSpecimenDto } from "./creatures";
import type { TurnOrderEntry } from "@/contract/types";

// ---- DTOs (spec-expeditions.md wire shapes) ----

export type ExpeditionTierDto = {
  tierId: string;
  name: string;
  durationMinutes: number;
  tickCount: number;
  battleCount: number;
  squadSlots: number;
  hasBossWave: boolean;
  tickMinutes: number;
};

// Projected on the server: the sealed seed and correlation bookkeeping never reach the wire.
export type ExpeditionRowDto = {
  id: number;
  state: "Dispatched" | "Collected" | "Recalled";
  tierId: string;
  squadInstanceIds: string[];
  dispatchedUtc: string;
  dueUtc: string;
  collectedUtc?: string | null;
};

export type ExpeditionListDto = {
  serverUtc: string;
  tiers: ExpeditionTierDto[];
  items: ExpeditionRowDto[];
};

export type ExpeditionTickDto = {
  tickIndex: number;
  kind: "battle" | "boss-battle" | "quiet" | "found-souls" | "wild-creature-met" | "injury";
  battleIndex: number;
  souls: number;
  wildSpeciesId?: string | null;
  wildJoins: boolean;
  wildVariant?: string | null;
  injuredKey?: string | null;
};

export type ExpeditionBattleResultDto = {
  battleIndex: number;
  boss: boolean;
  outcome: "victory" | "defeat" | "stalemate";
  runId?: number | null;
  matchKey: string;
  /** battle-tempo forecast-rail FR3 — the acting order this battle actually recorded. A RECORD
   * (spec-forecast-rail.md §2.0), never empty-meaning-"unknown": empty is a legal value only
   * when the resolve genuinely had no live actors, which never happens for a real battle. */
  turnOrder: TurnOrderEntry[];
};

export type ExpeditionCollectDto = {
  state: "Collected" | "Recalled";
  elapsedTicks: number;
  ticks: ExpeditionTickDto[];
  battles: ExpeditionBattleResultDto[];
  soulsAwarded: number;
  materials: { materialId: string; qty: number }[];
  wildJoins: CreatureSpecimenDto[];
  specimenXp: { instanceId: string; xp: number }[];
};

export type CreatureMaterialsDto = { items: { materialId: string; qty: number }[] };

// ---- Keys ----

export const expeditionKeys = {
  list: (playerId: number) => ["expeditions", playerId] as const,
  materials: (playerId: number) => ["creatureMaterials", playerId] as const
};

// ---- Queries ----

export function useExpeditions(playerId: number) {
  return useQuery({
    queryKey: expeditionKeys.list(playerId),
    queryFn: () => getJson<ExpeditionListDto>(`/api/expeditions/${playerId}`),
    enabled: playerId > 0,
    // Expeditions run for minutes to hours on a real wall clock; a light poll keeps the rail
    // badge and the return-toast watcher (T17) honest without the player needing to reopen the
    // layer, while staying far under anything that would look like a live countdown feed.
    refetchInterval: 30_000
  });
}

export function useCreatureMaterials(playerId: number) {
  return useQuery({
    queryKey: expeditionKeys.materials(playerId),
    queryFn: () => getJson<CreatureMaterialsDto>(`/api/expeditions/${playerId}/materials`),
    enabled: playerId > 0
  });
}

// ---- Mutations ----

export function invalidateExpeditionQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["expeditions"] });
  void qc.invalidateQueries({ queryKey: ["creatureMaterials"] });
  void qc.invalidateQueries({ queryKey: ["creatureRoster"] });
  void qc.invalidateQueries({ queryKey: ["souls"] });
}

export function useDispatchExpedition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { playerId?: number; correlationId: string; tierId: string; squad: string[] }) =>
      sendJson<{ replayed: boolean; expedition: ExpeditionRowDto }>("/api/expeditions/dispatch", "POST", req),
    onSuccess: () => invalidateExpeditionQueries(qc)
  });
}

export function useCollectExpedition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { expeditionId: number; playerId?: number; recall?: boolean }) =>
      sendJson<ExpeditionCollectDto>(
        `/api/expeditions/${req.expeditionId}/${req.recall ? "recall" : "collect"}`,
        "POST",
        { playerId: req.playerId }
      ),
    onSuccess: () => invalidateExpeditionQueries(qc)
  });
}
