/** Pure stack offsets for grid+stack view — plants left, zombies right. */

import {
  LAWN_CELL_STACK_MAX_SPRITES,
  LAWN_CELL_STACK_OFFSET_PX
} from "@/ui/lawn/lawnPresentationTokens";

export type StackSide = "plant" | "zombie";

export function stackOffset(
  side: StackSide,
  index: number,
  count: number,
  offsetPx: number = LAWN_CELL_STACK_OFFSET_PX
): { dx: number; dy: number; depth: number } {
  const n = Math.max(1, count);
  const i = Math.max(0, index);
  const mid = (n - 1) / 2;
  const dx = side === "plant" ? -offsetPx * 2 : offsetPx * 2;
  const dy = (i - mid) * offsetPx;
  return { dx, dy, depth: 10 + i };
}

/**
 * Structural draw cap — not a progression ceiling.
 * Returns how many sprites to draw and overflow K for `+K` pip.
 */
export function stackDrawPlan(
  count: number,
  maxSprites: number = LAWN_CELL_STACK_MAX_SPRITES
): { drawCount: number; overflowK: number } {
  if (count <= maxSprites) return { drawCount: count, overflowK: 0 };
  return { drawCount: maxSprites, overflowK: count - maxSprites };
}
