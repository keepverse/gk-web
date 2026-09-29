import type { ContractRowDto } from "@/lib/bus/contracts";
import type { CreatureProfileDto } from "@/lib/bus/creatures";
import type {
  ArmouryPageDto,
  ArmouryRowDto,
  ChannelDeltaDto,
  CombinationRowDto,
  DisplayLineDto,
  ItemAssignmentDto,
  ItemCardDto,
  ItemCompareDto,
  ItemEquipOutcomeDto,
  ItemSurfaceStatusDto,
  WorkbenchCostDto,
  WorkbenchOutcomeDto,
  WorkbenchSocketDto
} from "@/lib/bus/items";
import type { RelicDto, RunItem, UniqueActorDto } from "@/lib/bus/types";
import type {
  ClaimableCacheListDto,
  LegionCargoDto,
  SectorStorageDto,
  WorldEntityDto,
  WorldEntityMemberDto,
  WorldForceDto,
  WorldLaneDto,
  WorldSectorDto,
  WorldSlotDto,
  WorldStateDto,
  WorldTurnEntryDto
} from "@/lib/bus/world";
import { absent, known, pendingWithReason, type Pending } from "./pending";
import type {
  ActorPhase,
  ActorView,
  ArmouryPageView,
  ArmouryRowView,
  CachePinListView,
  CargoRowKind,
  CargoView,
  ChannelDeltaView,
  ClaimCopyKey,
  CombinationShape,
  CombinationState,
  CombinationView,
  CommanderListRow,
  CommanderListView,
  ComparePayloadView,
  ContainerView,
  ContractView,
  DelveDoorState,
  DelveSightState,
  DelveView,
  DisplayLine,
  DomainOfferView,
  DominanceVerdict,
  DoorView,
  EquipAssignmentView,
  EquipOutcomeView,
  ExtractionView,
  FoldedStockRow,
  ForceView,
  IntelState,
  ItemRoleId,
  ItemSurfaceId,
  ItemSurfaceState,
  LaneView,
  LegionCargoBusAction,
  LegionCargoFold,
  LegionCargoGate,
  LegionSheetCopyKey,
  LegionMemberView,
  LegionPosition,
  LegionView,
  Magnitude,
  MemberView,
  ObjectPromptView,
  PackCellView,
  PackItemOriginView,
  PackView,
  PartyView,
  QuestView,
  Rarity,
  RenderStrategy,
  ResourceId,
  RoomView,
  RungOfferView,
  RunResult,
  RunView,
  SectorView,
  SetTierView,
  SetView,
  SlotView,
  SocketCellView,
  SocketsView,
  SourceKind,
  SupplyView,
  SurfaceStatusView,
  TalkView,
  TurnEventView,
  UnitClass,
  UnitClassGroupView,
  VaultView,
  WorkbenchCostView,
  WorkbenchOutcomeView,
  WorkbenchSocketView,
  WorkbenchVerb,
  CacheClaimApSlot,
  CacheClaimFold
} from "./types";

/**
 * The DTO→view adapter (T4). Filling a field later touches one file: this
 * one. No component, test fixture shape, or layer changes when a `pending`
 * becomes `known` (game-gui-map.md's contract section).
 *
 * Player-facing pending copy lives in `PLAYER_PENDING` — the UI renders these
 * strings verbatim (`pendingCopyGuard.ts` enforces player vocabulary).
 */
export const PLAYER_PENDING = {
  displayName: "Full name coming soon",
  xpToNext: "Next level isn't shown yet",
  channelSummary: "Stats aren't ready yet",
  elementTyping: "Element typing isn't ready yet",
  shieldStack: "Shield details aren't ready yet",
  equipSlots: "Equipment slots aren't ready yet",
  runSummary: "Run summary isn't ready yet",
  relicImplicit: "Equipping works — the bonus size isn't shown yet",
  contractDisplayName: "Species name isn't ready yet",
  summonerLevel: "Summoner rank isn't tracked yet",
  // world-stage W5 — every reason names the mechanic in the player's own words, not the field.
  loamCapacity: "How much this ground can hold isn't shown yet",
  lifelineInfo: "Ask to see what holding this ground protects",
  wardenBinding: "Whether a warden is bound here isn't shown yet",
  neglectedTurns: "How long this ground has gone untended isn't shown yet",
  gateKey: "What opens this road isn't shown yet",
  constructionProgress: "How much longer this will take isn't shown yet",
  memberRole: "Whether this one carries supply or fights isn't shown yet",
  legionSupply: "How much this legion is carrying isn't shown yet",
  legionCapacity: "How much this legion can carry isn't shown yet",
  legionBurn: "How fast this legion eats through its supply isn't shown yet",
  legionRunway: "How many turns of supply remain isn't shown yet",
  turnEventSentence: "The play-by-play for this turn isn't translated yet",
  // item module 20 — each reason names the thing the player is missing, not the field behind it.
  itemRole: "Which slot this goes in isn't shown yet",
  itemFrame: "Which kind of body this was made for isn't shown yet",
  itemRequirements: "What you need to use this isn't shown yet",
  itemAffixes: "This one's rolled bonuses aren't shown yet",
  itemEnhancement: "How far this has been strengthened isn't shown yet",
  itemSockets: "Its sockets aren't shown yet",
  itemSet: "Whether this belongs to a set isn't shown yet",
  itemGrantedAction: "Any move this teaches isn't shown yet",
  itemFooter: "Roll quality and salvage value aren't shown yet",
  itemBaseStats: "Its base numbers aren't shown yet",
  itemCompare: "Side-by-side numbers for these two aren't shown yet",
  // party-dungeon D5.3 — each reason names the thing the player is missing, matching the item-module
  // entries' own established tone, not the field or the code behind it.
  delveRoomFloor: "What's on the floor here isn't shown yet",
  delvePoolMax: "How full a meter can get isn't shown yet",
  delvePoolFill: "How full a meter reads isn't shown yet",
  delveNerveStage: "How shaken this one is isn't named yet",
  delveStatuses: "This one's status effects aren't shown yet",
  delvePack: "This party's pack isn't shown yet",
  delveQuests: "Quest progress isn't shown yet",
  delveTalkBand: "How this one feels about you isn't shown yet",
  delveTalkQuote: "What this one is saying isn't shown yet",
  delveTalkDecision: "The outcome of that isn't shown yet",
  delveSupplyDecision: "What that supply did isn't shown yet",
  delveWiped: "Whether the raid wiped isn't shown yet",
  delveFirstClearGrant: "A first-clear reward isn't shown yet",
  delveLevelUps: "Level-ups aren't shown yet",
  delveJoins: "New arrivals aren't shown yet",
  // D5.7 — the four room-scoped panels (`layers/{Talk,Event,ObjectPrompt,Supply}Panel.tsx`) and the
  // fight-input panel. `TalkView`/`ObjectPromptView`/`SupplyView` have no field that models "there is
  // no live producer for this panel at all" the way `PartyView.pack: Pending<PackView>` already does
  // for Pack — the panels themselves wrap the whole view in a presentation-level `Pending<T>` (a choice
  // made at the panel prop boundary, not a contract change) and reach for these only on the branch
  // where a real room genuinely could offer this surface (a wild room for Talk, a room with a real
  // `eventId` for Event); an ineligible room reads `absent()` instead, never one of these — see each
  // panel's own doc comment for the exact gating.
  delveTalkPanel: "What this room has to say isn't shown yet",
  delveEventPanel: "What's happening in this room isn't shown yet",
  delveObjectPromptPanel: "What's here isn't shown yet",
  delveSupplyPanel: "What your supplies can do here isn't shown yet",
  delveFightControls: "Fight controls aren't shown yet"
} as const;

/**
 * ssot-rarity.md §3.3's ten rungs — ordinal, display name, pip count, and the colour token T7
 * generates from the same table. Three channels for one fact (pips, name, colour), because colour
 * alone is not readable to everyone.
 *
 * A mirror of the ladder, never a second ladder: ids and ordinals are the shipped ones, and the
 * colours are `--color-rarity-*` tokens rather than hexes copied out of the document.
 */
const RARITY_LADDER: Rarity[] = [
  { id: "chaff", ordinal: 10, display: "Chaff", colour: "var(--color-rarity-chaff)", pips: 1 },
  { id: "sprout", ordinal: 20, display: "Sprout", colour: "var(--color-rarity-sprout)", pips: 2 },
  { id: "grafted", ordinal: 30, display: "Grafted", colour: "var(--color-rarity-grafted)", pips: 3 },
  { id: "cultivated", ordinal: 40, display: "Cultivated", colour: "var(--color-rarity-cultivated)", pips: 4 },
  { id: "fused", ordinal: 50, display: "Fused", colour: "var(--color-rarity-fused)", pips: 5 },
  { id: "chimeric", ordinal: 60, display: "Chimeric", colour: "var(--color-rarity-chimeric)", pips: 6 },
  { id: "heirloom", ordinal: 70, display: "Heirloom", colour: "var(--color-rarity-heirloom)", pips: 7 },
  { id: "firstseed", ordinal: 80, display: "Firstseed", colour: "var(--color-rarity-firstseed)", pips: 8 },
  { id: "sunwoven", ordinal: 90, display: "Sunwoven", colour: "var(--color-rarity-sunwoven)", pips: 9 },
  { id: "almanac", ordinal: 100, display: "Almanac", colour: "var(--color-rarity-almanac)", pips: 10 }
];

/**
 * By the rung id the wire sends, falling back to the ordinal when the id is unknown to this build —
 * an unrecognised rung renders as its nearest known one rather than as a blank swatch, and a row
 * with neither still renders (as the lowest rung) rather than disappearing from the list.
 */
function rarityFromWire(id: string, ordinal: number): Rarity {
  const byId = RARITY_LADDER.find((r) => r.id === id);
  if (byId) return byId;
  const byOrdinal = [...RARITY_LADDER].reverse().find((r) => ordinal >= r.ordinal);
  return byOrdinal ?? RARITY_LADDER[0]!;
}

function toActorPhase(phase: string): ActorPhase {
  switch (phase) {
    case "ActiveBound":
    case "ActiveUnbound":
    case "Retired":
    case "Idle":
      return phase;
    default:
      return "Idle";
  }
}

export function adaptActor(dto: UniqueActorDto): ActorView {
  return {
    instanceId: dto.instanceId,
    playerId: dto.playerId,
    side: dto.side === "zombie" ? "zombie" : "plant",
    typeId: dto.typeId,
    displayName: pendingWithReason(PLAYER_PENDING.displayName),
    phase: toActorPhase(dto.phase),
    level: dto.level,
    xp: dto.xp,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: dto.revision,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

function toRunResult(result: string | null | undefined): RunResult {
  switch (result) {
    case "victory":
    case "defeat":
    case "abandoned":
      return result;
    default:
      return "unknown";
  }
}

export function adaptRun(dto: RunItem): RunView {
  return {
    id: dto.id,
    levelName: dto.levelName ? { state: "known", value: dto.levelName } : absent(),
    result: toRunResult(dto.result),
    startedUtc: dto.startedUtc,
    endedUtc: dto.endedUtc ?? undefined,
    zombiesKilled: dto.zombiesKilled === undefined ? absent() : { state: "known", value: dto.zombiesKilled },
    plantsLost: dto.plantsDied === undefined ? absent() : { state: "known", value: dto.plantsDied },
    summary: dto.summary === undefined || dto.summary === null
      ? absent()
      : pendingWithReason(PLAYER_PENDING.runSummary)
  };
}

/**
 * T14's four seed relics use only the first four rungs of the real ten-rung ladder
 * (`docs/architecture/item/ssot-rarity.md` §3.3) — colours and pip counts are the
 * ladder's own, generated into `--color-rarity-*` (T7), not invented here.
 *
 * A slice of `RARITY_LADDER` above rather than a second copy of its first four rows: item module
 * 20 needed all ten, and two tables that agree today are two tables that can disagree later.
 */
const RELIC_RARITY_RUNGS = 4;

function rarityFromRelicTier(tier: number): Rarity {
  const clamped = Math.min(Math.max(Math.trunc(tier), 1), RELIC_RARITY_RUNGS);
  return RARITY_LADDER[clamped - 1]!;
}

function toSlotNoun(slot: string): string {
  return slot.length > 0 ? `Relic · ${slot[0]!.toUpperCase()}${slot.slice(1)}` : "Relic";
}

/**
 * Relics are the Container entity's "item" kind (docs/design/README.md §6) — not a
 * separate rung. Most of `ContainerView`'s richer blocks (affixes, sockets, sets,
 * enhancement) genuinely don't apply to this small, real, seeded catalog (T14's honest
 * scoping note): they're `absent`, not faked. `implicit` is `pending` rather than
 * `absent` — the relic's granted effect is real (verifiable via the equip API's
 * `mods_json`), just not yet expressible as a formatted `DisplayLine` magnitude.
 */
export function adaptRelic(dto: RelicDto): ContainerView {
  return {
    instanceId: dto.id,
    kind: "item",
    header: {
      name: dto.name,
      rarity: rarityFromRelicTier(dto.rarity),
      baseTypeAndClassNoun: toSlotNoun(dto.slot)
    },
    requirements: absent(),
    baseStats: [],
    implicit: pendingWithReason(PLAYER_PENDING.relicImplicit),
    affixes: absent(),
    enhancement: absent(),
    sockets: absent(),
    set: absent(),
    grantedAction: absent(),
    flavour: dto.description,
    footer: absent()
  };
}

export function adaptContract(row: ContractRowDto, profile: CreatureProfileDto): ContractView {
  return {
    instanceId: row.instanceId,
    speciesId: profile.speciesId,
    rarity: profile.rarity,
    bound: row.bound,
    loyalty: row.loyalty,
    rank: row.rank,
    personality: row.personality,
    upkeepPerDay: row.upkeepPerDay,
    deployable: row.deployable,
    displayName: pendingWithReason(PLAYER_PENDING.contractDisplayName)
  };
}

/** Every `pending` reason must be non-empty — the check T4's guard proves in tests. */
export function pendingReason<T>(p: Pending<T>): string | null {
  return p.state === "pending" ? p.reason : null;
}

type CommanderListRowDto = {
  id: string;
  displayName: string;
  isDefault: boolean;
  activeAuraId: string | null;
  activeAuraName: string | null;
  locationStub: string | null;
  legionStub: string | null;
  equipment?: { instanceId: string; containerId: string; role: string } | null;
};

type CommanderListResponseDto = {
  defaultLawnCommanderId: string;
  commanders: CommanderListRowDto[];
};

/** Maps a commander list row into ActorView for the shared ActorPanel commander role. */
export function adaptCommanderSheet(row: CommanderListRow, playerId: number): ActorView {
  return {
    instanceId: row.id,
    playerId,
    side: "plant",
    typeId: 0,
    displayName: known(row.displayName),
    phase: "Idle",
    level: 1,
    xp: 0,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 0,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

export function adaptCommanderList(dto: CommanderListResponseDto): CommanderListView {
  return {
    defaultLawnCommanderId: dto.defaultLawnCommanderId,
    commanders: dto.commanders.map(
      (row): CommanderListRow => ({
        id: row.id,
        displayName: row.displayName,
        isDefault: row.isDefault,
        activeAuraId: row.activeAuraId,
        activeAuraName: row.activeAuraName,
        locationStub: row.locationStub,
        legionStub: row.legionStub,
        ...(row.equipment ? { equipment: row.equipment } : {})
      })
    )
  };
}

// ===========================================================================
// world-stage W5 — adaptWorld* against the byte-pinned fixture (spec-world-contract.md §5).
// Pure functions; no loam number is derived here (spec-loam-fe.md's own rule) — every reading is
// carried straight from the wire, only wrapped with its unit family.
// ===========================================================================

function toIntelState(intel: string): IntelState {
  switch (intel) {
    case "Unknown":
    case "Rumored":
    case "Scouted":
    case "Watched":
      return intel;
    default:
      // Defensive only — the wire is a plain string at the type level. An unrecognised value is
      // treated as the least-informed state rather than thrown, matching fog's own direction: when
      // in doubt, show less, never more.
      return "Unknown";
  }
}

/**
 * `dto.intel` is the only field this adapter treats as meaningful for deciding what a zero *means*
 * — an unseen sector (`WorldEndpoints.cs:271-277`) serialises every other field at its record
 * default, so nothing here infers "unknown" from an empty string or a zero. Every reading below is
 * a straight pass-through of the wire value; the caller reads `intel` to know whether to trust it.
 */
export function adaptWorldSector(
  dto: WorldSectorDto,
  options?: { lifelinesRequested?: boolean }
): SectorView {
  const lifelinesRequested = options?.lifelinesRequested ?? false;
  return {
    sectorId: dto.sectorId,
    typeId: dto.typeId,
    climate: dto.climate,
    ownerFactionId: dto.ownerFactionId,
    intel: toIntelState(dto.intel),
    intelAge: dto.intelAge,
    phase: dto.phase,
    dangerBand: { unit: "count", value: dto.dangerBand },
    developmentLevel: { unit: "count", value: dto.developmentLevel },
    stability: { unit: "perMilleRatio", op: "flat", value: dto.stabilityMilli },
    // Found and fixed 2026-09-04 (world-inspector W63): `pressureMilli` was already on the wire DTO
    // mirror but never read here — `GroundBlock.tsx` had compensated with a hard-coded Pending line.
    pressure: { unit: "perMilleRatio", op: "flat", value: dto.pressureMilli },
    // `op: "absolute"` — see the module comment on SectorView in types.ts. The wire value passes
    // straight through; no delta-from-1000 arithmetic here, which would just move the derived-in-
    // TypeScript problem `spec-loam-fe.md` forbids one line over.
    fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: dto.fractureIntensityMilli },
    habitable: dto.habitable,
    layoutX: dto.layoutX,
    layoutY: dto.layoutY,
    loam: {
      production: { unit: "loamUnits", value: dto.loamProduction },
      upkeep: { unit: "loamUnits", value: dto.loamUpkeep },
      net: { unit: "loamUnits", value: dto.loamNet },
      stock: { unit: "loamUnits", value: dto.loamStock },
      // Found and fixed 2026-09-04 (world-hud W52's own "never projected" premise was stale):
      // `LoamPhases.EffectiveCapacity` is genuinely assigned server-side (`WorldEndpoints.cs:456-458`).
      capacity: known<Magnitude>({ unit: "loamUnits", value: dto.loamCapacity }),
      upkeepBreakdown: {
        base: { unit: "loamUnits", value: dto.upkeepBreakdown.base },
        garrison: { unit: "loamUnits", value: dto.upkeepBreakdown.garrison },
        development: { unit: "loamUnits", value: dto.upkeepBreakdown.development },
        danger: { unit: "loamUnits", value: dto.upkeepBreakdown.danger },
        // wonder-wire §Design 3 (plan Task 4A.4) — the fifth operand, straight off the wire,
        // never re-derived (the adapter derives nothing, spec-loam-fe.md's own rule).
        wonderUpkeep: { unit: "loamUnits", value: dto.upkeepBreakdown.wonderUpkeep },
        intensityMilli: { unit: "perMilleRatio", op: "absolute", value: dto.upkeepBreakdown.intensityMilli },
        handicapMilli: { unit: "perMilleRatio", op: "absolute", value: dto.upkeepBreakdown.handicapMilli }
      }
    },
    component: {
      componentId: dto.componentId,
      production: { unit: "loamUnits", value: dto.componentProduction },
      upkeep: { unit: "loamUnits", value: dto.componentUpkeep },
      net: { unit: "loamUnits", value: dto.componentNet },
      stock: { unit: "loamUnits", value: dto.componentStock }
    },
    willReleaseNextTurn: dto.willReleaseNextTurn,
    // Opt-in server sweep: the wire always sends a number/bool (0/false when not requested), which
    // is indistinguishable from "the real answer is zero" — so whether the caller asked for
    // `?lifelines=true` is what decides `known` vs `pending` here, not the value itself.
    // Found and fixed 2026-09-04 (world-numbers W48): `LifelineCost` is a march-cost delta from
    // `ReconnectionCost.For`/`AllPairsCost` (`Topology/ReconnectionCost.cs:36-70`) — the increase in
    // total travel cost across surviving sector pairs if this one is lost — never a loam amount and
    // never a sector count, despite its name reading like the latter. `count` is the honest unit:
    // an abstract magnitude, not one of the twelve/thirteen named classes' own semantics.
    lifelineCost: lifelinesRequested
      ? known<Magnitude>({ unit: "count", value: dto.lifelineCost })
      : pendingWithReason(PLAYER_PENDING.lifelineInfo),
    lifeline: lifelinesRequested ? known(dto.lifeline) : pendingWithReason(PLAYER_PENDING.lifelineInfo),
    // Found and fixed 2026-09-04 (world-inspector W63): both fields are real, owner-gated DTO
    // fields (`WorldEndpoints.cs:451-455`) — no warden-binding mechanic exists yet (`world-confirms`,
    // Phase 4), so `known(null)` today is the honest current answer ("none bound"), not a gap.
    wardenBindingId: known(dto.wardenBindingId),
    neglectedTurns: known<Magnitude>({ unit: "count", value: dto.neglectedTurns }),
    // wonder-wire §Design 3 (plan Task 4A.4) — owner-only attribution reads, straight off the
    // wire. Plain values, never Pending: the server always projects them (0 for unowned/unseen).
    wonderLiveCountSector: { unit: "count", value: dto.wonderLiveCountSector },
    wonderLiveCountEmpire: { unit: "count", value: dto.wonderLiveCountEmpire },
    wonderProductionContribution: { unit: "loamUnits", value: dto.wonderProductionContribution }
  };
}

export function adaptWorldLane(dto: WorldLaneDto): LaneView {
  return {
    laneId: dto.laneId,
    fromSectorId: dto.fromSectorId,
    toSectorId: dto.toSectorId,
    typeId: dto.typeId,
    length: { unit: "count", value: dto.length },
    width: { unit: "count", value: dto.width },
    hazard: { unit: "perMilleRatio", op: "flat", value: dto.hazardMilli },
    wardLevel: { unit: "count", value: dto.wardLevel },
    state: dto.state,
    gateKeyId: pendingWithReason(PLAYER_PENDING.gateKey)
  };
}

/**
 * `constructionTurnsRemaining`: found and fixed 2026-09-04 (world-stage W62) — genuinely on the
 * wire and assigned server-side (`WorldEndpoints.cs:482`), never actually missing; the earlier
 * `pendingWithReason(PLAYER_PENDING.constructionProgress)` here papered over the fact that
 * `WorldSlotDto`'s TS mirror simply never carried the field, which is the bug this session's own
 * `structureId` finding already named once. `known(...)` now, straight off the wire.
 */
export function adaptWorldSlot(dto: WorldSlotDto): SlotView {
  return {
    slotIndex: dto.slotIndex,
    slotTypeId: dto.slotTypeId,
    element: dto.element,
    state: dto.state,
    ownerFactionId: dto.ownerFactionId,
    guardWaveId: dto.guardWaveId,
    guardState: dto.guardState,
    structureId: dto.structureId,
    constructionTurnsRemaining: known(dto.constructionTurnsRemaining),
    // wonder-wire §Design 2 (plan Task 4A.4) — the Wonder facet rides inline, no second fetch.
    // Plain pass-through, never Pending: the wire always sends it (`null` for empty slots,
    // unknown ids and non-Wonder rows — the adapter branches on nothing here).
    wonderScope: dto.wonderScope,
    wonderRarity: dto.wonderRarity
  };
}

export function adaptWorldForce(dto: WorldForceDto): ForceView {
  if (dto.exact) {
    return {
      entityId: dto.entityId,
      ownerFactionId: dto.ownerFactionId,
      kind: dto.kind,
      exact: true,
      strength: { unit: "gameUnits", value: dto.strength }
    };
  }
  return {
    entityId: dto.entityId,
    ownerFactionId: dto.ownerFactionId,
    kind: dto.kind,
    exact: false,
    bandName: dto.bandName,
    bandCeiling: { unit: "gameUnits", value: dto.bandCeiling }
  };
}

function toLegionPosition(dto: WorldEntityDto): LegionPosition {
  if (dto.atSectorId != null) {
    return { kind: "sector", sectorId: dto.atSectorId };
  }
  return {
    kind: "lane",
    laneId: dto.onLaneId ?? "",
    towardSectorId: dto.onLaneTowardSectorId ?? "",
    progress: { unit: "perMilleRatio", op: "flat", value: dto.laneProgressMilli }
  };
}

function adaptLegionMember(dto: WorldEntityMemberDto): LegionMemberView {
  return {
    instanceId: dto.instanceId,
    speciesId: dto.speciesId,
    level: { unit: "count", value: dto.level },
    hp: { unit: "gameUnits", value: dto.hp },
    wounds: { unit: "gameUnits", value: dto.wounds },
    role: pendingWithReason(PLAYER_PENDING.memberRole)
  };
}

export function adaptWorldLegion(dto: WorldEntityDto): LegionView {
  return {
    entityId: dto.entityId,
    kind: dto.kind,
    ownerFactionId: dto.ownerFactionId,
    position: toLegionPosition(dto),
    stance: dto.stance,
    // The name says nothing about its unit by itself — MovementPolicy.PointsPerTurn = 1000, so this
    // is per-mille of one turn's march budget, never a raw count.
    movementRemaining: { unit: "perMilleRatio", op: "flat", value: dto.movementRemaining },
    routed: dto.routed,
    members: dto.members.map(adaptLegionMember),
    carriedLoam: pendingWithReason(PLAYER_PENDING.legionSupply),
    capacity: pendingWithReason(PLAYER_PENDING.legionCapacity),
    burn: pendingWithReason(PLAYER_PENDING.legionBurn),
    runway: pendingWithReason(PLAYER_PENDING.legionRunway)
  };
}

export function adaptWorldTurnEvent(dto: WorldTurnEntryDto): TurnEventView {
  return {
    sectorId: dto.sectorId ?? null,
    phase: dto.phase,
    kind: dto.kind,
    subject: dto.subject,
    detail: dto.detail,
    // world-playback owns the one translation table; this adapter never guesses a sentence.
    sentence: pendingWithReason(PLAYER_PENDING.turnEventSentence)
  };
}

/**
 * The whole-state adapter (added closing the scene-composition wiring gap, 2026-09-04) —
 * `contractGuard.ts` bans every `stages/`/`layers/`/`ui/` file from importing a `*Dto` type by
 * name, so `WorldScene.tsx` cannot touch `WorldStateDto` itself even to read `sectors`/`lanes`
 * off it. This is the one function that does, producing only view types on the other side: slots
 * and forces are keyed by their owning sector's id since neither lives on `SectorView` itself
 * (matching `SectorInspectorProps`'s own established shape — `slots`/`forces` are sibling props,
 * never nested fields).
 */
export type AdaptedWorldState = {
  sectors: SectorView[];
  lanes: LaneView[];
  slotsBySectorId: Record<string, SlotView[]>;
  forcesBySectorId: Record<string, ForceView[]>;
};

export function adaptWorldState(
  dto: WorldStateDto,
  options?: { lifelinesRequested?: boolean }
): AdaptedWorldState {
  const slotsBySectorId: Record<string, SlotView[]> = {};
  const forcesBySectorId: Record<string, ForceView[]> = {};
  for (const sector of dto.sectors) {
    slotsBySectorId[sector.sectorId] = sector.slots.map(adaptWorldSlot);
    forcesBySectorId[sector.sectorId] = sector.forces.map(adaptWorldForce);
  }

  return {
    sectors: dto.sectors.map((s) => adaptWorldSector(s, options)),
    lanes: dto.lanes.map(adaptWorldLane),
    slotsBySectorId,
    forcesBySectorId
  };
}

// ===========================================================================
// Item surfaces — item module 20 (`spec-item-surfaces.md`), over the read-only
// `GET /api/items/*` routes.
//
// ⛔ These adapters RENAME and RESHAPE. They compute nothing: no distance is
// derived here, no verdict decided, no magnitude recombined. Every number
// below arrives on the wire already resolved by the module that owns it.
// ===========================================================================

const ITEM_SURFACE_IDS: ItemSurfaceId[] = [
  "armoury",
  "equipScreen",
  "itemCard",
  "comparison",
  "socketBench",
  "compendium"
];

function toItemSurfaceId(wire: string): ItemSurfaceId | null {
  return ITEM_SURFACE_IDS.find((id) => id === wire) ?? null;
}

/**
 * The C# enum name, lower-cased. Precedence is the server's — locked before loading before error
 * before empty — so this is a rename, never a re-decision.
 *
 * An unrecognised state resolves to `error` rather than `ready`: a surface we cannot describe must
 * not claim to be showing everything.
 */
function toItemSurfaceState(wire: string): ItemSurfaceState {
  switch (wire) {
    case "Locked":
      return "locked";
    case "Loading":
      return "loading";
    case "Empty":
      return "empty";
    case "Ready":
      return "ready";
    case "Error":
    default:
      return "error";
  }
}

export function adaptItemSurfaces(dtos: ItemSurfaceStatusDto[]): SurfaceStatusView[] {
  const views: SurfaceStatusView[] = [];
  for (const dto of dtos) {
    const surface = toItemSurfaceId(dto.surface);
    if (!surface) continue;
    views.push({ surface, state: toItemSurfaceState(dto.state), unlockKey: dto.unlockKey });
  }
  return views;
}

function toRenderStrategy(wire: string): RenderStrategy {
  switch (wire) {
    case "Virtualize":
      return "virtualize";
    case "SearchFirst":
      return "searchFirst";
    case "RenderAll":
    default:
      return "renderAll";
  }
}

export function adaptArmouryRow(dto: ArmouryRowDto): ArmouryRowView {
  return {
    instanceId: dto.instanceId,
    containerId: dto.containerId,
    rarity: rarityFromWire(dto.rarity, dto.rarityOrdinal),
    role: pendingWithReason(PLAYER_PENDING.itemRole),
    frame: pendingWithReason(PLAYER_PENDING.itemFrame),
    assigned: dto.assigned,
    locked: dto.locked,
    unseen: dto.unseen,
    stale: dto.stale,
    acquiredUtc: dto.acquiredUtc,
    // item-content `granted-action-text` (T15). `?? false` covers a server older than the field
    // rather than letting `undefined` reach a boolean slot — absent is "we do not know of one".
    battleOnly: dto.battleOnly ?? false,
    // item-content `item-naming` (T3). `""` on the wire and an older server with no field at all are
    // the same fact — "no authored name for this container" — and both become `null` so the row has
    // one shape to render, never the container id.
    containerName: dto.containerName && dto.containerName.length > 0 ? dto.containerName : null
  };
}

export function adaptArmouryPage(dto: ArmouryPageDto): ArmouryPageView {
  return {
    inbox: {
      unseen: { unit: "count", value: dto.unseen },
      total: { unit: "count", value: dto.total },
      overReviewPressure: dto.overReviewPressure
    },
    strategy: toRenderStrategy(dto.renderStrategy),
    rows: dto.rows.map(adaptArmouryRow)
  };
}

const COMBINATION_SHAPES: CombinationShape[] = [
  "strain",
  "splice",
  "pure",
  "ring",
  "eclipse",
  "diversity"
];

/**
 * `Undiscovered` never reaches the wire — the reveal pass drops it before serialising — so an
 * unrecognised state maps there rather than to a state that would render. Showing a row we cannot
 * classify is how a combination the player has not earned appears in the list.
 */
function toCombinationState(wire: string): CombinationState {
  switch (wire) {
    case "Active":
      return "active";
    case "OneAway":
      return "one-away";
    case "KnownInactive":
      return "known-inactive";
    default:
      return "undiscovered";
  }
}

/**
 * A combination's own words, for the row title — item-content `item-naming` (T3).
 *
 * ⚠ **A placement, never a translation**, and the same rule `keyTail` states for `class.*` /
 * `rarity.*`: the 25 shipped combinations are GENERATED by `ResonanceGenerator` from the element
 * roster (`combo.pure-fire-3`, `combo.ring-fire-ice`, `combo.eclipse`, `combo.diversity-4`) and
 * **no corpus authors a name for one**. So this drops the mandatory `combo.` kind prefix D27 fixes,
 * turns the id's own hyphenated tail into words and title-cases them. Nothing English is invented,
 * and no second copy of the generator's grammar is parsed out — the whole tail is kept precisely so
 * `combo.pure-fire-3` and `combo.pure-fire-4` stay distinguishable.
 *
 * **Named gap, owner module 16/21:** there is no resonance-name corpus. The day one ships, this
 * function reads it and no caller changes.
 */
export function combinationTitle(comboId: string): string {
  const tail = comboId.replace(/^combo\./, "").replace(/-/g, " ").trim();
  if (tail.length === 0) return comboId;
  return tail.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function adaptCombination(dto: CombinationRowDto): CombinationView {
  return {
    comboId: dto.comboId,
    title: combinationTitle(dto.comboId),
    shape: COMBINATION_SHAPES.find((s) => s === dto.shape) ?? "pure",
    state: toCombinationState(dto.state),
    distance: dto.distance,
    missingFamilies: dto.missingFamilies,
    missingElements: dto.missingElements,
    grantedTier: dto.grantedTier
  };
}

export function adaptCombinations(dtos: CombinationRowDto[]): CombinationView[] {
  return dtos.map(adaptCombination).filter((c) => c.state !== "undiscovered");
}

/**
 * An armoury row as the eleven-block container the item card renders.
 *
 * ⚠ Most blocks come back `pending`, and that is the honest state rather than a gap being papered
 * over: the armoury route serves ownership and flags, and no route serves module 10's rendered
 * card yet. `sockets` is filled separately by the caller that has already read the combination
 * route for this instance, so the card never triggers a second read of its own.
 *
 * `relicName` is the display name where the seeded relic catalog knows this container.
 *
 * ⛔ **The container id is no longer the fallback** (item-content `item-naming` T3). It used to be
 * `?? row.containerId`, so a real item with no relic-catalog row rendered `item.plate-helm.fused`
 * where its name belongs. The order now is: the relic catalog's name, then the base type's own
 * authored name off the armoury row (T2's field, carried by T3), then `UNNAMED_ITEM` — a sentence,
 * not an id. A shortened or prettified id is still an id.
 */
export const UNNAMED_ITEM = "Unnamed item";

export function adaptArmouryItem(row: ArmouryRowView, relicName?: string): ContainerView {
  return {
    instanceId: row.instanceId,
    kind: "item",
    header: {
      name: relicName ?? row.containerName ?? UNNAMED_ITEM,
      rarity: row.rarity,
      baseTypeAndClassNoun: row.role.state === "known" ? row.role.value : "Item"
    },
    requirements: pendingWithReason(PLAYER_PENDING.itemRequirements),
    baseStats: [],
    implicit: pendingWithReason(PLAYER_PENDING.itemBaseStats),
    affixes: pendingWithReason(PLAYER_PENDING.itemAffixes),
    enhancement: pendingWithReason(PLAYER_PENDING.itemEnhancement),
    sockets: pendingWithReason(PLAYER_PENDING.itemSockets),
    set: pendingWithReason(PLAYER_PENDING.itemSet),
    grantedAction: pendingWithReason(PLAYER_PENDING.itemGrantedAction),
    footer: known({ stale: row.stale, locked: row.locked })
  };
}

// ===========================================================================
// item module 10 — the rendered card, and the comparison built on two of them
//
// ⛔ Nothing below composes a sentence, formats a magnitude, decides a verdict
// or groups a delta. All four already happened in `ItemCardRenderer`,
// `ArmouryCompare` and `DominancePresentation`; this section renames their
// output into view types and does no arithmetic at all.
// ===========================================================================

/** `item.card.header` etc — the block keys `CardBlocks` declares, in the order it declares them. */
const CARD_BLOCK = {
  header: "item.card.header",
  requirements: "item.card.requirements",
  baseStats: "item.card.base-stats",
  implicit: "item.card.implicit",
  affixes: "item.card.affixes",
  enhancement: "item.card.enhancement",
  sockets: "item.card.sockets",
  set: "item.card.set",
  grantedAction: "item.card.granted-action",
  flavour: "item.card.flavour",
  footer: "item.card.footer"
} as const;

/** C# `UnitClass` member names → the contract's own camelCase vocabulary. Closed, both ends. */
const UNIT_CLASS_BY_WIRE: Record<string, UnitClass> = {
  GameUnits: "gameUnits",
  GameUnitsPerSecond: "gameUnitsPerSecond",
  SigmoidPoints: "sigmoidPoints",
  SigmoidMultiplierPoints: "sigmoidMultiplierPoints",
  StatusPotencyPoints: "statusPotencyPoints",
  PerMilleRatio: "perMilleRatio",
  Milliseconds: "milliseconds",
  Count: "count",
  Flag: "flag",
  LadderIndex: "ladderIndex",
  AptitudePoints: "aptitudePoints",
  ReciprocalPoints: "reciprocalPoints",
  LoamUnits: "loamUnits"
};

/** C# `SourceKind` member names → §4.4's twelve kebab-case values. */
const SOURCE_KIND_BY_WIRE: Record<string, SourceKind> = {
  Base: "base",
  Implicit: "implicit",
  AffixPrefix: "affix-prefix",
  AffixSuffix: "affix-suffix",
  Enhancement: "enhancement",
  SocketInsert: "socket-insert",
  Resonance: "resonance",
  Word: "word",
  SetThreshold: "set-threshold",
  GrantedAction: "granted-action",
  UniqueIdentity: "unique-identity",
  UniqueVariance: "unique-variance"
};

const DOMINANCE_BY_WIRE: Record<string, DominanceVerdict> = {
  StrictlyBetter: "strictly-better",
  StrictlyWorse: "strictly-worse",
  Sidegrade: "sidegrade",
  Incomparable: "incomparable"
};

/**
 * A display key's last segment, shown where the key itself would be.
 *
 * ⚠ **A placement, never a translation.** `gk-content/content/display/en.json` still carries no row for
 * `class.*` / `rarity.*` / `combo.*` / `item.compare.*` — a named wiring gap in the string corpus,
 * owned by the content side — so for those the honest thing to show is the key's own tail rather than
 * an invented English word. The same rule `ItemCard`'s `LineRow` already applies to a line's label.
 *
 * ⛔ **Flavour no longer comes through here** (item-content T6, 2026-09-06). The catalog now carries a
 * real row for all 118 authored unique and set sentences, the server resolves it, and the card's
 * flavour line arrives with the finished sentence in `__rendered` — see `adaptItemCard`. A key with no
 * catalog row renders no flavour at all, which is the honest answer; `keyTail` on a flavour key would
 * turn `flavor.unique.carrion-spitter` into "carrion spitter" and call it prose.
 */
function keyTail(key: string | undefined): string {
  if (!key) return "";
  return key.split(".").slice(-1)[0]!.replace(/-/g, " ");
}

/**
 * A display KEY looks like `base.honed-hatchet` — lower-case dotted segments, no spaces. An authored
 * name looks like `Sturdy Card-Proof Charm`.
 *
 * ⛔ **This exists because `keyTail` became wrong the day item-content T1 landed.** The card header's
 * `name` arg now carries `ItemNameComposer`'s real output, and running a key-tail over a real name
 * eats its hyphens and everything before its first full stop — `Card-Proof Charm` rendered as
 * `Card Proof Charm`. So a real name is shown VERBATIM, and only a value still shaped like a key is
 * given the key-tail placement (`ItemName`'s own last-ditch fallback, for a base type authoring no
 * `name` at all).
 */
const DISPLAY_KEY_SHAPE = /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/;

function authoredNameOrKeyTail(value: string | undefined): string {
  if (!value) return "";
  return DISPLAY_KEY_SHAPE.test(value) ? keyTail(value) : value;
}

/** Resolve authored catalog copy for a derived channel. Player surfaces never synthesize words from ids. */
export function channelLabel(channelId: string): string {
  const surface = window.__fusionRpgActorSurface;
  const family = surface?.families
    .filter((row) => channelId === row.family || channelId.startsWith(`${row.family}.`))
    .sort((a, b) => b.family.length - a.family.length)[0];
  if (!family) return "Unknown stat";

  const suffix = channelId === family.family ? "" : channelId.slice(family.family.length + 1);
  const element = surface?.elements.find((row) => row.id === suffix);
  return element ? `${family.displayName} · ${element.displayName}` : family.displayName;
}

/**
 * A generated id, in the words it is already made of — the shared placement `channelLabel` and the
 * material lines both use. **It translates nothing**: every word out is a word that was in the id.
 *
 * Used only where the id is STRUCTURALLY generated and no corpus authors a name for it — derived
 * channels (`DerivedStatRegistry`) and materials (`MaterialCatalog`'s 27 generated ids). Anywhere a
 * corpus does author a name — base types, sets, gems, recipes, relics — that authored string is read
 * instead and this function must not be reached for.
 */
export function idWords(id: string): string {
  const words = id
    .replace(/\./g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .toLowerCase()
    .trim();
  if (words.length === 0) return id;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function adaptDisplayLine(dto: DisplayLineDto): DisplayLine {
  const { __rendered: rendered, ...args } = dto.args;
  const line: DisplayLine = {
    key: dto.key,
    // Every arg stays a STRING: the renderer already formatted each magnitude into the sentence it
    // composed, and re-typing one as a `Magnitude` here would invite a second formatting pass.
    args,
    unit: dto.unit ? UNIT_CLASS_BY_WIRE[dto.unit] ?? null : null,
    sourceKind: dto.sourceKind ? SOURCE_KIND_BY_WIRE[dto.sourceKind] ?? null : null,
    groupOrder: dto.groupOrder
  };
  if (rendered) line.rendered = rendered;
  if (dto.rollBarSegments !== null) line.rollBarSegments = dto.rollBarSegments;
  if (dto.rollQualityPerMille !== null) line.rollQualityPerMille = dto.rollQualityPerMille;
  if (dto.contextRead) line.context = { reference: "neutral", text: dto.contextRead };
  return line;
}

function blockLines(dto: ItemCardDto, blockKey: string): DisplayLineDto[] {
  return dto.blocks.find((b) => b.blockKey === blockKey)?.lines ?? [];
}

function linesOf(dto: ItemCardDto, blockKey: string): DisplayLine[] {
  return blockLines(dto, blockKey).map(adaptDisplayLine);
}

/** `known` when the block rendered something, `absent` when it rendered nothing. Never `pending`:
 * the route answered, so "not shown yet" is no longer one of the possibilities. */
function blockPending(dto: ItemCardDto, blockKey: string): Pending<DisplayLine[]> {
  const lines = linesOf(dto, blockKey);
  return lines.length > 0 ? known(lines) : absent<DisplayLine[]>();
}

function rarityFromCard(args: Record<string, string>): Rarity {
  const id = (args.rungKey ?? "").replace(/^rarity\./, "");
  const rung = RARITY_LADDER.find((r) => r.id === id);
  if (rung) return rung;
  // A rung the shipped ladder does not carry: the card still states all three redundant channels
  // itself, so those are used rather than a different rung's.
  return {
    ...RARITY_LADDER[0]!,
    display: keyTail(args.rungKey),
    colour: args.colorHex ?? RARITY_LADDER[0]!.colour,
    pips: Number(args.pips ?? "0")
  };
}

/**
 * A rung by its wire key (`rarity.cultivated`). Returns undefined for a key the shipped ladder does
 * not carry — the promotion mark is optional, so an unknown rung renders as no mark rather than as
 * a fabricated rung (T26).
 */
function rarityByKey(key: string | undefined): Rarity | undefined {
  if (!key) return undefined;
  return RARITY_LADDER.find((r) => r.id === key.replace(/^rarity\./, ""));
}

function adaptSockets(dto: ItemCardDto, combinations: CombinationView[]): Pending<SocketsView> {
  const cells: SocketCellView[] = blockLines(dto, CARD_BLOCK.sockets)
    .filter((l) => l.key === "item.card.socket.cell")
    .map((l) => ({
      index: Number(l.args.index ?? "0"),
      affinity: l.args.affinityKey ? keyTail(l.args.affinityKey) : null,
      insertName: l.args.empty === "1" ? null : keyTail(l.args.insertKey),
      omniCountsDiversityOnly: l.args.omniDiversityOnly === "1"
    }));

  if (cells.length === 0 && combinations.length === 0) return absent<SocketsView>();
  return known({ cells, combinations });
}

function adaptSet(dto: ItemCardDto): Pending<SetView> {
  const lines = blockLines(dto, CARD_BLOCK.set);
  const header = lines.find((l) => l.key === "item.card.set.header");
  if (!header) return absent<SetView>();

  // item-content T2 put the set's authored display name on the wire beside its key; T3 reads it.
  const name = authoredNameOrKeyTail(header.args.name) || keyTail(header.args.nameKey);
  const ladder: SetTierView[] = lines
    .filter((l) => l.key === "item.card.set.threshold")
    .map((l) => ({
      piecesRequired: Number(l.args.pieces ?? "0"),
      active: l.args.active === "1",
      isCapability: l.args.capability === "1"
    }));

  const redundant = header.args.redundant === "1";
  // P8.4 — the multi-set per-piece disclosure, on THIS block. Module 12's own measured corpus fact is
  // why it is not a nicety: 25 of the 154 shipped (role, base type) member pairs belong to more than
  // one set, one to three, so the primary row above is at most a third of the truth. The extra sets
  // arrive as `item.card.set.other` lines beside the header and the ladder — the existing single-set
  // block extended, never a second block and never a second route.
  const peers = lines
    .filter((l) => l.key === "item.card.set.other")
    .map((l) => ({
      name: authoredNameOrKeyTail(l.args.name) || keyTail(l.args.nameKey),
      redundant: l.args.redundant === "1"
    }));
  const advances = redundant ? [] : [name];
  const redundantIn = redundant ? [name] : [];
  for (const peer of peers) (peer.redundant ? redundantIn : advances).push(peer.name);
  return known({
    setId: (header.args.nameKey ?? "").replace(/^set\./, ""),
    name,
    count: Number(header.args.count ?? "0"),
    total: Number(header.args.total ?? "0"),
    ladder,
    advances,
    redundantIn
  });
}

/**
 * ⭐ One rendered card, as the eleven-block container the item card draws — the adapter for
 * `GET /api/items/{instanceId}/card`.
 *
 * `combinations` comes from the caller that has already read `GET /api/items/{id}/combinations`: the
 * card's own socket block renders the combination SENTENCES, but `CombinationView` also carries the
 * shape and the granted tier, which only that route reports. Passing them in keeps the card from
 * triggering a second read of its own, and leaving them out is honest rather than empty-by-guess.
 */
export function adaptItemCard(dto: ItemCardDto, combinations: CombinationView[] = []): ContainerView {
  const header = blockLines(dto, CARD_BLOCK.header)[0]?.args ?? {};
  const enhancement = blockLines(dto, CARD_BLOCK.enhancement)[0];
  const footer = blockLines(dto, CARD_BLOCK.footer)[0]?.args ?? {};
  // Block 10 can carry a unique's line and a set's (a unique may not be a set member, so in practice
  // one). Only lines the string catalog actually resolved are shown — a key with no row contributes
  // nothing rather than its own tail dressed up as a sentence.
  const flavour = blockLines(dto, CARD_BLOCK.flavour)
    .map((l) => l.args.__rendered)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  const view: ContainerView = {
    instanceId: dto.instanceId,
    kind: "item",
    header: {
      // item-content T3: `ItemNameComposer`'s real output, shown as composed. See
      // `authoredNameOrKeyTail` for why this is no longer an unconditional `keyTail`.
      name: authoredNameOrKeyTail(header.name),
      rarity: rarityFromCard(header),
      // T2 put the base type's AUTHORED name on the wire beside its key; the key stays the
      // localisation path and the authored string is what renders while no `base.*` catalog row
      // exists. `keyTail` remains the honest placement for the class noun, which has neither.
      baseTypeAndClassNoun: [
        authoredNameOrKeyTail(header.baseName) || keyTail(header.baseNameKey),
        keyTail(header.classNounKey)
      ]
        .filter((s) => s.length > 0)
        .join(" · ")
    },
    requirements: blockPending(dto, CARD_BLOCK.requirements),
    baseStats: linesOf(dto, CARD_BLOCK.baseStats),
    implicit: blockPending(dto, CARD_BLOCK.implicit),
    affixes: blockPending(dto, CARD_BLOCK.affixes),
    enhancement: enhancement
      ? known({
          tier: Number(enhancement.args.level ?? "0"),
          nextMilestone: adaptDisplayLine(enhancement)
        })
      : absent(),
    sockets: adaptSockets(dto, combinations),
    set: adaptSet(dto),
    grantedAction: blockPending(dto, CARD_BLOCK.grantedAction),
    footer: known({
      // `""` is block 11's own "nothing on this item rolled", not a missing read.
      ...(footer.meanRollQuality ? { meanRollQuality: footer.meanRollQuality } : {}),
      stale: footer.stale === "1",
      locked: footer.locked === "1"
    })
  };

  if (header.frame) view.header.frameBadge = header.frame;
  if (header.ilvl) view.header.itemLevel = Number(header.ilvl);
  // Absent at +0 rather than present as "+0": a zero enhancement is not a thing the item has.
  if (header.enhance) view.header.enhancementPrefix = header.enhance + " ";
  // species-gear-chain T26: the promotion mark, present only when the item climbed. An unknown rung
  // key resolves to nothing rather than to a fabricated rung.
  const promotedFrom = rarityByKey(header.promotedFromKey);
  if (promotedFrom) view.header.promotedFromRarity = promotedFrom;
  if (flavour.length > 0) view.flavour = flavour.join("\n\n");

  return view;
}

function adaptChannelDelta(dto: ChannelDeltaDto): ChannelDeltaView {
  // ONE unit vocabulary, shared with the group header above. Until 2026-09-06 the delta carried a
  // second one of its own (`game-units` / `per-mille`, derived server-side from the atom's OP) and
  // could disagree with the group it sat in — `maxHp` arrived as `per-mille` inside a `GameUnits`
  // header. The server now labels the CHANNEL, which is the unit ledger's own rule.
  const unit = dto.unit ? UNIT_CLASS_BY_WIRE[dto.unit] ?? "gameUnits" : "gameUnits";
  // `more` is the per-mille reading for a value that is already a delta from zero — a stat
  // modifier's own "+400‰ more". `flat` would render a proportion as if it were an absolute.
  const op = unit === "perMilleRatio" ? ("more" as const) : undefined;
  const magnitude = (value: number): Magnitude =>
    op ? { unit, value, channel: dto.channel, op } : { unit, value, channel: dto.channel };

  return {
    channel: dto.channel,
    incumbent: magnitude(dto.incumbent),
    candidate: magnitude(dto.candidate),
    delta: magnitude(dto.delta)
  };
}

/**
 * ⭐ The comparison payload — `DominancePresentation`'s verdict, trade and unit-class grouping, plus
 * module 13's deltas, exactly as the server decided them.
 *
 * ⛔ **No synthesized scalar reaches this view, and there is no field one could hide in.** The
 * footnote that says why is the server's own constant key.
 */
export function adaptItemCompare(dto: ItemCompareDto): ComparePayloadView {
  const verdict = DOMINANCE_BY_WIRE[dto.dominance] ?? "incomparable";
  const groups: UnitClassGroupView[] = dto.unitGroups.map((g) => ({
    // An unresolvable unit keeps its OWN group; folding it into `gameUnits` is the exact guess SC4
    // forbids, and the server already made the same choice on the way out.
    unit: g.unit ? UNIT_CLASS_BY_WIRE[g.unit] ?? null : null,
    deltas: g.deltas.map(adaptChannelDelta)
  }));

  return {
    badge: { verdict, label: keyTail(dto.badge.labelKey), shape: dto.badge.shape },
    groups,
    // Only a sidegrade is a trade. For every other verdict the split is real but says nothing the
    // verdict word has not already said, so it is not drawn.
    trade:
      verdict === "sidegrade"
        ? {
            youGain: dto.trade.youGain.map(adaptChannelDelta),
            youGiveUp: dto.trade.youGiveUp.map(adaptChannelDelta)
          }
        : null,
    incomparableReason: dto.incomparableReasonKey ? keyTail(dto.incomparableReasonKey) : null,
    meanRollQualityPerMille: dto.meanRollQualityMilliCandidate
  };
}

const WORKBENCH_VERBS: WorkbenchVerb[] = [
  "salvage",
  "upcycle",
  "enhance",
  "socket-add",
  "socket-insert",
  "socket-imbue"
];

function adaptWorkbenchCost(dto: WorkbenchCostDto): WorkbenchCostView {
  return {
    materialClass: dto.class,
    materialId: dto.materialId,
    qty: { unit: "count", value: dto.qty }
  };
}

/** `""` is "no affinity declared" on the wire; `null` is that same fact in the view. */
function adaptWorkbenchSocket(dto: WorkbenchSocketDto): WorkbenchSocketView {
  return {
    index: dto.index,
    affinity: dto.affinity.length > 0 ? dto.affinity : null,
    crafted: dto.crafted,
    insertContainerId: dto.insert && dto.insert.length > 0 ? dto.insert : null,
    // item-content T4. `""` on the wire and a server too old to send the field are the same fact.
    insertName: dto.insertName && dto.insertName.length > 0 ? dto.insertName : null
  };
}

/**
 * The workbench's own reply, in view terms.
 *
 * ⛔ **Nothing is composed here.** Every quantity, the level, the pity counter and the roll chance
 * are the server's resolved values; this function labels their unit class and stops.
 *
 * `successMilli` is `0` on every verb that rolls nothing, and a zero *chance* and an absent one are
 * different sentences — so it becomes `null` for those verbs rather than a 0‰ the bench would
 * render as "0.0% to succeed" beside a socket that never rolled.
 */
export function adaptWorkbenchOutcome(dto: WorkbenchOutcomeDto): WorkbenchOutcomeView {
  const rolls = dto.verb === "enhance";
  return {
    ok: dto.ok,
    verb: WORKBENCH_VERBS.find((v) => v === dto.verb) ?? "salvage",
    reason: dto.reason,
    instanceId: dto.instanceId,
    recipeId: dto.recipeId,
    opSeq: dto.opSeq,
    replayed: dto.replayed,
    outcome: dto.outcome,
    enhanceLevel: { unit: "count", value: dto.enhanceLevel },
    pityCounter: { unit: "count", value: dto.pityCounter },
    successChance: rolls ? { unit: "perMilleRatio", value: dto.successMilli, op: "flat" } : null,
    spent: dto.spent.map(adaptWorkbenchCost),
    granted: dto.granted.map(adaptWorkbenchCost),
    sockets: dto.sockets.map(adaptWorkbenchSocket)
  };
}

// ---------------------------------------------------------------------------
// item module 4 (`equip-assign`) — equip / unequip
// ---------------------------------------------------------------------------

/**
 * `core.v1.json`'s sixteen role ids, closed. The registry is append-only, so a role the server
 * sends that is not here means the registry grew and this list is stale — the adapter says so by
 * returning `null` rather than widening the union at runtime.
 */
const ITEM_ROLE_IDS: ItemRoleId[] = [
  "armament-primary",
  "core-guard",
  "ward-array",
  "armament-secondary",
  "jewel-major",
  "manipulator",
  "mantle",
  "head-guard",
  "girdle",
  "sense",
  "footing",
  "infusion",
  "retinue",
  "jewel-minor-a",
  "jewel-minor-b",
  "standard"
];

export function asItemRoleId(role: string): ItemRoleId | null {
  return ITEM_ROLE_IDS.find((r) => r === role) ?? null;
}

/**
 * `ref_kind` names the WRITE PATH, not the shape of the thing worn, which is why it becomes a word
 * the surface can act on: `rolled` is an item instance this flow owns and may take off, anything
 * else is the relic flow's row and is read-only from here.
 */
function equipSource(refKind: string): "item" | "relic" {
  return refKind === "rolled" ? "item" : "relic";
}

/**
 * One assignment row. A row whose role this build does not know is dropped rather than rendered
 * under an invented name — the same rule `ListAssignments` applies on the server side.
 */
export function adaptEquipAssignments(dtos: ItemAssignmentDto[]): EquipAssignmentView[] {
  const views: EquipAssignmentView[] = [];
  for (const dto of dtos) {
    const role = asItemRoleId(dto.role);
    if (role === null) continue;
    views.push({ role, source: equipSource(dto.refKind), refId: dto.refId, assignedUtc: dto.assignedUtc });
  }
  return views;
}

/**
 * The equip executor's own reply, in view terms. Nothing is composed: `ok` and `reason` are the
 * server's, and `assignments` is the list it read back after the write.
 */
export function adaptEquipOutcome(dto: ItemEquipOutcomeDto): EquipOutcomeView {
  return {
    ok: dto.ok,
    verb: dto.verb === "unequip" ? "unequip" : "equip",
    reason: dto.reason,
    specimenId: dto.specimenId,
    role: asItemRoleId(dto.role),
    refId: dto.refId,
    replaced: dto.replaced ? (adaptEquipAssignments([dto.replaced])[0] ?? null) : null,
    assignments: adaptEquipAssignments(dto.assignments)
  };
}

// ===========================================================================
// party-dungeon D5.3 — delve adapters (spec-delve-stage.md §6). Real DTO shapes read directly off
// the shipped C# (`DelveEndpoints.cs`'s `HandleGetDelve`, D5.2; `DelveMemberState`; `PackDto`/
// `PackCellDto`; `QuestDto`; `DomainOfferDto`) — declared locally below, matching
// `CommanderListRowDto`'s own precedent, since no `src/lib/bus/delve.ts` exists yet (this is the
// first delve-shaped code anywhere in the web tree, spec-delve-stage.md §19 point 6).
//
// Two of the sixteen view types — `EventView`, `FightView` — have no adapter at all: no real,
// composed Core producer exists for either (see each type's own doc comment in `types.ts`), and
// building one here would mean deciding new business logic no Core function has decided, which is
// exactly what an adapter must never do (this file's own item-module-10 rule, line ~583: "adapters
// RENAME and RESHAPE... they compute nothing").
// ===========================================================================

type DelveRoomDto = {
  sectorId: string;
  rowIndex: number;
  colIndex: number;
  visited: boolean;
  cleared: boolean;
  keyForLaneId: string | null;
  /** `SectorSight` — raw ordinal (0 `None` / 1 `Glimpse` / 2 `Full`). `HandleGetDelve` never
   * `.ToString()`'s this before serialising (confirmed by reading `DelveProjection.cs`/
   * `DelveEndpoints.cs` in full — unlike `WorldEndpoints.cs:704`'s own `l.State.ToString()` for the
   * *different* field `LaneState` on a world lane, not a precedent this endpoint follows). */
  sight: number;
  kind: string | null;
  archetypeId: string | null;
  eventId: string | null;
  resolvedKind: string | null;
  resolvedArchetypeId: string | null;
  floorJson: string | null;
};

type DelveDoorDto = {
  laneId: string;
  fromSectorId: string;
  toSectorId: string;
  typeId: string;
  gateKeyId: string | null;
  /** `LaneState` — raw ordinal (0 `Open` / 1 `Severed`), same "never `.ToString()`'d here" fact as
   * `DelveRoomDto.sight` above. */
  state: number;
};

type DelvePartyPositionDto = { entityId: number; atSectorId: string | null; onLaneId: string | null };

type DelveHaulEntryDto = {
  kind: string;
  speciesId: string;
  rarity: string;
  variant: string;
  traitIds: string[];
  row: number;
  col: number;
  n: number;
};

type DelveMemberStateDto = {
  instanceId: string;
  /** `DelveMemberState.Pools` — keyed by the six resource ids, current values only. */
  pools: Record<string, number>;
  nerveStacks: number;
  downed: boolean;
  downedOnce: boolean;
};

/** `DelvePartyPackState` — the RAW, un-projected pack shape `HandleGetDelve` actually sends (its own
 * `cells` carry no `movable`/no size — see `adaptDelveParty`'s own doc comment for why this stays
 * unread rather than mistyped as `PackDto`). */
type DelvePartyPackStateDto = { rows: number; cols: number; cells: unknown[] };

type DelvePartyStateDto = {
  entityId: number;
  route: string[];
  haul: DelveHaulEntryDto[];
  members: DelveMemberStateDto[] | null;
  pack: DelvePartyPackStateDto | null;
};

/** `HandleGetDelve`'s own anonymous `Results.Ok(new {...})` object (`DelveEndpoints.cs:142-160`),
 * field for field — `questsJson`/`decisionsJson`/`contentTermsJson`/`thetaRun` are deliberately not
 * in this type at all: `adaptDelve` never reads them (see `DelveView`'s own doc comment for why). */
type DelveResponseDto = {
  delveId: number;
  worldId: string;
  state: string;
  domainId: string;
  raidMode: string;
  rungId: string;
  soulsUnbanked: number;
  rooms: DelveRoomDto[];
  doors: DelveDoorDto[];
  partyPositions: DelvePartyPositionDto[];
  revision: number;
  parties: DelvePartyStateDto[];
};

function toDelveSight(wire: number): DelveSightState {
  switch (wire) {
    case 1:
      return "Glimpse";
    case 2:
      return "Full";
    case 0:
    default:
      // Defensive only — the wire is a plain number at the type level. An unrecognised ordinal shows
      // less, never more, matching toIntelState's own "when in doubt, show less" rule for fog.
      return "None";
  }
}

function toDelveDoorState(wire: number): DelveDoorState {
  return wire === 1 ? "Severed" : "Open";
}

export function adaptDelveRoom(dto: DelveRoomDto): RoomView {
  return {
    sectorId: dto.sectorId,
    rowIndex: dto.rowIndex,
    colIndex: dto.colIndex,
    visited: dto.visited,
    cleared: dto.cleared,
    keyForLaneId: dto.keyForLaneId,
    sight: toDelveSight(dto.sight),
    kind: dto.kind,
    archetypeId: dto.archetypeId,
    eventId: dto.eventId,
    resolvedKind: dto.resolvedKind,
    resolvedArchetypeId: dto.resolvedArchetypeId,
    // `null` here is ambiguous on its own (sight-gated away vs. genuinely empty both serialise the
    // same way) — `absent()` is the honest reading of that ambiguity, never a claimed-but-unshown
    // `pending`; a real, non-null blob is real content with no view shape yet, which is `pending`.
    floorContents: dto.floorJson != null ? pendingWithReason(PLAYER_PENDING.delveRoomFloor) : absent()
  };
}

function toDoorView(dto: DelveDoorDto): DoorView {
  return {
    laneId: dto.laneId,
    fromSectorId: dto.fromSectorId,
    toSectorId: dto.toSectorId,
    typeId: dto.typeId,
    gateKeyId: dto.gateKeyId,
    state: toDelveDoorState(dto.state)
  };
}

export function adaptDelveMember(dto: DelveMemberStateDto): MemberView {
  const pools: Record<ResourceId, Magnitude> = {};
  for (const [id, value] of Object.entries(dto.pools)) {
    pools[id] = { unit: "count", value };
  }
  return {
    instanceId: dto.instanceId,
    pools,
    poolMax: pendingWithReason(PLAYER_PENDING.delvePoolMax),
    poolFill: pendingWithReason(PLAYER_PENDING.delvePoolFill),
    nerveStacks: dto.nerveStacks,
    nerveStage: pendingWithReason(PLAYER_PENDING.delveNerveStage),
    downed: dto.downed,
    downedOnce: dto.downedOnce,
    shield: pendingWithReason(PLAYER_PENDING.shieldStack),
    statuses: pendingWithReason(PLAYER_PENDING.delveStatuses)
  };
}

/**
 * Joins `DelvePartyState` with its live `DelveProjectionPartyPosition` by `entityId` — never by array
 * index, since `DelveProjection.cs`'s own `parties` list is sorted `.OrderBy(p => p.EntityId)` and so
 * does not share `delve.Parties`' own order. `partyIndex` is the caller's (`adaptDelve`'s) own array
 * position, passed in explicitly since no field on `DelvePartyState` carries it.
 */
export function adaptDelveParty(
  state: DelvePartyStateDto,
  partyIndex: number,
  position: DelvePartyPositionDto | undefined
): PartyView {
  return {
    partyIndex,
    entityId: state.entityId,
    atSectorId: position?.atSectorId ?? null,
    onLaneId: position?.onLaneId ?? null,
    route: state.route,
    members: (state.members ?? []).map(adaptDelveMember),
    // `state.pack` is real (the raw DelvePartyPackState) but is deliberately not read here — its
    // cells carry no `movable`/size, so mapping it into a `PackView` would fabricate those fields
    // rather than adapt real ones. `Pending` until a route wires `PackDtoProjection.Project` onto
    // this data (or a sibling one) the way `adaptPack` below already expects.
    pack: pendingWithReason(PLAYER_PENDING.delvePack),
    haul: state.haul.map((h) => ({
      kind: h.kind,
      speciesId: h.speciesId,
      rarity: h.rarity,
      variant: h.variant,
      traitIds: h.traitIds,
      row: h.row,
      col: h.col,
      n: h.n
    }))
  };
}

export function adaptDelve(dto: DelveResponseDto): DelveView {
  const positionByEntityId = new Map(dto.partyPositions.map((p) => [p.entityId, p]));
  return {
    delveId: dto.delveId,
    worldId: dto.worldId,
    state: dto.state,
    domainId: dto.domainId,
    raidMode: dto.raidMode,
    rungId: dto.rungId,
    soulsUnbanked: { unit: "count", value: dto.soulsUnbanked },
    rooms: dto.rooms.map(adaptDelveRoom),
    doors: dto.doors.map(toDoorView),
    parties: dto.parties.map((state, index) =>
      adaptDelveParty(state, index, positionByEntityId.get(state.entityId))
    ),
    revision: dto.revision,
    quests: pendingWithReason(PLAYER_PENDING.delveQuests)
  };
}

type PackCellDto = {
  row: number;
  col: number;
  w: number;
  h: number;
  kind: string;
  refId: string;
  qty: number;
  /** `PackItemOrigin.ToString()` (`PackDtoProjection.ToDto`) — PascalCase (`"CarryIn"` | `"Haul"`). */
  origin: string;
  movable: boolean;
};

type PackDto = {
  rows: number;
  cols: number;
  cells: PackCellDto[];
  floor: PackCellDto[];
  provisionCellsLeft: number;
};

function toPackItemOrigin(wire: string): PackItemOriginView {
  return wire === "Haul" ? "haul" : "carryIn";
}

function toPackCellView(dto: PackCellDto): PackCellView {
  return {
    row: dto.row,
    col: dto.col,
    w: dto.w,
    h: dto.h,
    kind: dto.kind,
    refId: dto.refId,
    qty: { unit: "count", value: dto.qty },
    origin: toPackItemOrigin(dto.origin),
    movable: dto.movable
  };
}

/**
 * `PackDto` (`PackGrid.cs`) — real and tested (`PackDtoTests.cs`) but `PackDtoProjection.Project` has
 * zero production callers and no HTTP route serves it yet (confirmed by grep across `src/`), the same
 * "provably correct, no live trigger" posture this program already carries elsewhere (D4.22's own six
 * delegates). Built and tested here against a hand-built fixture matching this real shape, ready for
 * the day a route wires the projection.
 */
export function adaptPack(dto: PackDto): PackView {
  return {
    rows: dto.rows,
    cols: dto.cols,
    cells: dto.cells.map(toPackCellView),
    floor: dto.floor.map(toPackCellView),
    provisionCellsLeft: { unit: "count", value: dto.provisionCellsLeft }
  };
}

/**
 * `WildVerb`'s own declared order (`TalkTree.cs:6-16`). No live endpoint has ever serialised this
 * enum, so its wire ordinal-vs-string convention is not settled by any real code — unlike
 * `SectorSight`/`LaneState`, directly observed on `HandleGetDelve`'s own live response. Treating it as
 * a raw ordinal mirrors the one thing both of those DO settle: no delve-domain enum anywhere in this
 * program has ever been given a `.ToString()` before reaching JSON. Named here because it is a real,
 * currently-unresolved judgement call about an as-yet-undecided wire shape, not a guess offered as fact.
 */
const WILD_VERBS = [
  "Flatter",
  "Threaten",
  "OfferSouls",
  "OfferSpirit",
  "OfferSupply",
  "OfferContract",
  "Fight",
  "Leave"
] as const;

/** `TalkTree.Offered(step, maxSteps, eligibility)` — the only real, shipped output on the wild-talk
 * surface; see `TalkView`'s own doc comment for why every other field stays `Pending`. */
export function adaptTalk(offeredOrdinals: number[]): TalkView {
  return {
    offered: offeredOrdinals.map((o) => WILD_VERBS[o] ?? "Leave"),
    effectiveBand: pendingWithReason(PLAYER_PENDING.delveTalkBand),
    quote: pendingWithReason(PLAYER_PENDING.delveTalkQuote),
    decision: pendingWithReason(PLAYER_PENDING.delveTalkDecision)
  };
}

type RoomObjectDto = { sectorId: string; kind: string; verbs: string[]; oneShot: boolean };

/** `RoomObjectBuilder.For(...)` — real output, offered verbs only; see `ObjectPromptView`'s own doc
 * comment for why no per-verb enabled/reason is built here. */
export function adaptRoomObject(dto: RoomObjectDto): ObjectPromptView {
  return { sectorId: dto.sectorId, kind: dto.kind, verbs: dto.verbs, oneShot: dto.oneShot };
}

type SupplyUseOutcomeDto = { ok: boolean; reason: string; decrementContainerId: string | null };

/** `SupplyUse.Use(...)`'s real outcome — see `SupplyView`'s own doc comment for the named ambiguity
 * between this (an act's outcome) and a not-yet-real "what can be used here" browse read. */
export function adaptSupply(dto: SupplyUseOutcomeDto): SupplyView {
  return {
    ok: dto.ok,
    reason: dto.reason,
    decrementContainerId: dto.decrementContainerId,
    decision: pendingWithReason(PLAYER_PENDING.delveSupplyDecision)
  };
}

type QuestDto = { name: string; flavor: string; have: number; need: number; done: boolean };

/** `QuestDto` (`QuestDtoProjection.Project`) — real, shipped, matches the spec's own cited source
 * exactly (`spec-delve-quests.md:341`). */
export function adaptDelveQuest(dto: QuestDto): QuestView {
  return {
    name: dto.name,
    flavor: dto.flavor,
    have: { unit: "count", value: dto.have },
    need: { unit: "count", value: dto.need },
    done: dto.done
  };
}

type MemberSettlementDto = { outcome: string; recoverDelves: number; won: boolean };
type ExtractionEarnDto = { kills: number; victory: number };

/**
 * Composes two independently-real, already-fully-decided Core outputs — `ExtractionSettlement.Decide`
 * (per member) and `DelveSoulLedger.AtExtraction` (per raid) — reshaping only; see `ExtractionView`'s
 * own doc comment for the fields with no producer at all. `MemberSettlement` itself carries no member
 * id, so the caller supplies one per settlement, the same positional-join shape `adaptDelveParty`
 * needs `partyIndex` for.
 */
export function adaptExtraction(
  settlements: { instanceId: string; settlement: MemberSettlementDto }[],
  earn: ExtractionEarnDto
): ExtractionView {
  return {
    members: settlements.map((s) => ({
      instanceId: s.instanceId,
      outcome: s.settlement.outcome,
      recoverDelves: { unit: "count", value: s.settlement.recoverDelves },
      won: s.settlement.won
    })),
    // Kills and victory stay two figures, never pre-summed here — summing would be arithmetic on a
    // figure in the client, §16's own "never" list.
    soulsFromKills: { unit: "count", value: earn.kills },
    soulsFromVictory: { unit: "count", value: earn.victory },
    wiped: pendingWithReason(PLAYER_PENDING.delveWiped),
    firstClearGrant: pendingWithReason(PLAYER_PENDING.delveFirstClearGrant),
    levelUps: pendingWithReason(PLAYER_PENDING.delveLevelUps),
    joins: pendingWithReason(PLAYER_PENDING.delveJoins)
  };
}

type DomainRungOfferDto = {
  rungId: string;
  label: string;
  bandName: string;
  oathOffered: boolean;
  permadeath: boolean;
};
type DomainTailOfferDto = { n: number; label: string; bandName: string };
type ProvisionableOfferDto = { containerId: string; label: string; price: number; cells: number };

type DomainOfferDto = {
  domainId: string;
  name: string;
  flavor: string;
  climate: string;
  entranceLabel: string;
  entryKey: string;
  sealed: boolean;
  resume: { delveId: number } | null;
  rungs: DomainRungOfferDto[];
  tailSteps: DomainTailOfferDto[];
  raidModes: string[];
  bossName: string;
  cleared: string[];
  provisionable: ProvisionableOfferDto[];
};

function toRungOfferView(dto: DomainRungOfferDto): RungOfferView {
  return {
    kind: "rung",
    rungId: dto.rungId,
    label: dto.label,
    bandName: dto.bandName,
    oathOffered: dto.oathOffered,
    permadeath: dto.permadeath
  };
}

function toTailOfferView(dto: DomainTailOfferDto): RungOfferView {
  return { kind: "tail", n: { unit: "count", value: dto.n }, label: dto.label, bandName: dto.bandName };
}

/** §8's own two vocabulary ids. An unrecognised wire value falls back to `"standing"` — the more
 * permissive reading — rather than silently miscasting an unknown value as the stricter, locking one. */
function toDomainEntryKey(wire: string): "single-descent" | "standing" {
  return wire === "single-descent" ? "single-descent" : "standing";
}

/** `DomainOfferDto` (`DomainOffers.cs`) — real, shipped, matches the spec's own cited source
 * exactly (`spec-domain-catalog.md:380`). `provisionable` is a real field on the wire type but always
 * empty in production today (`ProvisionableFor` throws unconditionally, unreachable while
 * `dungeon_domain` has no write arm) — mapped as a plain array, not `Pending`: an empty array is the
 * honest, valid current state of a real field, not a missing one. */
export function adaptDomainOffer(dto: DomainOfferDto): DomainOfferView {
  return {
    domainId: dto.domainId,
    name: dto.name,
    flavor: dto.flavor,
    climate: dto.climate,
    entranceLabel: dto.entranceLabel,
    entryKey: toDomainEntryKey(dto.entryKey),
    sealed: dto.sealed,
    resume: dto.resume ? { delveId: dto.resume.delveId } : null,
    rungs: dto.rungs.map(toRungOfferView),
    tailSteps: dto.tailSteps.map(toTailOfferView),
    raidModes: dto.raidModes,
    bossName: dto.bossName,
    cleared: dto.cleared,
    provisionable: dto.provisionable.map((p) => ({
      containerId: p.containerId,
      label: p.label,
      price: { unit: "count", value: p.price },
      cells: { unit: "count", value: p.cells }
    }))
  };
}

// ===========================================================================
// empire-inventory-surfaces `claim-endpoints` (plan Task 4A.3) — cargo / vault / pin folds.
//
// ⛔ These folds RENAME and RESHAPE. They compute nothing the server has not already decided,
// except the two meter fractions (used ÷ capacity from the four numbers the DTO carries) and
// the reason→copy-key mapping below. No capacity is recomputed, no position compared, no id
// prettified (ideal §2.7) — and a reason outside the closed §Design 5 list maps to `null`
// rather than an invented key.
// ===========================================================================

/** The closed two-kind split, total like `toCombinationState`'s own closed mappings above. */
function toCargoRowKind(wire: string): CargoRowKind {
  return wire === "stack" ? "stack" : "instance";
}

/** A meter fraction from the DTO's own used/capacity pair — `null` when the denominator is not
 * positive, never a divide-by-zero, never a recomputed capacity. */
function meterFraction(used: number, capacity: number): number | null {
  return capacity > 0 ? used / capacity : null;
}

/**
 * One legion's cargo — rows straight off the wire (snapshot weights, never re-derived), the two
 * fractions folded here. `weightCapacity`/`slotCapacity` are the server's live numbers, copied,
 * never recomputed.
 */
export function adaptLegionCargo(dto: LegionCargoDto): CargoView {
  return {
    worldId: dto.worldId,
    entityId: dto.entityId,
    asOfTurn: dto.asOfTurn,
    rows: dto.rows.map((r) => ({
      seq: r.seq,
      kind: toCargoRowKind(r.kind),
      instanceId: r.instanceId,
      containerId: r.containerId,
      qty: r.qty,
      weightEach: { unit: "count", value: r.weightEach },
      rowWeight: { unit: "count", value: r.rowWeight }
    })),
    weightUsed: { unit: "count", value: dto.weightUsed },
    weightCapacity: { unit: "count", value: dto.weightCapacity },
    weightFraction: meterFraction(dto.weightUsed, dto.weightCapacity),
    slotsUsed: { unit: "count", value: dto.slotsUsed },
    slotCapacity: { unit: "count", value: dto.slotCapacity },
    slotFraction: meterFraction(dto.slotsUsed, dto.slotCapacity)
  };
}

/**
 * One sector's vault — rows straight off the wire, `room` as `capacity − used` (floored at zero
 * for the dial: the server is the source of truth, this is a display floor, never a clamp of
 * game state). `ownerFactionId` passes through untouched — the capture-header input.
 */
export function adaptSectorStorage(dto: SectorStorageDto): VaultView {
  return {
    worldId: dto.worldId,
    sectorId: dto.sectorId,
    ownerFactionId: dto.ownerFactionId,
    asOfTurn: dto.asOfTurn,
    rows: dto.rows.map((r) => ({
      seq: r.seq,
      kind: toCargoRowKind(r.kind),
      instanceId: r.instanceId,
      containerId: r.containerId,
      qty: r.qty
    })),
    slotsUsed: { unit: "count", value: dto.slotsUsed },
    slotCapacity: { unit: "count", value: dto.slotCapacity },
    slotFraction: meterFraction(dto.slotsUsed, dto.slotCapacity),
    room: { unit: "count", value: Math.max(0, dto.slotCapacity - dto.slotsUsed) }
  };
}

/**
 * The presence-gated listing — pins carry presence + count only. No legion position rides this
 * view, so no client-side fog logic can be built on it even by accident (§Design 2). A cache of
 * a kind outside the closed two is dropped rather than rendered under an invented place — the
 * same rule `adaptEquipAssignments` applies to an unknown role.
 */
export function adaptClaimableCaches(dto: ClaimableCacheListDto): CachePinListView {
  return {
    worldId: dto.worldId,
    entityId: dto.entityId,
    asOfTurn: dto.asOfTurn,
    claimCostMilli: dto.claimCostMilli,
    pins: dto.caches
      .filter((c) => c.placeKind === "world_sector" || c.placeKind === "world_lane")
      .map((c) => ({
        cacheId: c.cacheId,
        placeKind: c.placeKind as "world_sector" | "world_lane",
        placeRef: c.placeRef,
        sourceKind: c.sourceKind,
        itemCount: { unit: "count", value: c.itemCount },
        createdUtc: c.createdUtc
      }))
  };
}

/**
 * The closed §Design 5 vocabulary as copy keys (GG-62 — wave 2 authors the sentences against
 * these keys, never against a new string invented here). `cache.claimed:<c>+<s>` details match
 * by prefix (the suffix is the per-row count, data, not vocabulary); everything else matches
 * exactly; anything outside the list is `null` — the fold never invents copy.
 * `correlation.missing` maps (named in the contract, never produced by the filer) so no caller
 * authors copy for it by accident.
 */
export function claimReasonKey(reason: string): ClaimCopyKey | null {
  if (reason === "ok") return "ok";
  if (reason === "cache.unreachable") return "cache.unreachable";
  if (reason === "cargo.over-weight") return "cargo.over-weight";
  if (reason === "cargo.no-slots") return "cargo.no-slots";
  if (reason === "cargo.not-present") return "cargo.not-present";
  if (reason === "cargo.wrong-faction") return "cargo.wrong-faction";
  if (reason === "cargo.sector-full") return "cargo.sector-full";
  if (reason === "cargo.not-found") return "cargo.not-found";
  if (reason === "cargo.cross-empire") return "cargo.cross-empire";
  if (reason === "cargo.not-owned") return "cargo.not-owned";
  if (reason === "correlation.missing") return "correlation.missing";
  if (reason.startsWith("cache.claimed:")) return "cache.claimed";
  return null;
}

// ===========================================================================
// empire-inventory-surfaces `legion-sheet` (plan Task 4D.1,
// spec-legion-sheet.md §§Design 5–7) — the cargo-fold.
//
// Pure functions over 4A.3's read-backs. Fractions come from
// `adaptLegionCargo` (the DTO's four numbers); nothing here recomputes
// capacity, compares positions, predicts fit, prettifies an id, or invents
// a reason string. `Seq` order is the verbs' deterministic tie-break.
// ===========================================================================

/**
 * Which gate is tighter (spec §Design 3 gate-flag). Larger fraction wins;
 * `null` (capacity not positive) always loses to a known fraction; both
 * null → `none`. An exact tie resolves to `slots` — arbitrary but stable
 * (slots is the DTO's second pair, listed first in the fold output).
 */
export function legionCargoGate(
  weightFraction: number | null,
  slotFraction: number | null
): LegionCargoGate {
  if (weightFraction == null && slotFraction == null) return "none";
  const w = weightFraction ?? -1;
  const s = slotFraction ?? -1;
  if (s >= w) return "slots";
  return "weight";
}

/** A meter gate back to its refusal copy key (spec §Design 7). */
export function legionSheetGateCopyKey(
  gate: LegionCargoGate
): Extract<LegionSheetCopyKey, "cargo.full.weight" | "cargo.full.slots"> | null {
  if (gate === "weight") return "cargo.full.weight";
  if (gate === "slots") return "cargo.full.slots";
  return null;
}

/**
 * The closed §Design 7 vocabulary as sheet copy keys (GG-62). Success
 * details match by prefix (the `:seq` / `:<c>+<s>` suffix is data, not
 * vocabulary); `cache.claimed:<c>+<s>` splits into `all` (nothing skipped)
 * vs `partial` (anything left behind); everything else matches exactly;
 * anything outside the list is `null` — the fold never invents copy.
 *
 * `correlation.missing` maps to `null` (named in the spec, never produced
 * on the command path — listed so no caller authors copy for it).
 * `entity.spent` maps to the reserved `act.spent` key (owned by
 * `world-action-economy`; no finalized sentence here).
 * Admission-time shapes the recipe never files (`cache.missing`,
 * `sector.missing`, `cargo.kind-unknown`, `cargo.ref-missing`,
 * `cargo.seq-missing`, `cargo.target-missing`, `command.id-missing`,
 * `kind.unknown`, plus the same authoring-time family the admission arm
 * actually emits: `sector.unknown`, `command.id-too-long`,
 * `cargo.weight-unknown`) map to `order.malformed` — dev-tooling only,
 * never player prose. Bare `ok` maps to `null`: the filer's `ok` answers
 * filing, never resolution (GG-15).
 */
export function legionSheetReasonKey(reason: string): LegionSheetCopyKey | null {
  if (reason.startsWith("cargo.loaded:")) return "cargo.done.load";
  if (reason.startsWith("cargo.unloaded:")) return "cargo.done.unload";
  if (reason.startsWith("cargo.transferred:")) return "cargo.done.hand";
  if (reason.startsWith("cargo.deposited:")) return "cargo.done.deposit";
  if (reason.startsWith("cargo.withdrawn:")) return "cargo.done.withdraw";
  if (reason.startsWith("cache.claimed:")) {
    const tail = reason.slice("cache.claimed:".length);
    const parts = tail.split("+");
    const skipped = parts.length === 2 ? Number(parts[1]) : Number.NaN;
    if (Number.isFinite(skipped)) return skipped === 0 ? "cache.claimed.all" : "cache.claimed.partial";
    return "cache.claimed.partial";
  }
  switch (reason) {
    case "cargo.over-weight":
      return "cargo.full.weight";
    case "cargo.no-slots":
      return "cargo.full.slots";
    case "cargo.not-owned":
      return "cargo.not-yours";
    case "cargo.not-found":
      return "cargo.gone";
    case "cargo.not-present":
      return "cargo.not-here";
    case "cargo.wrong-faction":
      return "vault.held-by-other";
    case "cargo.sector-full":
      return "vault.full";
    case "cargo.cross-empire":
      return "cargo.other-empire";
    case "cache.unreachable":
      return "cache.gone";
    case "entity.not-yours":
      return "band.not-yours";
    case "entity.unknown":
      return "band.unknown";
    case "entity.missing":
      return "band.missing";
    case "entity.gone":
      return "band.gone";
    case "entity.routed":
      return "band.routed";
    case "entity.spent":
      return "act.spent";
    case "cache.missing":
    case "sector.missing":
    case "sector.unknown":
    case "cargo.kind-unknown":
    case "cargo.ref-missing":
    case "cargo.seq-missing":
    case "cargo.target-missing":
    case "cargo.weight-unknown":
    case "command.id-missing":
    case "command.id-too-long":
    case "kind.unknown":
      return "order.malformed";
    default:
      return null;
  }
}

/**
 * One legion's cargo folded for the sheet (spec §Design 5). Inputs are the
 * 4A.3 DTO plus identity passthrough — never tuning, never positions.
 * Rows arrive in `seq` order (sorted here defensively; the verbs already
 * emit them ordered). Aboard rows are `carried`; claim/left-behind and
 * refused states are applied by the tab from report entries via
 * `legionSheetReasonKey` — this fold never guesses them from contents.
 */
export function foldLegionCargoSheet(
  dto: LegionCargoDto,
  identity?: { ownerFactionId?: string | null }
): LegionCargoFold {
  const view = adaptLegionCargo(dto);
  const gateFlag = legionCargoGate(view.weightFraction, view.slotFraction);
  const rows: FoldedStockRow[] = [...view.rows]
    .sort((a, b) => a.seq - b.seq)
    .map((r) => ({
      seq: r.seq,
      kind: r.kind,
      instanceId: r.instanceId,
      containerId: r.containerId,
      qty: r.qty,
      weight: r.rowWeight,
      nameFallback: `#${r.seq}`,
      state: "carried" as const,
      copyKey: null
    }));
  return {
    worldId: view.worldId,
    entityId: view.entityId,
    asOfTurn: view.asOfTurn,
    slots: { used: view.slotsUsed, capacity: view.slotCapacity, fraction: view.slotFraction },
    weight: {
      used: view.weightUsed,
      capacity: view.weightCapacity,
      fraction: view.weightFraction,
      usedExact: String(view.weightUsed.value),
      capacityExact: String(view.weightCapacity.value)
    },
    gateFlag,
    rows,
    headerInputs: { ownerFactionId: identity?.ownerFactionId ?? null }
  };
}

/**
 * The bus event behind a tab action, kept beside the fold so the
 * no-`weightEach` schema rule (spec §Testing strategy, claim-endpoints rule
 * applied to the bus) is asserted in one place. Carries the six kinds for
 * `storage-cache-ui` reuse; this tab binds only the first three.
 */
export function legionCargoBusKind(action: LegionCargoBusAction): string {
  switch (action.type) {
    case "cargo.load":
      return "load-cargo";
    case "cargo.unload":
      return "unload-cargo";
    case "cargo.hand-to-band":
      return "transfer-cargo";
    case "cargo.deposit":
      return "deposit-cargo";
    case "cargo.withdraw":
      return "withdraw-cargo";
    case "cache.pick-up":
      return "claim-cache";
  }
}

// ===========================================================================
// empire-inventory-surfaces `storage-cache-ui` (plan Task 4D.2b,
// spec-storage-cache-ui.md §§Design 2–4) — the cache-claim fold.
//
// Pure functions over 4A.1's verb strings (`RpgStore.CargoCommands.cs`
// `ClaimDetail` / reachability refusal, byte-exact) and 4A.5's AP number
// (passed in, never authored here). Nothing here recomputes capacity,
// compares positions, predicts fit, prettifies an id, invents a reason
// string, or carries a `visible` member — absence from the response is
// absence from the map (hidden-until-found), and the pin view carries no
// position to compare even by accident.
// ===========================================================================

const CLAIMED_PREFIX = "cache.claimed:";
const UNREACHABLE = "cache.unreachable";

/**
 * Parse a committed `cache.claimed:<c>+<s>` detail into its two counts.
 * Matches the verb's own `ClaimDetail` (`$"cache.claimed:{Claimed}+{Skipped}"`)
 * byte-for-byte: exact prefix, two non-negative integers, nothing else.
 * Returns `null` for anything else (including `cache.unreachable` — a stale
 * pin is a verdict, not a count).
 */
export function parseClaimedCounts(detail: string): { claimed: number; skipped: number } | null {
  if (!detail.startsWith(CLAIMED_PREFIX)) return null;
  const tail = detail.slice(CLAIMED_PREFIX.length);
  const parts = tail.split("+");
  if (parts.length !== 2) return null;
  const claimed = Number(parts[0]);
  const skipped = Number(parts[1]);
  if (!Number.isInteger(claimed) || !Number.isInteger(skipped)) return null;
  if (claimed < 0 || skipped < 0) return null;
  return { claimed, skipped };
}

/**
 * Fold one claim's last feed detail into aboard / left-behind counts.
 * `detail` is the latest turn-report entry detail for this claim, or `null`
 * when no resolution is on the feed yet (filed-but-uncommitted — GG-15:
 * the filer's `ok` answers filing, never resolution).
 */
export function foldCacheClaim(
  entityId: string,
  cacheId: string,
  detail: string | null
): CacheClaimFold {
  if (detail == null || detail.length === 0) {
    return { entityId, cacheId, claimed: 0, skipped: 0, verdict: "unreadable", copyKey: null };
  }
  if (detail === UNREACHABLE) {
    return { entityId, cacheId, claimed: 0, skipped: 0, verdict: "stale-pin", copyKey: "cache.gone" };
  }
  const counts = parseClaimedCounts(detail);
  if (counts == null) {
    return { entityId, cacheId, claimed: 0, skipped: 0, verdict: "unreadable", copyKey: null };
  }
  if (counts.skipped === 0) {
    return {
      entityId,
      cacheId,
      claimed: counts.claimed,
      skipped: 0,
      verdict: "all-aboard",
      copyKey: "cache.claimed.all"
    };
  }
  return {
    entityId,
    cacheId,
    claimed: counts.claimed,
    skipped: counts.skipped,
    verdict: "partial",
    copyKey: "cache.claimed.partial"
  };
}

/**
 * Fill the pick-up button's AP display slot from the passed number.
 * The number is world-action-economy's (`claimCostMilli`, carried on the
 * listing response from tuning) — this function formats it, never chooses it.
 * Callers pass the server-sent value (`CachePinListView.claimCostMilli`).
 */
export function claimApSlot(costMilli: number): CacheClaimApSlot {
  return { costMilli, label: `pick up (${costMilli} AP)` };
}
