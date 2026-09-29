import type { BoardActorRecord } from "./BoardActorRecord";
import type { SyncSeq } from "./syncSeq";

/**
 * Live cell-board apply — NOT SyncFromModelSystem / LawnViewModel.
 * Thin stub until lawn-plane / siege wires a real layers+registry view.
 * Callers must pass server-confirmed actor lists only (RT-15).
 */
export function applyLiveBoard(
  _view: unknown,
  actors: readonly BoardActorRecord[],
  seq: SyncSeq
): void {
  if (import.meta.env.DEV) {
    console.info("[applyLiveBoard]", {
      event: "apply",
      actorCount: actors.length,
      seq
    });
  }
  // Stub: production paint remains Graphics BoardLayers (`paintLawnTerrainGraphics`) /
  // SyncFromModel until siege wires applyLiveBoard for live sync.
}
