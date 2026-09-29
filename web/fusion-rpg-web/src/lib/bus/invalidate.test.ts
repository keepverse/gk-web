import { describe, expect, it } from "vitest";
import { keysForEventKind } from "./invalidate";
import { queryKeys } from "./keys";

describe("keysForEventKind", () => {
  it("maps board/match/wave kinds to runs, metrics, health", () => {
    expect(keysForEventKind("board.start")).toEqual([
      queryKeys.runs,
      queryKeys.metrics,
      queryKeys.health
    ]);
    expect(keysForEventKind("match.result")).toEqual([
      queryKeys.runs,
      queryKeys.metrics,
      queryKeys.health
    ]);
    expect(keysForEventKind("wave.advance")).toEqual([
      queryKeys.runs,
      queryKeys.metrics,
      queryKeys.health
    ]);
  });

  it("maps plant/zombie/mower kinds to types, sim, metrics", () => {
    expect(keysForEventKind("plant.spawn")).toEqual([
      queryKeys.types,
      queryKeys.sim,
      queryKeys.metrics
    ]);
    expect(keysForEventKind("zombie.die")).toEqual([
      queryKeys.types,
      queryKeys.sim,
      queryKeys.metrics
    ]);
    expect(keysForEventKind("mower.start")).toEqual([
      queryKeys.types,
      queryKeys.sim,
      queryKeys.metrics
    ]);
  });

  it("maps mix/recipe/fusion kinds to recipes", () => {
    expect(keysForEventKind("plant.mix")).toEqual([queryKeys.recipes]);
    expect(keysForEventKind("recipe.dump")).toEqual([queryKeys.recipes]);
    expect(keysForEventKind("fusion.unlock")).toEqual([queryKeys.recipes]);
  });

  it("returns empty for unknown kinds", () => {
    expect(keysForEventKind("injector.hello")).toEqual([]);
    expect(keysForEventKind("custom.thing")).toEqual([]);
  });
});
