import type { LawnPhase } from "./lawnViewModel";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";

/** UI-only interaction FSM — never CapPolicy / UniqueActor. */
export type InteractionMode =
  | "Idle"
  | "TileSelected"
  | "OccupantSelected"
  | "SpawnTargeting"
  | "ActionTargeting";

export type InteractionState = {
  mode: InteractionMode;
  row?: number;
  col?: number;
  ptr?: string;
  /** Armed commander action slot id (ActionTargeting). */
  actionId?: string;
};

export function idleInteraction(): InteractionState {
  return { mode: "Idle" };
}

/** RT-06: SpawnTargeting disabled in Idle / Ending. */
export function canEnterSpawnTargeting(phase: LawnPhase): boolean {
  return phase === "Starting" || phase === "InMatch" || phase === "Paused";
}

export function canEnterActionTargeting(phase: LawnPhase): boolean {
  return phase === "Starting" || phase === "InMatch" || phase === "Paused";
}

export type InteractionEvent =
  | { type: "selectTile"; row: number; col: number }
  | { type: "selectOccupant"; ptr: string; row?: number; col?: number }
  | { type: "clear" }
  | { type: "enterSpawnTargeting" }
  | { type: "enterActionTargeting"; actionId: string }
  | { type: "cancelArmed" }
  | { type: "phaseChanged"; phase: LawnPhase };

export function reduceInteraction(
  state: InteractionState,
  event: InteractionEvent,
  phase: LawnPhase
): InteractionState {
  switch (event.type) {
    case "clear":
      return idleInteraction();
    case "cancelArmed":
      if (state.mode === "SpawnTargeting" || state.mode === "ActionTargeting") {
        logLawnInteractive("order.cancel", { from: state.mode, actionId: state.actionId });
        return state.row != null && state.col != null
          ? { mode: "TileSelected", row: state.row, col: state.col }
          : idleInteraction();
      }
      return state;
    case "selectTile":
      if (state.mode === "SpawnTargeting") {
        return {
          mode: "SpawnTargeting",
          row: event.row,
          col: event.col,
          ptr: undefined
        };
      }
      if (state.mode === "ActionTargeting") {
        return {
          mode: "ActionTargeting",
          row: event.row,
          col: event.col,
          ptr: undefined,
          actionId: state.actionId
        };
      }
      return { mode: "TileSelected", row: event.row, col: event.col };
    case "selectOccupant":
      // Armed order/spawn: do not clobber into OccupantSelected inspect.
      if (state.mode === "ActionTargeting") {
        return {
          mode: "ActionTargeting",
          ptr: event.ptr,
          row: event.row,
          col: event.col,
          actionId: state.actionId
        };
      }
      if (state.mode === "SpawnTargeting") {
        return {
          mode: "SpawnTargeting",
          row: event.row,
          col: event.col,
          ptr: undefined
        };
      }
      return {
        mode: "OccupantSelected",
        ptr: event.ptr,
        row: event.row,
        col: event.col
      };
    case "enterSpawnTargeting":
      if (!canEnterSpawnTargeting(phase)) return state;
      logLawnInteractive("spawn.enter", { row: state.row, col: state.col });
      return {
        mode: "SpawnTargeting",
        row: state.row,
        col: state.col,
        ptr: undefined
      };
    case "enterActionTargeting":
      if (!canEnterActionTargeting(phase)) return state;
      logLawnInteractive("order.arm", { actionId: event.actionId });
      return {
        mode: "ActionTargeting",
        row: state.row,
        col: state.col,
        ptr: state.ptr,
        actionId: event.actionId
      };
    case "phaseChanged":
      if (
        (state.mode === "SpawnTargeting" && !canEnterSpawnTargeting(event.phase)) ||
        (state.mode === "ActionTargeting" && !canEnterActionTargeting(event.phase))
      ) {
        return idleInteraction();
      }
      return state;
    default:
      return state;
  }
}

/** Board arrows stay live in SpawnTargeting even if Band 2 would mute under GG-18. */
export function boardArrowsLive(mode: InteractionMode, dockOrSheetOpen: boolean): boolean {
  if (mode === "SpawnTargeting") return true;
  if (mode === "ActionTargeting") return true;
  return !dockOrSheetOpen;
}
