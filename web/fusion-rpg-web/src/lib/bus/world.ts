import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson, tryGetJson } from "./rest";

/**
 * The world map's bus layer (spec-world-model.md §Server). Everything the map page does goes through
 * here — no page fetches directly, so caching, invalidation, and the SIM base URL all live in one
 * place.
 *
 * **world-stage W2 (2026-09-04):** the wire DTOs used to live in `features/world/worldTypes.ts` and
 * this file imported them from there — so `contractGuard` (matching only `from "@/lib/bus`) would
 * pass a `stages/world/` component binding straight to a REST DTO. They live here now, where every
 * other domain's DTOs already do; `features/world/worldTypes.ts` re-exported them so the legacy page
 * and its tests kept compiling unchanged until Phase 4 retired that tree — done 2026-09-05, the
 * whole `features/world/` directory is gone, and every former consumer imports straight from here.
 * This was a move, not an edit — no field was renamed or narrowed.
 */

export type WorldFactionDto = {
  factionId: string;
  kind: string;
  name: string;
};

export type WorldSlotDto = {
  slotIndex: number;
  slotTypeId: string;
  element: string | null;
  state: string;
  ownerFactionId: string | null;
  guardWaveId: string | null;
  guardState: string;
  /**
   * Found missing 2026-09-04 (world-stage W4) — this is the drift the whole program keeps citing
   * as its example: on the C# DTO since L32 (`WorldDtos.cs:39`, no owner-gating, "as visible as the
   * slot itself"), present in the byte-pinned fixture, and never added here. Verified against both
   * before fixing.
   */
  structureId: string | null;
  /**
   * Found missing 2026-09-04 (world-stage W62) — the same drift class as `structureId` above: on
   * the C# DTO (`WorldDtos.cs:72`), genuinely assigned server-side (`WorldEndpoints.cs:482`, not a
   * stub like `pressureMilli`), present in the byte-pinned fixture (`null` in every current save,
   * since nothing is under construction in either golden world) — and never added to this mirror.
   * `adaptWorldSlot` had compensated by marking it permanently `Pending`, which was the wrong fix
   * for a field that was never actually missing from the wire.
   */
  constructionTurnsRemaining: number | null;
  /**
   * wonder-wire §Design 2 (plan Task 4A.4) — the Wonder facet without a second fetch per slot:
   * the scope/rarity of the slot's own catalog row, `null` for empty slots, unknown ids and
   * non-Wonder rows (null-together). Fog-parity with `structureId` — as visible as the slot
   * itself, no owner-gating. Exact C# member spelling from the catalog row (`"Sector"`/...).
   */
  wonderScope: string | null;
  wonderRarity: string | null;
};

/**
 * A force as the viewer believes it to be. `exact` only when they stood on the ground with it — a
 * glimpse from next door reports a band, never a count.
 */
export type WorldForceDto = {
  entityId: string;
  ownerFactionId: string;
  kind: string;
  exact: boolean;
  strength: number;
  bandName: string;
  bandCeiling: number;
};

/** `LoamUpkeepBreakdownDto` (`WorldDtos.cs:102-110`) — the five operands `LoamUpkeep.For` sums, in
 * the exact order its own signature declares them. */
export type WorldLoamUpkeepBreakdownDto = {
  base: number;
  garrison: number;
  development: number;
  danger: number;
  intensityMilli: number;
  handicapMilli: number;
  /**
   * wonder-wire §Design 3 (plan Task 4A.4) — the fifth additive operand, straight off the
   * ALREADY-COMPUTED server breakdown, never a second formula. The fifth ledger ROW stays
   * wonder-display's module; the operand + its reconciliation land here.
   */
  wonderUpkeep: number;
};

/**
 * `WorldCalendarDto` (`WorldDtos.cs:24-33`) — `TurnCalendar.Roll(world.CurrentTurn, seed)`, computed
 * server-side on every poll; the seed itself never reaches the wire. Found missing 2026-09-04
 * (world-stage W53): projected onto `WorldStateDto.Calendar` since `world-wire` W15, never added to
 * this hand-written mirror — the same class of drift every prior wave in this file has already found
 * once (`structureId`, `fractureIntensityMilli`, `upkeepBreakdown`).
 */
export type WorldCalendarDto = {
  daysPerWeek: number;
  weeksPerMonth: number;
  weekBoundary: boolean;
  monthBoundary: boolean;
  specialWeek: boolean;
  specialMonth: boolean;
  plague: boolean;
  /**
   * Meaningful on every turn, never fogged (`TurnCalendar.SeasonOf`'s own doc comment) — unlike
   * the boundary flags above, this is not blank between week boundaries. Added 2026-09-05, wiring
   * the HUD's calendar slot to sector-development's real season now that one exists (superseding
   * §8b.7's "calendar, not a season" premise, made when no season concept did).
   */
  season: number;
};

export type WorldSectorDto = {
  sectorId: string;
  typeId: string;
  climate: string | null;
  dangerBand: number;
  phase: string;
  ownerFactionId: string | null;
  stabilityMilli: number;
  pressureMilli: number;
  depletionMilli: number;
  /**
   * Found missing 2026-09-04 (world-stage W4): projected server-side since
   * `WorldEndpoints.cs:298` and present in the byte-pinned fixture (default 1000 = neutral), but
   * never added to this hand-written mirror — the same class of drift that lost `structureId` for
   * two waves. A renderer reading `sector.fractureIntensityMilli` got `undefined` until this line.
   */
  fractureIntensityMilli: number;
  developmentLevel: number;
  intel: string;
  lastSeenTurn: number;
  /** Turns since this was last seen. Zero while it is in sight. */
  intelAge: number;
  layoutX: number;
  layoutY: number;
  slots: WorldSlotDto[];
  forces: WorldForceDto[];
  /** What losing this would cost your own empire; zero for anything you do not hold. */
  lifelineCost: number;
  /** True when losing it would cut your territory in two. */
  lifeline: boolean;
  /**
   * wonder-wire §Design 3 (plan Task 4A.4) — live raised Unique Wonders of Sector scope in THIS
   * sector, built + under-construction. Owner-only, structurally zero for unowned/unseen ground.
   * `Common` is deliberately absent (never scanned — reads 0).
   */
  wonderLiveCountSector: number;
  /** Same producer with Empire scope across the viewer's holdings — identical on every sector of
   * one faction, 0 for unowned/unseen. */
  wonderLiveCountEmpire: number;
  /**
   * This sector's Wonder-attributable production (GG-49 — no mystery delta):
   * stored-modifier output minus the identity call, 0 for a Wonder-free faction. Owner-only
   * like `loamProduction`.
   */
  wonderProductionContribution: number;
  /** Whether this ground can be kept at all — terrain, visible once scouted, not only to the owner. */
  habitable: boolean;
  /** What this sector earns this turn. Owner-only; zero for anything you do not hold. */
  loamProduction: number;
  /** What this sector costs this turn. Owner-only. */
  loamUpkeep: number;
  /**
   * Found missing 2026-09-04 (world-numbers W41): projected server-side since
   * `WorldEndpoints.cs:490-497` (world-stage W10) and read by `ComputeLoamReading`'s own
   * `LoamUpkeepBreakdownBySector`, but never added to this hand-written mirror — the same class of
   * drift `fractureIntensityMilli` was found missing to above. Owner-only; every field defaults to
   * zero (`HandicapMilli` to 1000) for a sector you do not hold.
   */
  upkeepBreakdown: WorldLoamUpkeepBreakdownDto;
  /** The number an abandonment decision is actually about. Owner-only. */
  loamNet: number;
  /** The connected block of your territory this sector pools with. Owner-only; null otherwise. */
  componentId: string | null;
  componentProduction: number;
  componentUpkeep: number;
  componentNet: number;
  /** Raw stock. Owner-only; zero for anything you do not hold. */
  loamStock: number;
  /**
   * Found missing 2026-09-04 (world-hud W52's own stated premise — "never projected" — was stale):
   * `LoamPhases.EffectiveCapacity(sector)` is genuinely computed and assigned server-side
   * (`WorldEndpoints.cs:456-458`), owner-gated the same way as `wardenBindingId` below, never
   * mirrored here. `adaptWorldSector` had compensated by marking the stock denominator permanently
   * `Pending`, hiding a real, wired value.
   */
  loamCapacity: number;
  /** The pooled stock of this sector's whole component. Owner-only. */
  componentStock: number;
  /** True when, if nothing changes, the engine releases this ground outright next turn. Owner-only. */
  willReleaseNextTurn: boolean;
  /**
   * Found missing 2026-09-04 (world-stage W63) — the same drift class as `structureId`/
   * `constructionTurnsRemaining`: real on the C# DTO (`WorldDtos.cs:190`), genuinely assigned and
   * already owner-gated server-side (`WorldEndpoints.cs:451-452`, `null` unless this faction owns
   * the sector), never added to this mirror. `adaptWorldSector` had compensated by marking it
   * permanently `Pending`, hiding a real, wired value.
   */
  wardenBindingId: string | null;
  /**
   * Found missing 2026-09-04 (world-stage W63), identical drift: real (`WorldDtos.cs:197`),
   * owner-gated the same way as `wardenBindingId` (`WorldEndpoints.cs:454-455`), never mirrored.
   */
  neglectedTurns: number;
};

export type WorldLaneDto = {
  laneId: string;
  fromSectorId: string;
  toSectorId: string;
  typeId: string;
  length: number;
  width: number;
  hazardMilli: number;
  wardLevel: number;
  state: string;
};

export type WorldEntityMemberDto = {
  instanceId: string | null;
  speciesId: string;
  level: number;
  hp: number;
  wounds: number;
};

export type WorldEntityDto = {
  entityId: string;
  kind: string;
  ownerFactionId: string;
  atSectorId: string | null;
  onLaneId: string | null;
  onLaneTowardSectorId: string | null;
  laneProgressMilli: number;
  stance: string;
  movementRemaining: number;
  routed: boolean;
  members: WorldEntityMemberDto[];
  /**
   * Found missing (world-stage, same drift class as `calendar`/`structureId`/`fractureIntensityMilli`
   * above): projected since `WorldDtos.cs:301` (world-stage W8, `EntityNaming.DisplayName`), never
   * added to this hand-written mirror. Never null on the wire (defaults to `""` for a legion the
   * viewer cannot name — a genuinely absent name, not a gap) — `stages/world/labels.ts`'s own
   * `legionLabel` already treats an empty string as "no name on record" for exactly this reason.
   */
  displayName: string;
};

export type WorldStateDto = {
  worldId: string;
  templateId: string;
  currentTurn: number;
  factions: WorldFactionDto[];
  sectors: WorldSectorDto[];
  lanes: WorldLaneDto[];
  entities: WorldEntityDto[];
  calendar: WorldCalendarDto;
  /**
   * Found missing 2026-09-04 (alongside `calendar`, same drift class): projected since `world-wire`
   * W16 (`WorldDtos.cs:338`), never added to this hand-written mirror. Every sector a dowser has
   * confirmed holds a loam source this turn — deliberately separate from a sector's own `intel`.
   */
  prospectedSectorIds: string[];
};

/** One line of a turn report, as the map plays it back. */
export type WorldTurnEntryDto = {
  /** Where it happened, when it happened anywhere. Absent means "nowhere in particular". */
  sectorId?: string | null;

  phase: string;
  kind: string;
  subject: string;
  detail: string;
};

export type WorldTurnCommandDto = {
  commanderId: string;
  commandId: string;
  kind: string;
  entityId?: string | null;
  sectorId?: string | null;
  /** Null for anything a person filed — the player never explains themselves. */
  reason?: string | null;
};

export type WorldTurnReportDto = {
  turn: number;
  stateHash: string;
  phases: string[];
  entries: WorldTurnEntryDto[];
  /** Survives a trim that empties `entries`: commands are the save and are never trimmed. */
  commands?: WorldTurnCommandDto[];
};

export type WorldHeaderDto = {
  worldId: string;
  templateId: string;
  currentTurn: number;
  state: string;
  createdUtc: string;
  revision: number;
};

export type WorldCommandRequest = {
  commandId: string;
  kind: string;
  entityId?: string | null;
  sectorId?: string | null;
  slotIndex?: number | null;
  lanePath?: string[];
  /**
   * Found missing 2026-09-04 (world-stage W66) — real on the C# DTO since world-commands' own W22
   * (`WorldDtos.cs:420`, `WorldCommandRequest.Stance`), never mirrored here. The posture a `stance`
   * order asks for: march, scout, hold, or (since `world-commands` W30) dowse.
   */
  stance?: string | null;
  /** Found missing alongside `stance` (`WorldDtos.cs:426`) — a `sustain` order's whole-loam spend,
   * `long` end to end per W22, never `int`. */
  amount?: number | null;
  /** Found missing alongside `stance` (`WorldDtos.cs:429`) — a `build` order's structure choice. */
  structureId?: string | null;
  /**
   * wonder-rest §Design 3 — a Wonder `build` order's picked relic list (`rpg_item.instance_id`
   * strings, order-preserved). `null`/absent = "spends no relic", matching the C# DTO. No
   * validation here — admission owns `relic.count-mismatch` / `relic.duplicate`.
   */
  relicInstanceIds?: string[] | null;
  /**
   * empire-inventory-surfaces `cargo-commands` §Design 2 (plan Task 4D.2a) — the cargo-row
   * selector for `deposit-cargo` / `withdraw-cargo` (`WorldDtos.cs:554-555`, `WorldCommand.Seq`).
   * `int` end to end, structural (a row index, never a magnitude). Appended after
   * `relicInstanceIds`, never reordering it (merge-additive with the wonder-rest hunk above).
   * Deliberately the ONLY cargo field mirrored here: deposit/withdraw need `EntityId` +
   * `SectorId` (already above) + `Seq` — and `weightEach` is never on the wire (mass resolves
   * server-side at commit through 4A.1's weight resolver, or a client could mint capacity).
   */
  seq?: number | null;
  /**
   * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1) — the remaining
   * `cargo-commands` §Design 2 fields, field-for-field with `WorldDtos.cs:557-573`
   * (`WorldCommand.TargetEntityId/CacheId/CargoKind/InstanceId/ContainerId/Qty`).
   * Appended after 4D.2a's `seq` hunk above (left untouched) — merge-additive.
   * `qty` is `long` end to end in C#; narrowed to `number` here (documented
   * transport narrowing, never a logic cast). Deliberately absent: `weightEach`
   * is never on the wire (mass resolves server-side at commit).
   */
  targetEntityId?: string | null;
  cacheId?: string | null;
  cargoKind?: string | null;
  instanceId?: string | null;
  containerId?: string | null;
  qty?: number | null;
};

export type WorldCommandResultDto = {
  commandId: string;
  ok: boolean;
  reason: string;
  replayed: boolean;
};

/**
 * Rules, not state — no world id, no viewer, no fog (world-stage W17). Found missing entirely from
 * this mirror 2026-09-04 (world-stage W69): `GET /api/world/catalog` has existed since W17, but
 * nothing on the TS side ever read it.
 */
export type WorldStructureDto = {
  structureId: string;
  name: string;
  kind: string;
  requiredSlotKind: string;
  /** Whole loam units, despite `StructureDef.CostMilli`'s own name server-side — named `cost` here
   * on purpose, matching the DTO's own `Cost` field. */
  cost: number;
  yieldMultiplierMilli: number;
  buildTurns: number;
  capacityBonus: number;
  /**
   * wonder-wire §Design 1 (plan Task 4A.4) — Wonder identity on the rules wire: exact C# member
   * spelling (`"Sector"`/`"Empire"`), `null` for non-Wonder rows (null-together). Rules, not
   * state — no fog gate. Reserved scopes never appear (`Validate` refuses them at startup).
   */
  wonderScope: string | null;
  wonderRarity: string | null;
  /**
   * How many distinct relic instances this row costs — 0 for every non-Wonder row. `long` end
   * to end in C#; narrowed to `number` here (documented transport narrowing, never a logic cast).
   */
  relicCost: number;
  /**
   * `WonderPolicy.ExistenceCapFor` over `gk-core/data/tuning/loam-relics-wonders.v1.json` — changing
   * that file moves this number with no code change. `Number.MAX_SAFE_INTEGER` territory
   * (`long.MaxValue`) for `Common` and every non-Wonder row: uncapped by construction.
   */
  existenceCap: number;
};

export type WorldSlotTypeDto = {
  slotTypeId: string;
  name: string;
  kind: string;
  buildable: boolean;
  yields: boolean;
};

export type WorldStrengthBandDto = {
  index: number;
  name: string;
  floor: number;
  ceiling: number;
  midpoint: number;
};

export type WorldLaneTypeDto = {
  laneTypeId: string;
  name: string;
  costMultiplierMilli: number;
  carriesSupply: boolean;
  carriesPressure: boolean;
  oneWay: boolean;
  gated: boolean;
  ley: boolean;
};

export type WorldCatalogDto = {
  structures: WorldStructureDto[];
  slotTypes: WorldSlotTypeDto[];
  strengthBands: WorldStrengthBandDto[];
  laneTypes: WorldLaneTypeDto[];
  /** `LoamPolicy.WaystationRangeHops` (world-stage W69) — read from the tuning row, never a
   * literal on this side of the wire either. */
  waystationRangeHops: number;
};

export type WorldSubmitResultDto = {
  turn: number;
  commanderId: string;
  results: WorldCommandResultDto[];
};

export type WorldTurnCommitDto = {
  ok: boolean;
  reason: string;
  advanced: boolean;
  stateHash: string | null;
  currentTurn: number;
};

/**
 * party-dungeon D1.28 (the world-map door) — the two delve endpoints the door needs, added here
 * rather than a new `lib/bus/delve.ts`, per this task's own Files line
 * (`tasks/party-dungeon-todo.md` D1.28: "`src/lib/bus/world.ts` (the order)"). Deliberately narrow:
 * this is NOT the delve-stage contract (`D5.3`, Phase 5, unbuilt — "the sixteen view types and their
 * adapters") — only the fields the door itself reads (`domainId` to post, `rungs[0]`/`raidModes[0]`
 * as the door's own "no picker UI on the map, so use the first offered" simplification, named
 * explicitly rather than silently) and the one shape it posts back.
 */

/** Narrow slice of `DomainOfferDto` (`Delve/Domains/DomainOfferDto.cs:24-29`) — only what the door
 * reads. `DomainOffers.For` never puts a `theme` field on this DTO at all (confirmed by reading its
 * own construction, `DomainOffers.cs:95-103`) — there is nothing to add here even for a future
 * caller that wanted one; `delveDoorCapability.ts`'s own doc comment covers this in full. */
export type DelveDomainOfferSummary = {
  domainId: string;
  raidModes: string[];
  rungs: { rungId: string }[];
};

/** `GET /api/delve/domains/{playerId}` (`DelveEndpoints.cs:48`) — always returns `[]` in production
 * today (`dungeon_domain` has no write arm yet, D4.16) but is the real, shipped, only legitimate
 * source of a postable `domainId` anywhere in the system; never a static slot-kind table (see
 * `delveDoorCapability.ts`'s own doc comment for why one is not built here instead). */
export function useDelveDomainOffers(playerId: number) {
  return useQuery({
    queryKey: ["delve", "domains", playerId] as const,
    queryFn: () => getJson<DelveDomainOfferSummary[]>(`/api/delve/domains/${playerId}`),
    enabled: playerId > 0
  });
}

/** `DelveStartHttpRequest.CarryInItem` (`DelveEndpoints.cs:158-167`) — always `[]` from the map door
 * (R10: "no legion leaves the map," and the door has no pack UI), but typed in full so the shape
 * matches the wire exactly rather than being narrowed to "always empty" by this file's own choice. */
export type DelveCarryInItem = {
  kind: string;
  refId: string;
  instanceId?: string | null;
  qty: number;
  w: number;
  h: number;
  grantIndex: number;
};

/** `DelveStartHttpRequest` (`FusionRpg.Server/DelveEndpoints.cs:146-168`) verbatim, camelCased —
 * ASP.NET Core's default `System.Text.Json` binding (no `JsonNamingPolicy` override anywhere in
 * `FusionRpg.Server`, confirmed) is camelCase, matching every other DTO already mirrored in this
 * file. `DelveStart.cs`'s own class doc (`Delve/Domains/DelveStart.cs:7-10`) names `parentWorldId`
 * as the ONE field that legitimately differs between a Sanctum entry (null) and a map-door entry
 * (this world's own id) — "the SAME body" the door and D5.8's own future picker both send is a claim
 * about shape, not about every value being equal. */
export type DelveStartRequestBody = {
  playerId?: number;
  correlationId: string;
  domainId: string;
  parentWorldId?: string | null;
  rungIdOrTailLabel: string;
  oath: boolean;
  raidMode: string;
  memberInstanceIds: string[];
  carryIn: DelveCarryInItem[];
};

/** `Results.Ok(new { delveId, worldId })` (`DelveEndpoints.cs:91`) — `worldId` here is the NEW
 * delve-scoped world the start plan creates (`world-stage-map.md`'s own "a delve world row exists
 * beside a map world"), never the map's own `worldId` the door read `parentWorldId` from; the door
 * only navigates on `delveId` (`delveRoute`, `stages/delve/route.ts`), never this field. */
export type DelveStartResultDto = { delveId: string; worldId: string };

/**
 * The door's own `POST /api/delve/start` body (party-dungeon D1.28) — a pure function, kept in this
 * bus file (not `stages/world/inspector/delveDoorCapability.ts`, its first draft location) because
 * `contractGuard.test.ts` forbids `stages/`/`layers/`/`ui/` from type-importing a wire shape directly
 * (`contractGuard.ts:57,80` — no exception on this new path); a `stages/` caller gets this as a plain
 * function import instead, the same way it already gets `useDelveDomainOffers` below. Unit-testable
 * directly against `DelveStartHttpRequest` (`FusionRpg.Server/DelveEndpoints.cs:146-168`) with no
 * `fetch`/react-query mocking needed. `parentWorldId` is the map door's own field (`DelveStart.cs:7-10`
 * — null for a Sanctum entry, this world's id for a map-door entry); `memberInstanceIds`/`carryIn` are
 * always empty — the map has no roster/pack picker (R10: "no legion leaves the map") — and
 * `rungIdOrTailLabel`/`raidMode` take the first live-offered value, since the door is not the picker
 * (D5.8 owns choosing among several).
 */
export function buildDelveDoorStartBody(args: {
  offer: DelveDomainOfferSummary;
  worldId: string;
  playerId: number;
  correlationId: string;
}): DelveStartRequestBody {
  return {
    playerId: args.playerId,
    correlationId: args.correlationId,
    domainId: args.offer.domainId,
    parentWorldId: args.worldId,
    rungIdOrTailLabel: args.offer.rungs[0]?.rungId ?? "",
    oath: false,
    raidMode: args.offer.raidModes[0] ?? "",
    memberInstanceIds: [],
    carryIn: []
  };
}

/** POST /api/delve/start (`DelveEndpoints.cs:50`) — the map door's own order (party-dungeon D1.28).
 * No cache to invalidate here: opening a delve changes nothing this file's own queries read (R10 —
 * the map's own state is untouched by the request). */
export function useStartDelveFromWorldDoor() {
  return useMutation({
    mutationFn: (body: DelveStartRequestBody) =>
      sendJson<DelveStartResultDto>("/api/delve/start", "POST", body)
  });
}

export const worldKeys = {
  header: (playerId: number) => ["world", "header", playerId] as const,
  state: (worldId: string) => ["world", "state", worldId] as const,
  turn: (worldId: string, turn: number) => ["world", "turn", worldId, turn] as const,
  catalog: () => ["world", "catalog"] as const,
  reachableRelics: (worldId: string, entityId: string, sectorId: string) =>
    ["world", "reachableRelics", worldId, entityId, sectorId] as const
};

/** Rules, not state — no world id needed, so this never gates on one being selected. */
export function useWorldCatalog() {
  return useQuery({
    queryKey: worldKeys.catalog(),
    queryFn: () => getJson<WorldCatalogDto>("/api/world/catalog")
  });
}

/** The player's active world, or null when they have not started one. */
export function useWorldHeader(playerId: number) {
  return useQuery({
    queryKey: worldKeys.header(playerId),
    queryFn: () => tryGetJson<WorldHeaderDto>(`/api/world/${playerId}`),
    enabled: playerId > 0
  });
}

/**
 * The map as one faction knows it. Omitting `asFaction` asks as the player, which is what the map
 * view wants — passing someone else's id is for debugging fog, not for playing.
 */
export function useWorldState(
  worldId: string | null | undefined,
  options?: { asFaction?: string; lifelines?: boolean }
) {
  const asFaction = options?.asFaction;
  const lifelines = options?.lifelines ?? false;

  return useQuery({
    queryKey: [...worldKeys.state(worldId ?? ""), asFaction ?? "player", lifelines],
    queryFn: () => {
      // Reconnection cost is an expensive sweep on the server, so it is only asked for while the
      // overlay is actually showing.
      const query = new URLSearchParams();
      if (asFaction) query.set("asFaction", asFaction);
      if (lifelines) query.set("lifelines", "true");
      const suffix = query.toString();

      return getJson<WorldStateDto>(`/api/world/${worldId}/state` + (suffix ? `?${suffix}` : ""));
    },
    enabled: !!worldId
  });
}

/**
 * One turn's report. Turns outside the store's hot tail are re-derived by replay, and the server
 * refuses rather than fabricating across an engine version change — so an old turn can legitimately
 * come back with no entries.
 */
export function useWorldTurnReport(worldId: string | null | undefined, turn: number | null) {
  return useQuery({
    queryKey: worldKeys.turn(worldId ?? "", turn ?? -1),
    queryFn: () => tryGetJson<WorldTurnReportDto>(`/api/world/${worldId}/turn/${turn}`),
    enabled: !!worldId && turn != null && turn >= 0
  });
}

export function useSubmitWorldCommands(worldId: string | null | undefined) {
  return useMutation({
    mutationFn: (vars: { commanderId?: string; commands: WorldCommandRequest[] }) =>
      sendJson<WorldSubmitResultDto>(`/api/world/${worldId}/commands`, "POST", vars)
  });
}

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault
 * action-row's two filing shapes. Pure functions over the closed 4A.1 kinds
 * (`WorldCommandKinds.DepositCargo` / `WithdrawCargo`, `WorldCommand.cs:105-111`), kept in
 * this bus file (not `stages/world/inspector/`, its first-draft location) because
 * `contractGuard.ts` forbids `stages/` from type-importing a wire shape directly — a
 * `stages/` caller gets these as plain function imports, the same way it already gets
 * `buildDelveDoorStartBody` above. Filed through the EXISTING `POST /api/world/{worldId}/
 * commands` filer (`useSubmitWorldCommands`) — no new route; the outcome answers via the
 * turn report (`cargo.deposited:<newSeq>` / `cargo.withdrawn:<newSeq>` or the verb refusal
 * verbatim) plus the `GET storage` read-back, never the file response (GG-15).
 * Deliberately absent: any weight member — mass resolves server-side at commit.
 */
export function buildDepositCargoCommand(args: {
  commandId: string;
  entityId: string;
  sectorId: string;
  seq: number;
}): WorldCommandRequest {
  return {
    commandId: args.commandId,
    kind: "deposit-cargo",
    entityId: args.entityId,
    sectorId: args.sectorId,
    seq: args.seq
  };
}

/** Sector vault → legion — the mirror of `buildDepositCargoCommand` (same §Design 2 shape). */
export function buildWithdrawCargoCommand(args: {
  commandId: string;
  entityId: string;
  sectorId: string;
  seq: number;
}): WorldCommandRequest {
  return {
    commandId: args.commandId,
    kind: "withdraw-cargo",
    entityId: args.entityId,
    sectorId: args.sectorId,
    seq: args.seq
  };
}

/**
 * wonder-wire §Design 4 (plan Task 4A.4) — reachable-first picking's planning-time source:
 * which relic instances are reachable HERE for one (entity, sector) pair. The commit gate's own
 * predicate as a list, minus the batch-only `claimed` set — so a composer offering only these
 * ids can never file `relic.count-mismatch`. Sorted ordinal, de-duplicated; `[]` when nothing
 * is reachable (inert, not broken). No POST, no command kind, no turn effect — and no cache to
 * invalidate on submit: reachability re-reads live cargo/storage on every fetch.
 */
export type WorldRelicReachabilityDto = {
  worldId: string;
  entityId: string;
  sectorId: string;
  reachableInstanceIds: string[];
};

export function useReachableRelics(
  worldId: string | null | undefined,
  entityId: string | null | undefined,
  sectorId: string | null | undefined,
  options?: { asFaction?: string }
) {
  const asFaction = options?.asFaction;
  return useQuery({
    queryKey: [
      ...worldKeys.reachableRelics(worldId ?? "", entityId ?? "", sectorId ?? ""),
      asFaction ?? "player"
    ],
    queryFn: () => {
      const query = new URLSearchParams();
      query.set("entityId", entityId ?? "");
      query.set("sectorId", sectorId ?? "");
      if (asFaction) query.set("asFaction", asFaction);
      return getJson<WorldRelicReachabilityDto>(
        `/api/world/${worldId}/relic-reachability?${query.toString()}`);
    },
    enabled: !!worldId && !!entityId && !!sectorId
  });
}

/**
 * End this commander's turn. The world steps when the *last* commander commits, so `advanced` is
 * true at most once a turn — and only then is there anything new to read.
 */
export function useCommitWorldTurn(worldId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // `turn` is required by the server: a commit names the turn it means to end, so a resend the
    // client never saw the answer to is refused rather than resolving the *next* turn.
    mutationFn: (vars: { turn: number; commanderId?: string }) =>
      sendJson<WorldTurnCommitDto>(`/api/world/${worldId}/commit`, "POST", vars),
    onSuccess: (result) => {
      if (!result.advanced) return;
      void qc.invalidateQueries({ queryKey: ["world"] });
    }
  });
}

// ===========================================================================
// empire-inventory-surfaces `claim-endpoints` (plan Task 4A.3) — cache discovery + claim
// filing + one-scope cargo/storage read-backs (`WorldDtos.cs`'s `CargoRowDto`/`LegionCargoDto`/
// `SectorStorageRowDto`/`SectorStorageDto`/`ClaimableCacheDto`/`ClaimableCacheListDto`/
// `FileClaimCacheRequest`, field-for-field, camelCased per this file's own convention).
//
// Wire mirrors only: every number here is the server's, carried straight through —
// `src/contract/adapt.ts` owns the folds (`adaptLegionCargo`/`adaptSectorStorage`/
// `adaptClaimableCaches`), which compute meter fractions and map reason strings to copy keys
// and never recompute capacity, compare positions, or prettify an id (ideal §2.7).
//
// Deliberately absent: `weightEach` on any request — mass resolves server-side at commit
// through 4A.1's `TryResolveCargoWeight`, so a client that could name its own weight could mint
// capacity. The filer sends `{ commandId, cacheId }` only; `correlationId := CommandId`, so no
// second key travels either. No bulk/list-all shape exists (ideal §6 Diablo precedent).
// ===========================================================================

/** `CargoRowDto` — one cargo row aboard a legion, plus its stored row weight. */
export type CargoRowDto = {
  seq: number;
  kind: string;
  instanceId: string | null;
  containerId: string | null;
  qty: number | null;
  weightEach: number;
  rowWeight: number;
};

/** `LegionCargoDto` — one legion's contents plus live used-vs-capacity. */
export type LegionCargoDto = {
  worldId: string;
  entityId: string;
  asOfTurn: number;
  rows: CargoRowDto[];
  weightUsed: number;
  weightCapacity: number;
  slotsUsed: number;
  slotCapacity: number;
};

/** `SectorStorageRowDto` — one vault row; no weight fields by design (storage is slot-gated). */
export type SectorStorageRowDto = {
  seq: number;
  kind: string;
  instanceId: string | null;
  containerId: string | null;
  qty: number | null;
};

/** `SectorStorageDto` — one sector's vault contents plus room; `ownerFactionId` is the live
 * read and the capture-header input (claim-endpoints §Design 5). */
export type SectorStorageDto = {
  worldId: string;
  sectorId: string;
  ownerFactionId: string | null;
  asOfTurn: number;
  rows: SectorStorageRowDto[];
  slotsUsed: number;
  slotCapacity: number;
};

/** `ClaimableCacheDto` — one reachable fallen cache, count-only, never contents
 * (hidden-until-found: the pin shows presence, the claim flow shows contents after the
 * reachability re-check at claim time). */
export type ClaimableCacheDto = {
  cacheId: string;
  placeKind: string;
  placeRef: string;
  sourceKind: string;
  itemCount: number;
  createdUtc: string;
};

/** `ClaimableCacheListDto` — the presence-gated listing itself. The response IS the fog rule:
 * a cache appears iff the legion stands where it lies; empty is zero entries, never 404. */
export type ClaimableCacheListDto = {
  worldId: string;
  entityId: string;
  asOfTurn: number;
  caches: ClaimableCacheDto[];
  /** Live per-act claim price from tuning — the pick-up copy binds this, never a literal. */
  claimCostMilli: number;
};

/** `FileClaimCacheRequest` — the claims filer body. `commanderId` omitted means the player
 * faction (the server's own `/commands` discipline); the two ids are the whole shape. */
export type FileClaimCacheBody = {
  commanderId?: string;
  commandId?: string | null;
  cacheId?: string | null;
};

export const claimKeys = {
  claimableCaches: (worldId: string, entityId: string) =>
    ["world", "claimableCaches", worldId, entityId] as const,
  legionCargo: (worldId: string, entityId: string) =>
    ["world", "legionCargo", worldId, entityId] as const,
  sectorStorage: (worldId: string, sectorId: string) =>
    ["world", "sectorStorage", worldId, sectorId] as const
};

/** Presence-gated listing for the cache-claim flow — one legion, re-read per selection (pins
 * never subscribe; `asOfTurn` is a staleness marker, not a cache). */
export function useClaimableCaches(
  worldId: string | null | undefined,
  entityId: string | null | undefined,
  options?: { asFaction?: string }
) {
  const asFaction = options?.asFaction;
  return useQuery({
    queryKey: [...claimKeys.claimableCaches(worldId ?? "", entityId ?? ""), asFaction ?? "player"],
    queryFn: () => {
      const query = new URLSearchParams();
      if (asFaction) query.set("asFaction", asFaction);
      const suffix = query.toString();
      return getJson<ClaimableCacheListDto>(
        `/api/world/${worldId}/legions/${entityId}/claimable-caches` + (suffix ? `?${suffix}` : "")
      );
    },
    enabled: !!worldId && !!entityId
  });
}

/** One legion's contents + capacities for the `legion-sheet` cargo tab. */
export function useLegionCargo(
  worldId: string | null | undefined,
  entityId: string | null | undefined,
  options?: { asFaction?: string }
) {
  const asFaction = options?.asFaction;
  return useQuery({
    queryKey: [...claimKeys.legionCargo(worldId ?? "", entityId ?? ""), asFaction ?? "player"],
    queryFn: () => {
      const query = new URLSearchParams();
      if (asFaction) query.set("asFaction", asFaction);
      const suffix = query.toString();
      return getJson<LegionCargoDto>(
        `/api/world/${worldId}/legions/${entityId}/cargo` + (suffix ? `?${suffix}` : "")
      );
    },
    enabled: !!worldId && !!entityId
  });
}

/** One sector's vault contents + room for the storage panel block. */
export function useSectorStorage(
  worldId: string | null | undefined,
  sectorId: string | null | undefined,
  options?: { asFaction?: string }
) {
  const asFaction = options?.asFaction;
  return useQuery({
    queryKey: [...claimKeys.sectorStorage(worldId ?? "", sectorId ?? ""), asFaction ?? "player"],
    queryFn: () => {
      const query = new URLSearchParams();
      if (asFaction) query.set("asFaction", asFaction);
      const suffix = query.toString();
      return getJson<SectorStorageDto>(
        `/api/world/${worldId}/sectors/${sectorId}/storage` + (suffix ? `?${suffix}` : "")
      );
    },
    enabled: !!worldId && !!sectorId
  });
}

/**
 * File a `claim-cache` order for the turn — a filer, not a mutator. The response answers only
 * "filed / replayed / refused-at-submit" (`WorldCommandResultDto`); the outcome arrives through
 * the turn report (`cache.claimed:<c>+<s>`) plus the read-backs above — never this response
 * (a client that treats `ok: true` here as "claimed" confuses filing with resolving, GG-15).
 */
export function useFileClaimCache(worldId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { entityId: string; body: FileClaimCacheBody }) =>
      sendJson<WorldCommandResultDto>(
        `/api/world/${worldId}/legions/${vars.entityId}/claims`,
        "POST",
        vars.body
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["world"] });
    }
  });
}
