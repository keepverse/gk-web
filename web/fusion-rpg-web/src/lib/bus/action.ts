import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";

// ---- DTOs (A27/A28 wire shapes -- SpecimenLoadoutEndpoints.cs / UnlockDiscardEndpoints.cs) ----

/** GET /api/actors/{instanceId}/loadout -- A27's own response shape (held/equipped is the catalog:
 * there is no separate action-catalog endpoint to fetch). `actionIds` is the equipped/battle loadout
 * (<=5, `GetLoadoutOrAutoEquip`'s own output); `heldActionIds` is the specimen's WHOLE held set,
 * needed to render "2 held, 1 equipped" at all. */
export type ActionLoadoutDto = {
  instanceId: string;
  actionIds: string[];
  heldActionIds: string[];
};

/** POST /api/actors/{instanceId}/loadout -- same shape minus `heldActionIds` (the equip write only
 * ever echoes back the equipped set it just persisted). */
export type SetActionLoadoutResultDto = {
  instanceId: string;
  actionIds: string[];
};

export type SoulBalanceDto = {
  playerId: number;
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  revision: number;
  updatedUtc: string;
};

/** POST /api/actors/{instanceId}/unlock/discard -- A28's own response shape. `balance` echoes the
 * post-spend soul balance so the FE never needs a second round trip to show it. */
export type DiscardUnlockResultDto = {
  instanceId: string;
  unlockId: string;
  balance: SoulBalanceDto | null;
};

// ---- Queries ----

export function useActionLoadout(instanceId: string | null | undefined) {
  return useQuery({
    queryKey: ["actionLoadout", instanceId ?? ""] as const,
    queryFn: () => getJson<ActionLoadoutDto>(`/api/actors/${encodeURIComponent(instanceId!)}/loadout`),
    enabled: !!instanceId
  });
}

// ---- Mutations ----

export function useSetLoadout(instanceId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "ActionLoadout" },
    mutationFn: (actionIds: string[]) =>
      sendJson<SetActionLoadoutResultDto>(`/api/actors/${encodeURIComponent(instanceId!)}/loadout`, "POST", { actionIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["actionLoadout", instanceId ?? ""] });
    }
  });
}

export function useDiscardUnlock(instanceId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "ActionUnlock" },
    mutationFn: (unlockId: string) =>
      sendJson<DiscardUnlockResultDto>(`/api/actors/${encodeURIComponent(instanceId!)}/unlock/discard`, "POST", { unlockId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["actionLoadout", instanceId ?? ""] });
    }
  });
}
