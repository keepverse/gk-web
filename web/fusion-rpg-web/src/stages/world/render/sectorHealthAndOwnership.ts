import type { SectorView } from "@/contract/types";
import type { HealthState, Ownership } from "./sectorChannels";

/**
 * Derives `sectorChannels.ts`'s own `Ownership`/`HealthState` from a real, adapted `SectorView` —
 * the missing half of the scene-composition wiring (found 2026-09-04: `world-render`'s components
 * were built and unit-tested in isolation, W43-49, but nothing ever fed them real state; this is
 * the piece that closes it, alongside `WorldScene.tsx`).
 *
 * **Two states are never derived here, honestly, not silently guessed:** `contested` needs a
 * cross-reference against forces standing in the sector (a player force and an enemy force both
 * present) that this module does not have without the caller also passing the forces list, so
 * `ownershipOf` never returns it — `open`/`yours`/`enemy` are the three it actually decides.
 * `unmade` has no corresponding `SectorView` field at all (`LoamPhases.cs`'s spawn event is a turn-
 * report fact, `unmade.spawned`, never projected onto sector state) — `healthOf` never returns it
 * either. Both are real, named simplifications, not gaps pretending to be complete.
 */
export function ownershipOf(sector: SectorView, playerFactionId: string | null): Ownership {
  if (sector.ownerFactionId == null) return "open";
  return sector.ownerFactionId === playerFactionId ? "yours" : "enemy";
}

/** The same "is this sector actually holding" floor `worldViewModel.ts`'s old `anchorStateOf` used. */
const ANCHORED_FLOOR_MILLI = 900;

export function healthOf(sector: SectorView, ownership: Ownership): HealthState {
  if (sector.willReleaseNextTurn) return "will-release";
  if (!sector.habitable) return "barren";
  if (ownership === "yours" && sector.wardenBindingId.state === "known" && sector.wardenBindingId.value != null) {
    return "warded";
  }
  if (ownership === "yours" && sector.neglectedTurns.state === "known" && sector.neglectedTurns.value.value > 0) {
    return "neglected";
  }
  if (sector.stability.value < ANCHORED_FLOOR_MILLI) return "fading";
  return "anchored";
}
