import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";

// ---- DTOs (spec-creature-contracts.md wire shapes) ----

export type ContractRowDto = {
  instanceId: string;
  bound: boolean;
  loyalty: number;
  rank: string;
  rankBonusMilli: number;
  personality: string;
  upkeepPerDay: number;
  deployable: boolean;
};

export type ContractCapacityDto = {
  used: number;
  total: number;
  purchasedSlots: number;
  nextSlotPrice: number;
  canBuy: boolean;
  maxSlots: number;
};

export type ContractStateDto = {
  capacity: ContractCapacityDto;
  dailyTribute: number;
  deployFloor: number;
  loyaltyMax: number;
  contracts: ContractRowDto[];
};

export const contractKeys = {
  state: (playerId: number) => ["contracts", playerId] as const
};

export function useContracts(playerId: number) {
  return useQuery({
    queryKey: contractKeys.state(playerId),
    queryFn: () => getJson<ContractStateDto>(`/api/contracts/${playerId}`),
    enabled: playerId > 0
  });
}

/** Every contract write can move the Souls balance (pact fee, ritual, slot), so both invalidate. */
function useContractMutation<TReq>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: TReq) => sendJson<ContractStateDto>(path, "POST", req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      void qc.invalidateQueries({ queryKey: ["souls"] });
      void qc.invalidateQueries({ queryKey: ["creatures"] });
    }
  });
}

export function useBindContract() {
  return useContractMutation<{ playerId?: number; instanceId: string }>("/api/contracts/bind");
}

export function useReleaseContract() {
  return useContractMutation<{ playerId?: number; instanceId: string }>("/api/contracts/release");
}

export function usePerformRitual() {
  return useContractMutation<{ playerId?: number; instanceId: string; correlationId: string }>(
    "/api/contracts/ritual"
  );
}

export function useBuyContractSlot() {
  return useContractMutation<{ playerId?: number; correlationId: string }>("/api/contracts/slots/buy");
}
