import { createSurfaceBus } from "./createSurfaceBus";

/** Closed aptitudes-console bus (spec-aptitudes-surface-vm). */
export type AptitudesSurfaceEvent =
  | "aptitude.select"
  | "aptitude.step"
  | "aptitude.set"
  | "aptitude.reset"
  | "aptitude.confirm"
  | "aptitude.autoAssign"
  | "preset.open"
  | "aptitude.retry";

export function createAptitudesSurfaceBus() {
  return createSurfaceBus<AptitudesSurfaceEvent>();
}

export const APTITUDES_SURFACE_EVENTS: readonly AptitudesSurfaceEvent[] = [
  "aptitude.select",
  "aptitude.step",
  "aptitude.set",
  "aptitude.reset",
  "aptitude.confirm",
  "aptitude.autoAssign",
  "preset.open",
  "aptitude.retry"
] as const;
