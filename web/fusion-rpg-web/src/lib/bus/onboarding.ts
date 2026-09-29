import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingState } from "@/contract/types";
import { queryKeys } from "./keys";
import { getJson, sendJson } from "./rest";

type CheckpointDto = {
  checkpointId: string; state: string; earnedRunId?: number | null; rewardRef?: string | null;
  payloadJson?: string | null; earnedUtc: string; claimedUtc?: string | null; revision: number;
};
type StoryDto = {
  storyId: string; version: number; state: string; outcome?: string | null; eligible: boolean;
  acknowledgedUtc?: string | null; revision: number;
};
type StateDto = {
  playerId: number; playerLevel: number; revision: number; checkpoints: CheckpointDto[]; stories?: StoryDto[];
};

function adapt(dto: StateDto): OnboardingState {
  return {
    playerId: dto.playerId,
    playerLevel: dto.playerLevel,
    revision: dto.revision,
    checkpoints: dto.checkpoints.map((row) => ({
      checkpointId: row.checkpointId, state: row.state, earnedRunId: row.earnedRunId ?? null,
      rewardRef: row.rewardRef ?? null, payloadJson: row.payloadJson ?? null,
      earnedUtc: row.earnedUtc, claimedUtc: row.claimedUtc ?? null, revision: row.revision
    })),
    stories: (dto.stories ?? []).map((row) => ({
      storyId: row.storyId,
      version: row.version,
      state: row.state,
      outcome: row.outcome ?? null,
      eligible: row.eligible,
      acknowledgedUtc: row.acknowledgedUtc ?? null,
      revision: row.revision
    }))
  };
}

export function useOnboarding(playerId: number) {
  return useQuery({
    queryKey: queryKeys.onboarding(playerId),
    queryFn: async () => adapt(await getJson<StateDto>(`/api/onboarding/${playerId}`)),
    enabled: playerId > 0,
    staleTime: 0
  });
}

export function useClaimOnboarding(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Onboarding" },
    mutationFn: (checkpointId: string) =>
      sendJson(`/api/onboarding/${playerId}/checkpoints/${encodeURIComponent(checkpointId)}/claim`, "POST", {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.onboarding(playerId) })
  });
}

export function useAcknowledgeOnboardingStory(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "OnboardingStory" },
    mutationFn: ({ storyId, version, outcome }: { storyId: string; version: number; outcome: "completed" | "skipped" }) =>
      sendJson(`/api/onboarding/${playerId}/stories/${encodeURIComponent(storyId)}/ack`, "POST", { version, outcome }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.onboarding(playerId) })
  });
}
