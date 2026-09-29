/**
 * aptitude-sheet AS-3.4/3.5 — FE hooks for `/api/aptitude-presets`.
 * Favour is sharesPermille only (S1); empty {} refuses favour seed (S7).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson, tryGetJson } from "./rest";
import { queryKeys } from "./keys";

export type AptitudePresetRow = {
  aptitudeId: string;
  targetPermille: number;
  minAbs?: number | null;
  maxAbs?: number | null;
  minPermille?: number | null;
  maxPermille?: number | null;
};

export type AptitudePreset = {
  presetId: string;
  playerId: number;
  name: string;
  kind: string;
  createdUtc?: string;
  revision?: number;
  rows: AptitudePresetRow[];
};

export type AptitudePresetFavour = {
  sharesPermille: Record<string, number>;
};

export type AptitudePresetActive = {
  playerId: number;
  scope: string;
  scopeKey: string;
  presetId: string | null;
};

export type AptitudePresetMaterializeResult = {
  presetId: string;
  budget: number;
  shares: Record<string, number>;
  leftover: number;
};

/** Probe whether the presets API is mounted (AS-3.5 stub). */
export async function probeAptitudePresetsApi(playerId: number): Promise<boolean> {
  try {
    const r = await tryGetJson<{ presets: AptitudePreset[] }>(`/api/aptitude-presets/${playerId}`);
    return r !== null;
  } catch {
    return false;
  }
}

export async function fetchAptitudePresetFavour(
  speciesId: string
): Promise<Record<string, number>> {
  const r = await getJson<AptitudePresetFavour>(
    `/api/aptitude-presets/favour/${encodeURIComponent(speciesId)}`
  );
  return r.sharesPermille ?? {};
}

export async function fetchAptitudePresetActive(
  playerId: number,
  scope: string,
  scopeKey: string
): Promise<AptitudePresetActive | null> {
  const q = new URLSearchParams({
    playerId: String(playerId),
    scope,
    scopeKey
  });
  return tryGetJson<AptitudePresetActive>(`/api/aptitude-presets/active?${q}`);
}

/**
 * spec-auto-assign-control.md (EP1.20, C1) — the closed rule ids this scope may offer, from the
 * server: never a hardcoded FE list. Mode C (commander) omits `species-favour` server-side (C5),
 * so the FE never re-decides that hiding rule itself.
 */
export async function fetchAutoAssignRules(
  scope: "commander" | "unique" | "species"
): Promise<string[]> {
  const r = await getJson<{ scope: string; rules: string[] }>(
    `/api/aptitude-presets/rules?scope=${encodeURIComponent(scope)}`
  );
  return r.rules ?? [];
}

export function useAutoAssignRules(scope: "commander" | "unique" | "species" | null | undefined) {
  return useQuery({
    queryKey: queryKeys.autoAssignRules(scope ?? ""),
    queryFn: () => fetchAutoAssignRules(scope!),
    enabled: !!scope,
    retry: false
  });
}

export async function materializeAptitudePreset(
  presetId: string,
  budget: number,
  playerId?: number
): Promise<AptitudePresetMaterializeResult> {
  return sendJson<AptitudePresetMaterializeResult>("/api/aptitude-presets/materialize", "POST", {
    presetId,
    budget,
    playerId
  });
}

export type AptitudePresetSuggestResult = {
  ruleId: string;
  rows: AptitudePresetRow[];
  skipped: { ruleId: string; reason: string }[];
  draftShares: Record<string, number>;
  leftover: number;
};

/**
 * spec-assign-ladder.md (EP1.4/EP1.5) — the one place a build suggestion is computed. `rule`
 * omitted walks the server's own ladder order; given, only that rule runs. Draft only — never
 * persists, and the caller runs no share arithmetic of its own.
 */
export async function suggestAptitudePreset(body: {
  playerId: number;
  scope: "commander" | "unique" | "species";
  scopeKey?: string;
  rule?: string;
}): Promise<AptitudePresetSuggestResult> {
  return sendJson<AptitudePresetSuggestResult>("/api/aptitude-presets/suggest", "POST", {
    playerId: body.playerId,
    scope: body.scope,
    scopeKey: body.scopeKey ?? "",
    rule: body.rule
  });
}

/** Rows → targetPermille map for draft fill when materialize endpoint is unused. */
export function presetRowsToPermille(rows: AptitudePresetRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.aptitudeId) out[row.aptitudeId] = Number(row.targetPermille) || 0;
  }
  return out;
}

export function useAptitudePresets(playerId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.aptitudePresets(playerId ?? 0),
    queryFn: async () => {
      const r = await getJson<{ presets: AptitudePreset[] }>(`/api/aptitude-presets/${playerId}`);
      return r.presets ?? [];
    },
    enabled: playerId != null && playerId > 0,
    retry: false
  });
}

export function useAptitudePresetFavour(speciesId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.aptitudePresetFavour(speciesId ?? ""),
    queryFn: () => fetchAptitudePresetFavour(speciesId!),
    enabled: !!speciesId,
    retry: false
  });
}

export function useAptitudePresetActive(
  playerId: number | null | undefined,
  scope: string | null | undefined,
  scopeKey: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.aptitudePresetActive(playerId ?? 0, scope ?? "", scopeKey ?? ""),
    queryFn: () => fetchAptitudePresetActive(playerId!, scope!, scopeKey ?? ""),
    enabled: playerId != null && playerId > 0 && !!scope,
    retry: false
  });
}

export function useSaveAptitudePreset() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "AptitudePresets" },
    mutationFn: (body: {
      playerId: number;
      name: string;
      kind?: string;
      presetId?: string;
      rows: AptitudePresetRow[];
    }) => sendJson<AptitudePreset>("/api/aptitude-presets/", "POST", body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitudePresets(vars.playerId) });
    }
  });
}

export function useUpdateAptitudePreset() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "AptitudePresets" },
    mutationFn: (body: {
      presetId: string;
      playerId: number;
      name: string;
      kind?: string;
      rows: AptitudePresetRow[];
    }) =>
      sendJson<AptitudePreset>(`/api/aptitude-presets/${encodeURIComponent(body.presetId)}`, "PUT", {
        playerId: body.playerId,
        name: body.name,
        kind: body.kind,
        rows: body.rows
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitudePresets(vars.playerId) });
    }
  });
}

export function useDeleteAptitudePreset() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "AptitudePresets" },
    mutationFn: (body: { presetId: string; playerId: number }) =>
      sendJson<{ deleted: string }>(
        `/api/aptitude-presets/${encodeURIComponent(body.presetId)}?playerId=${body.playerId}`,
        "DELETE"
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitudePresets(vars.playerId) });
    }
  });
}

export type AptitudePresetActivateResult = {
  playerId: number;
  presetId: string;
  scope: string;
  scopeKey: string;
  budget: number;
  shares: Record<string, number>;
  leftover: number;
  priced?: boolean;
  priceAmount?: number;
  respecCount?: number;
  soulBalance?: number | null;
  replay?: boolean;
};

/** S3 — sole Activate path. Do not sequence set-active + allocate on the client. */
export function useActivateAptitudePreset() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "AptitudePresets" },
    mutationFn: (body: {
      playerId: number;
      presetId: string;
      scope: "commander" | "unique" | "species";
      scopeKey?: string;
      correlationId?: string;
    }) =>
      sendJson<AptitudePresetActivateResult>("/api/aptitude-presets/activate", "POST", {
        playerId: body.playerId,
        presetId: body.presetId,
        scope: body.scope,
        scopeKey: body.scopeKey ?? "",
        correlationId: body.correlationId
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitudePresets(data.playerId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.aptitudePresetActive(data.playerId, data.scope, data.scopeKey ?? "")
      });
      if (data.scope === "commander") {
        void qc.invalidateQueries({ queryKey: queryKeys.aptitudes(data.playerId) });
      } else if (data.scope === "unique" && data.scopeKey) {
        void qc.invalidateQueries({ queryKey: queryKeys.uniqueAptitudes(data.scopeKey) });
      } else if (data.scope === "species" && data.scopeKey) {
        void qc.invalidateQueries({ queryKey: ["speciesBuild", data.playerId, data.scopeKey] });
      }
    }
  });
}
