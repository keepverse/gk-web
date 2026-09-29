import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";

// ---- DTOs (spec-patron-creature.md wire shapes) ----

export type PatronAuraDto = {
  elementPrimary: string;
  elementSecondary?: string | null;
  powerMilli: number;
  defenseMilli: number;
  secondaryPowerMilli: number;
  secondaryDefenseMilli: number;
};

export type PatronDto = {
  instanceId: string;
  setUtc: string;
  revision: number;
  aura: PatronAuraDto;
  switchCostSouls: number;
};

export type PatronStateDto = {
  patron: PatronDto | null;
  switchCostSouls: number;
};

export const patronKeys = {
  state: (playerId: number) => ["patron", playerId] as const
};

export function usePatron(playerId: number) {
  return useQuery({
    queryKey: patronKeys.state(playerId),
    queryFn: () => getJson<PatronStateDto>(`/api/patron/${playerId}`),
    enabled: playerId > 0
  });
}

export function useSetPatron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { playerId?: number; instanceId: string; correlationId: string }) =>
      sendJson<PatronStateDto>("/api/patron/set", "POST", req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patron"] });
      void qc.invalidateQueries({ queryKey: ["souls"] }); // switches spend
    }
  });
}
