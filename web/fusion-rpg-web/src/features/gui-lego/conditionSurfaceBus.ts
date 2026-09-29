import { createSurfaceBus } from "./createSurfaceBus";

export type ConditionSurfaceEvent =
  | "condition.pool.select"
  | "condition.status.open"
  | "condition.retry";

export function createConditionSurfaceBus() {
  return createSurfaceBus<ConditionSurfaceEvent>();
}
