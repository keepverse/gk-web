import { newCorrelationId } from "@/lib/bus/creatures";
import { useRespecSpecies, useSpeciesAptitudes, useSpeciesRespecPrice } from "@/lib/bus";

/**
 * spec-allocation-surface.md — hooks over the existing bus, nothing invented: the species query,
 * the respec price preview, and the ONE save mutation (`useRespecSpecies`) that handles a first
 * override, a revert, and a priced change alike. The old unpriced `/api/aptitudes/species/allocate`
 * route this hook was written to avoid was retired server-side (species-build-todo.md T4.3,
 * 2026-09-05) — `useRespecSpecies` is now the only write path for a species aptitude override.
 */
export function useSpeciesBuild(playerId: number, speciesId: string | null) {
  const state = useSpeciesAptitudes(playerId, speciesId);
  const price = useSpeciesRespecPrice(playerId, speciesId);
  const respec = useRespecSpecies();

  /** `payWith` is the PLAYER's choice (EP4.12); omitted until they make one, which is what the server
   * reads as "no choice named" — a soul charge when they hold no free respec, a refusal when they do. */
  function save(shares: Record<string, number>, payWith?: "souls" | "freeRespec") {
    if (!speciesId) return Promise.reject(new Error("no species selected"));
    return respec.mutateAsync({
      playerId,
      speciesId,
      shares,
      correlationId: newCorrelationId(),
      ...(payWith ? { payWith } : {})
    });
  }

  return { state, price, respec, save };
}
