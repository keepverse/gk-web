/**
 * Canonical re-exports for siege/battle unpause (lock 5a freeze list).
 * Prefer importing from here or the leaf modules — never LawnWorldScene.
 */
export { makeGridSpec, type GridSpec } from "./GridSpec";
export { pickCell } from "./pickCell";
export { createBoardLayers } from "./BoardLayers";
export { createTerrainCache, createRenderTextureTerrainSink } from "./terrainCache";
export { wireKeyboardNav } from "./keyboardNav";
export { visualFor } from "./visualMapping";
export type { BoardActorRecord, BoardSelectPayload } from "./BoardActorRecord";
export type { SyncSeq } from "./syncSeq";
export { applyLiveBoard } from "./applyLiveBoard";
export { applyPlaybackFrame } from "./applyPlaybackFrame";
export { paintStructureHpBar } from "./structureHpBar";

/** Banned lawn imports for siege/battle stages — scanned by doNotImport.test.ts */
export const BOARD_DO_NOT_IMPORT = [
  "SyncFromModelSystem",
  "PickSystem",
  "ActorHudDisplay",
  "PtrEntityRegistry",
  "LawnWorldScene",
  "ensureGrid"
] as const;
