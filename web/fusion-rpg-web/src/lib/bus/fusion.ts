import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";
import type { CreatureSpecimenDto, SoulBalanceDto } from "./creatures";
import type { FusionCostDto, PickableAtom, SelectedPick } from "@/features/fusion/fusionView";

// ---- DTOs (spec-creature-fusion.md wire shapes; undiscovered recipes carry no identity) ----

export type FusionMode = "star-merge" | "promotion" | "recipe";
export type { PickableAtom, SelectedPick };

export type RecipeBrowserItem = {
  slot: number;
  discovered: boolean;
  recipeId?: string;
  resultSpeciesId?: string;
  resultRarity: string;
  inputs?: string[] | null;
  cost: FusionCostDto;
};

export type FusionPreviewDto = {
  ok: boolean;
  reason?: string;
  cost?: FusionCostDto;
  targetStar?: number;
  sacrificesNeeded?: number;
  newRarity?: string;
  newSlots?: number;
  discovered?: boolean;
  resultSpeciesId?: string | null;
  resultRarity?: string;
  pickableTraits?: string[];
  pickableAtoms?: PickableAtom[];
  pickSlotCap?: number;
};

export type FusionOutcomeDto = {
  replayed: boolean;
  mode: FusionMode;
  base?: CreatureSpecimenDto | null;
  minted?: CreatureSpecimenDto | null;
  recipeId?: string | null;
  newlyDiscovered: boolean;
  discoverySouls: number;
  balance: SoulBalanceDto;
};

export type FusionRequestBody = {
  playerId?: number;
  mode: FusionMode;
  baseInstanceId?: string | null;
  sacrifices: string[];
  pickedTraitId?: string | null;
  picks?: SelectedPick[];
  correlationId?: string;
};

// ---- Queries ----

export const fusionKeys = {
  recipes: (playerId: number) => ["fusionRecipes", playerId] as const
};

export function useFusionRecipes(playerId: number) {
  return useQuery({
    queryKey: fusionKeys.recipes(playerId),
    queryFn: () => getJson<{ items: RecipeBrowserItem[] }>(`/api/fusion/${playerId}/recipes`),
    enabled: playerId > 0
  });
}

// ---- Mutations ----

export function useFusionPreview() {
  return useMutation({
    mutationFn: (req: FusionRequestBody) =>
      sendJson<FusionPreviewDto>("/api/fusion/preview", "POST", req)
  });
}

export function useFusionExecute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: FusionRequestBody) =>
      sendJson<FusionOutcomeDto>("/api/fusion/execute", "POST", req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["creatureRoster"] });
      void qc.invalidateQueries({ queryKey: ["creatureCodex"] });
      void qc.invalidateQueries({ queryKey: ["souls"] });
      void qc.invalidateQueries({ queryKey: ["creatureMaterials"] });
      void qc.invalidateQueries({ queryKey: ["fusionRecipes"] });
    }
  });
}
