import { describe, expect, it } from "vitest";
import { HARD_BLOCKING_EVENTS, NAGGING_EVENTS } from "./blockingClasses";

describe("blockingClasses — the declared list (world-stage W81, spec-world-turn.md §2)", () => {
  it("HARD_BLOCKING_EVENTS ships empty — any addition must be argued in spec-world-turn.md §2 first", () => {
    expect(HARD_BLOCKING_EVENTS).toEqual([]);
  });

  it("NAGGING_EVENTS is populated and battle results are not in either list", () => {
    expect(NAGGING_EVENTS.length).toBeGreaterThan(0);
    expect(HARD_BLOCKING_EVENTS).not.toContain("battle.result");
    expect(NAGGING_EVENTS).not.toContain("battle.result");
  });
});
