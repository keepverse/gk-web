import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";

// ---- DTOs (aura-skill T18c wire shapes -- AuraCatalogEndpoints.cs / AuraRuntimeEndpoints.cs /
// AuraDerivedEndpoints.cs) ----

export type AuraUpkeepCostDto = {
  resourceId: string;
  amountMin: number;
  amountMax: number;
  when: string;
};

export type AuraCatalogItemDto = {
  auraId: string;
  aptitudeId: string;
  upkeep: AuraUpkeepCostDto[];
};

export type AuraCatalogDto = {
  items: AuraCatalogItemDto[];
};

export type AuraRuntimeStateDto = {
  playerId: number;
  activeAuraIds: string[];
  equippedAuraIds: string[];
  maxActiveAuras: number;
};

export type AuraEnableResultDto = {
  playerId: number;
  enabledAuraId: string;
  evictedAuraId: string | null;
  activeAuraIds: string[];
};

export type AuraDisableResultDto = {
  playerId: number;
  disabledAuraId: string;
  wasActive: boolean;
  activeAuraIds: string[];
};

export type DerivedContributionDto = {
  sourceId: string;
  op: string;
  value: number;
};

export type DerivedChannelDto = {
  channelId: string;
  value: number;
  contributions: DerivedContributionDto[];
};

export type ActorDerivedDto = {
  instanceId: string;
  channels: DerivedChannelDto[];
};

/** Wire shape for GET /api/actors/{id}/sheet (ActorSheetDto). */
export type ActorContributionDto = {
  sourceId: string;
  label: string;
  op: string;
  value: number;
};

export type ActorSheetChannelDto = {
  channelId: string;
  displayName: string;
  reading: string;
  composeKind: string;
  /** D6: wire twin of Contracts double Value (overflow widen is a separate Core ticket). */
  value: number;
  contributions: ActorContributionDto[];
  unitClass: string;
  defaultValue: number;
  /** Null when uncapped (e.g. status.resist.omni). */
  cap: number | null;
  /** D2 authoritative: active|default|capped|stub|no-producer|unregistered. */
  renderState: string;
};

export type ActorElementTypingDto = {
  primary: string;
  secondary?: string;
};

export type ActorStatusGlyphDto = {
  statusId: string;
  remainingPermille?: number | null;
};

export type ActorResourcePoolDto = {
  resourceId: string;
  current?: number | null;
  max?: number | null;
};

export type ActorShieldSummaryDto = {
  elementId?: string | null;
  current?: number | null;
  max?: number | null;
  stacks?: number | null;
};

/** Wire shape for one drain-order shield layer on ActorSheetDto (S1). */
export type ActorShieldLayerDto = {
  shieldId: string;
  elementId?: string | null;
  current: number;
  max: number;
  priority: number;
  sourceId: string;
  isInnate: boolean;
  regenPerSecond?: number | null;
  broken?: boolean;
};

export type ActorStandingDto = {
  offense: number;
  survivability: number;
  control: number;
  utility: number;
  economy: number;
};

export type ActorSheetDto = {
  instanceId: string;
  playerId: number;
  side: string;
  typeId: number;
  displayName: string | null;
  speciesId?: string | null;
  speciesName?: string | null;
  phase?: string | null;
  roleLabel?: string | null;
  level: number;
  xp?: number;
  xpToNext?: number | null;
  elementTyping?: ActorElementTypingDto | null;
  standing?: ActorStandingDto | null;
  liveStatuses?: ActorStatusGlyphDto[];
  resourcePools?: ActorResourcePoolDto[];
  shieldSummary?: ActorShieldSummaryDto | null;
  shieldLayers?: ActorShieldLayerDto[];
  derived: ActorSheetChannelDto[];
  primary: ActorContributionDto[];
};

/** GG-49 fiction labels when lean `/derived` omits `label`. */
export function contributionFictionLabel(sourceId: string): string {
  if (!sourceId.trim()) return "(unattributed)";
  if (sourceId === "rpg.progression") return "Progression";
  if (sourceId === "rpg.resource.base") return "Resource base";
  if (sourceId.startsWith("equip:")) {
    const parts = sourceId.split(":");
    const role = parts[1] ?? "unknown";
    const item = parts[2] ?? "";
    return !item || item === "unknown" ? `Equip · ${role}` : `Equip · ${role} (${item})`;
  }
  if (sourceId.startsWith("aptitude.")) return `Aptitude · ${sourceId.slice("aptitude.".length)}`;
  if (sourceId.startsWith("tree.")) return `Tree · ${sourceId.slice("tree.".length).replace(/\./g, "/")}`;
  if (sourceId.startsWith("status:")) return `Status · ${sourceId.slice("status:".length)}`;
  if (sourceId.startsWith("grant:")) return `Grant · ${sourceId.slice("grant:".length)}`;
  if (sourceId.startsWith("primary:")) return `Primary · ${sourceId.slice("primary:".length)}`;
  return sourceId;
}

// ---- Queries ----

export function useAuraCatalog() {
  return useQuery({
    queryKey: ["auraCatalog"] as const,
    queryFn: () => getJson<AuraCatalogDto>("/api/auras"),
    staleTime: Infinity // authored data, never changes at runtime
  });
}

export function useAuraRuntime(playerId: number) {
  return useQuery({
    queryKey: ["auraRuntime", playerId] as const,
    queryFn: () => getJson<AuraRuntimeStateDto>(`/api/aura-runtime/${playerId}`),
    enabled: playerId > 0
  });
}

export function useActorDerived(instanceId: string | null | undefined) {
  return useQuery({
    queryKey: ["actorDerived", instanceId ?? ""] as const,
    queryFn: () => getJson<ActorDerivedDto>(`/api/actors/${encodeURIComponent(instanceId!)}/derived`),
    enabled: !!instanceId
  });
}

export function useActorSheet(instanceId: string | null | undefined) {
  return useQuery({
    queryKey: ["actorSheet", instanceId ?? ""] as const,
    queryFn: () => getJson<ActorSheetDto>(`/api/actors/${encodeURIComponent(instanceId!)}/sheet`),
    enabled: !!instanceId
  });
}

// ---- Mutations ----

export function useEnableAura(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Aura" },
    mutationFn: (auraId: string) =>
      sendJson<AuraEnableResultDto>(`/api/aura-runtime/${playerId}/enable`, "POST", { auraId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auraRuntime", playerId] });
    }
  });
}

export function useDisableAura(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Aura" },
    mutationFn: (auraId: string) =>
      sendJson<AuraDisableResultDto>(`/api/aura-runtime/${playerId}/disable`, "POST", { auraId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auraRuntime", playerId] });
    }
  });
}
