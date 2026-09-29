import { describe, expect, it } from "vitest";
import { createConditionSurfaceBus, type ConditionSurfaceEvent } from "./conditionSurfaceBus";

/** CG-D2 — closed bus catalog (parity with surface-vm §6 / recipe-wire). */
const CLOSED_CATALOG: ConditionSurfaceEvent[] = [
  "condition.pool.select",
  "condition.status.open",
  "condition.retry"
];

describe("conditionSurfaceBus closed catalog", () => {
  it("exposes exactly the three locked events", () => {
    expect(CLOSED_CATALOG).toEqual([
      "condition.pool.select",
      "condition.status.open",
      "condition.retry"
    ]);
    const bus = createConditionSurfaceBus();
    const hits: ConditionSurfaceEvent[] = [];
    for (const ev of CLOSED_CATALOG) {
      bus.on(ev, () => hits.push(ev));
    }
    bus.emit("condition.pool.select", { poolId: "stamina" });
    bus.emit("condition.status.open", { statusId: "burn" });
    bus.emit("condition.retry", {});
    expect(hits).toEqual(CLOSED_CATALOG);
  });
});
