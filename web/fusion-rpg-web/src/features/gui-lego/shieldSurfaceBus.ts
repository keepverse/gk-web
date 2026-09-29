import { createSurfaceBus } from "./createSurfaceBus";

export type ShieldSurfaceEvent = "shield.layer.select" | "shield.retry";

export function createShieldSurfaceBus() {
  return createSurfaceBus<ShieldSurfaceEvent>();
}
