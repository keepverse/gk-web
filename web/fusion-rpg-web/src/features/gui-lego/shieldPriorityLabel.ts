/**
 * Priority fiction labels for shield layers — aura / skill / innate.
 * Thresholds from gk-core/data/tuning/shield.v1.json drainPriority.
 */
import shieldTuning from "../../../../../data/tuning/shield.v1.json";

const AURA = shieldTuning.drainPriority.aura;
const SKILL = shieldTuning.drainPriority.skill;

export type ShieldPriorityFiction = "Aura" | "Skill" | "Innate";

/** Map drain priority (+ optional innate flag) → player fiction label. */
export function shieldPriorityLabel(priority: number, isInnate = false): ShieldPriorityFiction {
  if (isInnate) return "Innate";
  if (priority >= AURA) return "Aura";
  if (priority >= SKILL) return "Skill";
  return "Innate";
}

export const MAX_SHIELD_LAYERS = shieldTuning.maxShieldsPerActor;
