/**
 * Player-band fiction for Derived (DC-8).
 * Spec: docs/architecture/derived-cook/spec-derived-player-copy.md
 * Seeded from design §3–§4; catalog/locale keys — not engine vocabulary.
 */

/** Compose-kind → fiction sentence (catalog/locale SSOT seed). */
export const COMPOSE_SENTENCE: Record<string, string> = {
  FlatSum: "Sources add together.",
  FlatReplace: "The strongest source wins — these do not add.",
  SumIncreased: "Sources add, up to the cap.",
  MaxPriorityFlag: "On or off — the strongest source decides."
};

/** UnitClass → fiction sentence (catalog/locale SSOT seed). */
export const UNIT_SENTENCE: Record<string, string> = {
  GameUnits: "Game units — uncapped magnitude.",
  PerMilleRatio: "Per-mille ratio (÷1000).",
  SigmoidPoints: "Sigmoid points into a chance curve.",
  UnitInterval: "Unit interval 0…1.",
  Flag: "On or off flag.",
  LadderIndex: "Power rung on the ladder.",
  StatusPotencyPoints: "Status potency points.",
  SigmoidMultiplierPoints: "Sigmoid multiplier points.",
  AptitudePoints: "Aptitude points.",
  ReciprocalPoints: "Reciprocal points."
};

/** Six-state → player fiction (design §3). Never raw enums as product copy. */
export const RENDER_STATE_FICTION: Record<string, string> = {
  active: "Live",
  default: "At rest",
  capped: "At cap",
  stub: "Placeholder",
  "no-producer": "Nothing grants this yet",
  unregistered: "Not on this sheet"
};

export const SOURCES_TITLE = "Sources";

export const UNATTRIBUTED_LABEL = "(unattributed)";

export function composeFiction(composeKind: string): string {
  return COMPOSE_SENTENCE[composeKind] ?? composeKind;
}

export function unitFiction(unitClass: string): string {
  return UNIT_SENTENCE[unitClass] ?? unitClass;
}

export function stateFiction(state: string): string {
  return RENDER_STATE_FICTION[state] ?? state;
}

/** Fiction producer label — empty SourceId → explicit unattributed row (§5.3). */
export function sourceFictionLabel(sourceId: string, wiredLabel?: string): string {
  if (!sourceId.trim()) return UNATTRIBUTED_LABEL;
  if (wiredLabel?.trim()) return wiredLabel;
  return sourceId;
}
