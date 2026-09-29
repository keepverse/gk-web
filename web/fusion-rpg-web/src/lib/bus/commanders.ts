import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptCommanderList } from "@/contract/adapt";
import type { CommanderListView } from "@/contract/types";
import { queryKeys } from "./keys";
import { getJson, sendJson } from "./rest";

type CommanderListResponseDto = Parameters<typeof adaptCommanderList>[0];

type DefaultLawnCommanderResponseDto = {
  defaultLawnCommanderId: string;
};

type SetDefaultLawnCommanderRequestDto = {
  playerId?: number;
  commanderId: string;
};

export function useCommanders(playerId: number) {
  return useQuery({
    queryKey: queryKeys.commanders(playerId),
    queryFn: async (): Promise<CommanderListView> => {
      const dto = await getJson<CommanderListResponseDto>(`/api/commanders/${playerId}`);
      return adaptCommanderList(dto);
    },
    enabled: playerId > 0
  });
}

export function useSetDefaultCommander(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Commander" },
    mutationFn: (commanderId: string) =>
      sendJson<DefaultLawnCommanderResponseDto>("/api/commanders/default", "POST", {
        playerId,
        commanderId
      } satisfies SetDefaultLawnCommanderRequestDto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.commanders(playerId) });
    }
  });
}
