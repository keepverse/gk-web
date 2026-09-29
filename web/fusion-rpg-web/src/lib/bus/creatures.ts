import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";
import type { UniqueActorDto } from "./types";

// ---- DTOs (spec-creature-core / spec-creature-summoning wire shapes) ----

export type CreatureSpeciesCatalogItem = {
  speciesId: string;
  name: string;
  side: "plant" | "zombie";
  gameTypeId: number;
  creatureTypeId: number;
  elementPrimary: string;
  elementSecondary?: string | null;
  // species-gear-chain T17: the runtime catalog carries the ten-rung ladder's ids, not the retired
  // four-value union this type once claimed. `string` is honest (the wire can carry anything);
  // every roster surface reads it through `rarityOrdinal`, which surfaces unknowns loudly.
  rarity: string;
  deployMode: "plant-avatar" | "hypno-ally";
  summonable: boolean;
  captureOnly: boolean;
  variants: string[];
  traitPool: string[];
};

export type CreatureTraitCatalogItem = { traitId: string; name: string; blurb: string };

export type CreatureCatalogDto = {
  species: CreatureSpeciesCatalogItem[];
  traits: CreatureTraitCatalogItem[];
};

export type CreatureProfileDto = {
  instanceId: string;
  speciesId: string;
  rarity: string;
  variant: string;
  elementPrimary: string;
  elementSecondary?: string | null;
  traitIds: string[];
  origin: string;
  nickname?: string | null;
  locked: boolean;
  star: number;
  promoted: boolean;
  createdUtc: string;
  revision: number;
};

export type CreatureSpecimenDto = { actor: UniqueActorDto; profile: CreatureProfileDto };
export type CreatureRosterDto = { playerId: number; items: CreatureSpecimenDto[] };
export type CreatureCodexEntryDto = { speciesId: string; state: "seen" | "discovered"; firstUtc: string; updatedUtc: string };
export type CreatureCodexDto = { playerId: number; entries: CreatureCodexEntryDto[] };

export type SoulBalanceDto = {
  playerId: number;
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  revision: number;
  updatedUtc: string;
};

export type SummonStateDto = {
  banners: { bannerId: string; costPerPull: number; costPerTen: number; focusElement?: string | null }[];
  pity: { pullsSinceEpic: number; pullsSinceLegendary: number; epicGuaranteeAt: number; legendaryGuaranteeAt: number };
  balance: SoulBalanceDto;
};

export type SummonOutcomeDto = {
  replayed: boolean;
  specimens: CreatureSpecimenDto[];
  pity: { pullsSinceEpic: number; pullsSinceLegendary: number };
  balance: SoulBalanceDto;
  discoverySouls: number;
};

// ---- Keys ----

export const creatureKeys = {
  catalog: ["creatureCatalog"] as const,
  roster: (playerId: number) => ["creatureRoster", playerId] as const,
  codex: (playerId: number) => ["creatureCodex", playerId] as const,
  summonState: (playerId: number) => ["creatureSummonState", playerId] as const,
  souls: (playerId: number) => ["souls", playerId] as const
};

// ---- Queries ----

export function useCreatureCatalog() {
  return useQuery({
    queryKey: creatureKeys.catalog,
    queryFn: () => getJson<CreatureCatalogDto>("/api/creatures/catalog"),
    staleTime: Infinity // code-authored catalog: changes only on redeploy
  });
}

export type SpeciesIndexEntry = { name: string; side: "plant" | "zombie"; gameTypeId: number };

/** Shared species lookup — one memoized index instead of a copy-pasted map per page. */
export function useSpeciesIndex(): Map<string, SpeciesIndexEntry> {
  const catalog = useCreatureCatalog();
  return useMemo(() => {
    const map = new Map<string, SpeciesIndexEntry>();
    for (const s of catalog.data?.species ?? [])
      map.set(s.speciesId, { name: s.name, side: s.side, gameTypeId: s.gameTypeId });
    return map;
  }, [catalog.data]);
}

export function useCreatureRoster(playerId: number) {
  return useQuery({
    queryKey: creatureKeys.roster(playerId),
    queryFn: () => getJson<CreatureRosterDto>(`/api/creatures/${playerId}`),
    enabled: playerId > 0
  });
}

export function useCreatureCodex(playerId: number) {
  return useQuery({
    queryKey: creatureKeys.codex(playerId),
    queryFn: () => getJson<CreatureCodexDto>(`/api/creatures/${playerId}/codex`),
    enabled: playerId > 0
  });
}

export function useSummonState(playerId: number) {
  return useQuery({
    queryKey: creatureKeys.summonState(playerId),
    queryFn: () => getJson<SummonStateDto>(`/api/creatures/${playerId}/summon-state`),
    enabled: playerId > 0
  });
}

export function useSoulBalance(playerId: number) {
  return useQuery({
    queryKey: creatureKeys.souls(playerId),
    queryFn: () => getJson<SoulBalanceDto>(`/api/souls/${playerId}`),
    enabled: playerId > 0
  });
}

/** UUID v4 with a getRandomValues fallback — crypto.randomUUID is absent on non-secure origins (LAN rebind). */
export function newCorrelationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- Mutations ----

export function invalidateCreatureQueries(qc: ReturnType<typeof useQueryClient>) {
  // Prefix keys match every player's variant of each query.
  void qc.invalidateQueries({ queryKey: ["creatureRoster"] });
  void qc.invalidateQueries({ queryKey: ["creatureCodex"] });
  void qc.invalidateQueries({ queryKey: ["creatureSummonState"] });
  void qc.invalidateQueries({ queryKey: ["souls"] });
}

export function useSummon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { playerId?: number; bannerId: string; count: 1 | 10; correlationId: string }) =>
      sendJson<SummonOutcomeDto>("/api/creatures/summon", "POST", req),
    onSuccess: () => invalidateCreatureQueries(qc)
  });
}

export function useSetCreatureNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { instanceId: string; nickname: string | null }) =>
      sendJson<CreatureProfileDto>(`/api/creatures/specimen/${req.instanceId}/nickname`, "POST", {
        nickname: req.nickname
      }),
    // Rename touches only the roster; codex/souls/pity can't change (the hub echo covers other tabs).
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["creatureRoster"] })
  });
}

export function useSetCreatureLocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { instanceId: string; locked: boolean }) =>
      sendJson<CreatureProfileDto>(`/api/creatures/specimen/${req.instanceId}/lock`, "POST", {
        locked: req.locked
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["creatureRoster"] })
  });
}
