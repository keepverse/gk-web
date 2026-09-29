import type { IntelState } from "@/contract/types";
import type { Ownership } from "@/stages/world/render/sectorChannels";

/**
 * One exhaustive table per world enum surface (world-numbers W40) — intel, phase, ownership, force
 * kind — each with a **loud** failure on an unmapped value. The failure mode this replaces is
 * silent and symptomless: a naive `intel === "watched"` never matches because the wire says
 * `"Watched"`, and `"rumoured"` never matches because the wire says `"Rumored"` (American spelling,
 * `FactionIntel.cs:133-140`) — neither throws, every sector quietly renders as unknown, and the only
 * symptom is a map that looks fogged for no visible reason. `formatMagnitude`'s own
 * `const exhaustive: never` discipline (`magnitude.ts:44`) is the same idea applied to the world's
 * string-typed wire enums, which have no `never`-checkable union to lean on at the type level —
 * so the exhaustiveness here is a **runtime** guarantee instead, proven by a completeness test that
 * walks the real C# enum values, not merely the ones a developer happened to type.
 */
function loudLookup(table: Record<string, string>, value: string, surface: string): string {
  if (Object.prototype.hasOwnProperty.call(table, value)) return table[value]!;
  throw new Error(`worldEnums: unmapped ${surface} value ${JSON.stringify(value)}`);
}

/** `IntelState`, `FactionIntel.cs:133-140` — exact wire casing, exact American spelling. */
const INTEL_WORDS: Record<IntelState, string> = {
  Unknown: "unexplored",
  Rumored: "rumoured",
  Scouted: "scouted",
  Watched: "watched"
};

export function translateIntel(value: string): string {
  return loudLookup(INTEL_WORDS, value, "intel");
}

/** `SectorPhase`, `WorldState.cs:6-15`. */
const PHASE_WORDS: Record<string, string> = {
  Unknown: "unexplored",
  Explored: "explored",
  Contested: "contested",
  Held: "held",
  Developed: "developed",
  Besieged: "besieged",
  Lost: "lost"
};

export function translatePhase(value: string): string {
  return loudLookup(PHASE_WORDS, value, "phase");
}

/** `WorldEntityKind`, `WorldState.cs:51-58`. */
const FORCE_KIND_WORDS: Record<string, string> = {
  Legion: "legion",
  Warband: "warband",
  Guard: "guard",
  Caravan: "caravan",
  Warlord: "warlord"
};

export function translateForceKind(value: string): string {
  return loudLookup(FORCE_KIND_WORDS, value, "force kind");
}

/**
 * `Ownership` (`stages/world/render/sectorChannels.ts`) is a client-derived reading, not a wire
 * enum, but it is a closed union — so this one *is* exhaustive at the type level (TypeScript
 * refuses to compile if a value is missing), which the three wire-string surfaces above cannot be.
 */
const OWNERSHIP_WORDS: Record<Ownership, string> = {
  yours: "yours",
  enemy: "enemy",
  open: "open",
  contested: "contested"
};

export function translateOwnership(value: Ownership): string {
  return OWNERSHIP_WORDS[value];
}
