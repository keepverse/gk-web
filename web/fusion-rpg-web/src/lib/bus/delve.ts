import { useQuery } from "@tanstack/react-query";
import { adaptDelve, adaptDomainOffer } from "@/contract/adapt";
import type { DelveCarryInItem, DelveStartRequestBody } from "@/lib/bus/world";
import { useStartDelveFromWorldDoor } from "@/lib/bus/world";
import { getJson } from "./rest";

/**
 * The delve stage's own bus layer (D5.4). `DelveEndpoints.cs`'s `HandleGetDelve` (D5.2) and
 * `adaptDelve` (D5.3) both already existed; nothing wired a live fetch between them until this task.
 *
 * The wire DTO type is not re-declared here — `Parameters<typeof adaptDelve>[0]` reads it straight
 * off the adapter's own (module-private) parameter type, the same idiom `WorldStage.tsx:102` already
 * uses for `firstLight as Parameters<typeof adaptWorldState>[0]`. `adaptDelve`'s own DTO types stay
 * private to `contract/adapt.ts` (D5.3's own file-organisation choice, unlike `lib/bus/world.ts`'s
 * exported DTOs — `world-stage` W2's own doc comment names *why* wire DTOs normally live in the bus
 * file, but re-exporting six more delve DTO types purely so this one hook could import them would cost
 * more than this type-level lookup does) — zero duplication, zero drift risk either way.
 */
type DelveResponseDto = Parameters<typeof adaptDelve>[0];

const delveKeys = {
  detail: (delveId: number) => ["delve", delveId] as const
};

/**
 * `GET /api/delve/{delveId}` (spec-delve-stage.md §5, §18 ask 1). `playerId` mirrors
 * `HandleGetDelve`'s own optional query parameter — omitted, the server falls back to
 * `GetCurrentPlayerId()`, the same default every other bus hook in this program relies on.
 */
export function useDelve(delveId: number | null | undefined, playerId?: number) {
  return useQuery({
    queryKey: [...delveKeys.detail(delveId ?? -1), playerId ?? null],
    queryFn: async () => {
      const suffix = playerId != null ? `?playerId=${playerId}` : "";
      const dto = await getJson<DelveResponseDto>(`/api/delve/${delveId}${suffix}`);
      return adaptDelve(dto);
    },
    enabled: delveId != null && delveId > 0
  });
}

/**
 * D5.8 (spec-delve-stage.md §7 "Descent picker" row) — the SAME real endpoint
 * `useDelveDomainOffers` (`lib/bus/world.ts`, D1.28) already reads, `GET /api/delve/domains/{playerId}`
 * (`DelveEndpoints.cs:49`), but decoded through the FULL `DomainOfferDto` shape via `contract/adapt.ts`'s
 * own `adaptDomainOffer` rather than the door's own narrow `DelveDomainOfferSummary`
 * (`domainId`/`raidModes`/`rungs[].rungId` only — "built only for the map door's own minimal badge,"
 * `world.ts:383-386`'s own doc comment). The door always takes the first-offered rung/raidMode and never
 * renders a domain's name, flavor, sealed/in-progress state, oath or provisioning; the picker needs all
 * of it, so it reads the wire in full.
 *
 * `Parameters<typeof adaptDomainOffer>[0]` reads the wire DTO type straight off the adapter's own
 * (module-private) parameter — the same idiom `DelveResponseDto` above already uses for `adaptDelve` —
 * zero duplicated DTO declaration, zero drift risk. The query key inserts `"full"` so this never
 * collides with `useDelveDomainOffers`'s own `["delve","domains",playerId]` cache entry even though
 * both hit the identical URL: the cached VALUE shapes differ (a narrow summary vs. the full adapted
 * view), so sharing one key would let either caller's cache silently answer the other's query with the
 * wrong shape.
 */
type DomainOfferDto = Parameters<typeof adaptDomainOffer>[0];

export function useDelveDomainOffersFull(playerId: number) {
  return useQuery({
    queryKey: ["delve", "domains", "full", playerId] as const,
    queryFn: async () => (await getJson<DomainOfferDto[]>(`/api/delve/domains/${playerId}`)).map(adaptDomainOffer),
    enabled: playerId > 0
  });
}

/**
 * The picker's own `POST /api/delve/start` body (D5.8) — a real player CHOICE (domain, rung/tail,
 * oath, raid mode, party), unlike `buildDelveDoorStartBody` (`lib/bus/world.ts`, D1.28), which
 * hardcodes "take the first live-offered rung/raidMode" specifically *because* the door is not the
 * picker (that file's own doc comment: "D5.8 owns choosing among several"). `parentWorldId` is always
 * `null` here — `DelveStart.cs`'s own class doc names it as the one field that legitimately differs
 * between a Sanctum entry (this caller, always `null`) and a map-door entry (the door's own world id)
 * — the picker only ever opens from the Sanctum (spec-delve-stage.md §4: "the descent door is a
 * Sanctum affordance"), never from the map.
 *
 * Typed against the SAME `DelveStartRequestBody`/`DelveCarryInItem` `lib/bus/world.ts` already exports
 * (a read-only type import — nothing in that frozen file is edited to build this) so
 * `The_picker_and_the_map_door_post_the_same_body` (`delve.test.ts`) can assert this function's own
 * output against `buildDelveDoorStartBody`'s for equivalent inputs and get real structural equality,
 * not just a resemblance.
 */
export function buildDelvePickerStartBody(args: {
  domainId: string;
  rungIdOrTailLabel: string;
  oath: boolean;
  raidMode: string;
  memberInstanceIds: string[];
  carryIn?: DelveCarryInItem[];
  playerId: number;
  correlationId: string;
}): DelveStartRequestBody {
  return {
    playerId: args.playerId,
    correlationId: args.correlationId,
    domainId: args.domainId,
    parentWorldId: null,
    rungIdOrTailLabel: args.rungIdOrTailLabel,
    oath: args.oath,
    raidMode: args.raidMode,
    memberInstanceIds: args.memberInstanceIds,
    carryIn: args.carryIn ?? []
  };
}

/**
 * `POST /api/delve/start` (`DelveEndpoints.cs:51`) — the picker's own order. Literally
 * `useStartDelveFromWorldDoor` (`lib/bus/world.ts`, D1.28) re-exported under a name that doesn't imply
 * "map door only": that hook is already generic (`mutationFn: (body) => sendJson(...)`, nothing
 * door-specific inside it), so calling the SAME function — not a second, independently-written
 * `useMutation` wrapping the identical call — is the strongest form of
 * `The_picker_and_the_map_door_post_the_same_body`: both entry points share not just an equal body
 * shape but the literal same mutation. `world.ts` itself is read-only here — an import, never an edit.
 */
export function useStartDelve() {
  return useStartDelveFromWorldDoor();
}
