import type { QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export function keysForEventKind(kind: string): QueryKey[] {
  if (kind.includes("mix") || kind.includes("recipe") || kind.startsWith("fusion.")) {
    return [queryKeys.recipes];
  }
  if (kind.startsWith("board.") || kind.startsWith("match.") || kind.startsWith("wave.")) {
    return [queryKeys.runs, queryKeys.metrics, queryKeys.health];
  }
  if (kind.startsWith("plant.") || kind.startsWith("zombie.") || kind.startsWith("mower.")) {
    return [queryKeys.types, queryKeys.sim, queryKeys.metrics];
  }
  return [];
}
