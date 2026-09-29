import type { LawnInteractionPayload } from "@/game/EventBus";
import type { InteractionState } from "./interactionMode";

/** True when host should stash model/interaction until lawn:ready. */
export function shouldBuffer(ready: boolean): boolean {
  return !ready;
}

/** Take and clear a buffered value (flush-on-ready). */
export function takeBuffered<T>(box: { current: T | null }): T | null {
  const v = box.current;
  box.current = null;
  return v;
}

/** Emit lawn:model when revision is new or this is the first emit after mount. */
export function shouldEmitLawnModel(
  prevRev: number | undefined,
  nextRev: number
): boolean {
  if (prevRev === undefined) return true;
  return nextRev !== prevRev;
}

/** Build generation-scoped interaction bus payload. */
export function toInteractionPayload(
  generation: number,
  interaction: InteractionState
): LawnInteractionPayload {
  return {
    generation,
    mode: interaction.mode,
    row: interaction.row,
    col: interaction.col,
    ptr: interaction.ptr
  };
}
