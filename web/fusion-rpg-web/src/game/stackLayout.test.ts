import { describe, expect, it } from "vitest";
import { LAWN_CELL_STACK_MAX_SPRITES } from "@/ui/lawn/lawnPresentationTokens";
import { stackDrawPlan, stackOffset } from "./stackLayout";

describe("stackDrawPlan", () => {
  it("draws every occupant when count ≤ maxSprites", () => {
    expect(stackDrawPlan(0)).toEqual({ drawCount: 0, overflowK: 0 });
    expect(stackDrawPlan(1)).toEqual({ drawCount: 1, overflowK: 0 });
    expect(stackDrawPlan(LAWN_CELL_STACK_MAX_SPRITES)).toEqual({
      drawCount: LAWN_CELL_STACK_MAX_SPRITES,
      overflowK: 0
    });
  });

  it("caps drawCount and reports overflow K above maxSprites", () => {
    expect(stackDrawPlan(LAWN_CELL_STACK_MAX_SPRITES + 1)).toEqual({
      drawCount: LAWN_CELL_STACK_MAX_SPRITES,
      overflowK: 1
    });
    expect(stackDrawPlan(12, 4)).toEqual({ drawCount: 4, overflowK: 8 });
  });

  it("honours an explicit maxSprites override", () => {
    expect(stackDrawPlan(5, 2)).toEqual({ drawCount: 2, overflowK: 3 });
    expect(stackDrawPlan(2, 2)).toEqual({ drawCount: 2, overflowK: 0 });
  });
});

describe("stackOffset", () => {
  it("plants stack left, zombies right", () => {
    expect(stackOffset("plant", 0, 2).dx).toBeLessThan(0);
    expect(stackOffset("zombie", 0, 2).dx).toBeGreaterThan(0);
  });
});
