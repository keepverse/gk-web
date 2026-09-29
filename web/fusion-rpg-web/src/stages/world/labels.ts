import type { WorldFactionDto } from "@/lib/bus/world";
import { known, pendingWithReason, type Pending } from "@/contract/pending";

/**
 * The four id kinds that reach the playback rail, and they are not interchangeable
 * (world-stage W74). Sector and lane are humanisable from stable, structural ids — a lane's own id
 * is a lossy truncated composite of both sectors' first words (`l-home-ember` for
 * `homeworld`↔`ember-hollow`, not `l-homeworld-ember-hollow`), so `laneLabel` composes from the two
 * *sector* ids it connects, never by splitting the lane id itself — doing that would print
 * "Home Ember" for a lane whose actual endpoints are "Homeworld" and "Ember Hollow". Faction and
 * legion cannot be guessed from an id at all; each returns `Pending` until a real name backs it,
 * never a `split("-")` fabrication.
 */

/** Turns `ember-hollow` into `Ember Hollow` — the id is the SSOT, this is for people. Moved out of
 * `worldViewModel.ts` (its own 27 tests stay green, unmodified — reused, not reimplemented). */
export function sectorLabel(sectorId: string): string {
  return sectorId
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

/** Composed from the two sectors a lane actually connects — never from the lane's own id, which is
 * a lossy truncation of both (see module comment). */
export function laneLabel(fromSectorId: string, toSectorId: string): string {
  return `${sectorLabel(fromSectorId)} – ${sectorLabel(toSectorId)}`;
}

/**
 * `WorldFactionDto.Name` is already server-projected (`WorldDtos.cs:39`) — this is a lookup, never a
 * guess. `Pending` when the sector is unowned (`factionId` null — genuinely no faction, not a gap)
 * or the id names a faction the viewer's own payload didn't include (a real wiring gap, distinct
 * from "no owner").
 */
export function factionLabel(
  factionId: string | null,
  factions: readonly Pick<WorldFactionDto, "factionId" | "name">[]
): Pending<string> {
  if (factionId == null) return pendingWithReason("no faction holds this");
  const found = factions.find((f) => f.factionId === factionId);
  if (found == null) return pendingWithReason("faction not in this payload");
  return known(found.name);
}

/**
 * `e-dave-legion-1` cannot be turned into a name by splitting it — that is exactly how "Legion I"
 * became "E Dave Legion 1" for real, once, which is why this never derives from the id. The wire
 * *can* carry a real name (`WorldEntityDto.DisplayName`, `WorldDtos.cs:282`, added world-stage W8,
 * computed server-side by `EntityNaming.DisplayName`) — but only for the viewer's own live forces in
 * the current `WorldStateDto.Entities`, never for an enemy's (the viewer only ever sees those at
 * `WorldForceDto` band detail, which carries no name) and never for a report line about an entity
 * that has since been destroyed (the turn report's own `Subject` field, `WorldDtos.cs:489`, is a bare
 * id with nothing else attached). So this labeller takes whatever display name the caller can
 * actually supply and is honest when it can't: `known` when given one, `Pending` with the specific
 * reason otherwise — never a guess either way.
 */
export function legionLabel(entityId: string, displayName: string | null): Pending<string> {
  if (displayName != null && displayName.length > 0) return known(displayName);
  return pendingWithReason(`no name on record for ${entityId} yet`);
}
