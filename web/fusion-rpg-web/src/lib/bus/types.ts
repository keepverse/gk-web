export type StatMod = {
  hpPercent: number;
  hpFlat: number;
  attackPercent: number;
  attackFlat: number;
  defensePercent: number;
  defenseFlat: number;
};

export type StatsConfig = {
  plants: StatMod;
  zombies: StatMod;
  logDamage: boolean;
  applyStats: boolean;
};

export type HealthDto = {
  ok: boolean;
  injectorConnected: boolean;
  lastHeartbeatUtc: string | null;
  simEnabled?: boolean;
  source?: string;
  currentPlayerId?: number;
  ingestQueued?: number;
  lastFlushMs?: number;
};

export type PlayerDto = {
  id: number;
  name: string;
  createdUtc: string;
  /** "The whole save"'s own root (spec-world-seed.md, T5.1) — display only. The server's C# `long`
   * can exceed Number.MAX_SAFE_INTEGER, so this may round; nothing client-side derives a roll from
   * it — every real derivation (`WorldSeed.DeriveRollSeed`) stays server-side, exact. */
  worldSeed: number;
};

export type PlayersListDto = {
  items: PlayerDto[];
  currentPlayerId: number;
};

export type SimEntity = {
  side: string;
  ptr: string;
  type: number;
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  armorMax: number;
  col: number;
  row: number;
};

export type SimMower = {
  ptr: string;
  type: number;
  typeName: string;
  row: number;
  started: boolean;
  dead: boolean;
};

export type SimState = {
  levelName?: string | null;
  matchKey?: string | null;
  wave?: number;
  maxWave?: number;
  nextPlant: number;
  nextZombie: number;
  plants: SimEntity[];
  zombies: SimEntity[];
  mowers?: SimMower[];
  applied: string[];
};

export type TypeItem = {
  game?: string;
  side: string;
  type: number;
  typeName?: string | null;
  displayName?: string | null;
  sampleJson?: string | null;
  hpBase?: number | null;
  maxHpBase?: number | null;
  attackBase?: number | null;
  armorBase?: number | null;
  armorMaxBase?: number | null;
  seenCount: number;
  killedCount: number;
  firstSeenUtc?: string | null;
  lastSeenUtc?: string | null;
};

export type RecipeItem = {
  parentA: number;
  parentAName?: string | null;
  parentB: number;
  parentBName?: string | null;
  result: number;
  resultName?: string | null;
};

export type SpawnStatItem = {
  id: number;
  runId: number;
  ptr: string;
  side: string;
  type: number;
  source: string;
  capturedUtc: string;
  stats?: unknown;
};

export type EventEnvelope = {
  id?: number;
  t: string;
  game: string;
  kind: string;
  matchKey?: string | null;
  playerId?: number | null;
  runId?: number | null;
  payload?: unknown;
};

export type MetricItem = { name: string; value: number; ts: string };

export type RunItem = {
  id: number;
  playerId?: number;
  matchKey?: string | null;
  startedUtc: string;
  endedUtc?: string | null;
  levelName?: string | null;
  result?: string | null;
  mowersUsed?: number;
  plantsPlanted?: number;
  plantsDied?: number;
  zombiesKilled?: number;
  summary?: unknown;
  levelType?: string | null;
  boardLevel?: number | null;
  modifiers?: unknown;
  archiveUri?: string | null;
};

export type HubStatus = "off" | "on" | "err";

export type CheatEntry = {
  id: string;
  kind: string;
  enabled: boolean;
  /** Absent when unset — do not invent 0. */
  floatValue?: number;
  isSet?: boolean;
};

export type CheatCatalogItem = {
  type: number;
  typeName?: string;
  displayName?: string;
  spawnOk?: boolean | null;
};

export type CheatSnapshot = {
  menuEnabled?: boolean;
  revision?: number;
  updatedAt?: string;
  persist?: boolean;
  emitProof?: boolean;
  localOverride?: boolean;
  selectedPtr?: string;
  selectedSide?: string;
  spawnCol?: number;
  spawnRow?: number;
  catalogPlants?: number;
  catalogZombies?: number;
  note?: string;
  activeProbeId?: string;
  activePackId?: string;
  entries?: CheatEntry[];
  mods?: { id: string; channel?: string; op?: string; value?: number; enabled?: boolean }[];
  catalog?: {
    plants?: CheatCatalogItem[];
    zombies?: CheatCatalogItem[];
  };
};

export type CheatSchemaField = {
  id: string;
  role: string;
  kind: string;
  channel: string;
  op: string;
  displayDefault: number;
  toggleDefault: boolean;
  groupPrefix: string;
};

export type CheatSchemaDto = {
  fields: CheatSchemaField[];
};

export type PvzStatContribution = {
  channel: string;
  pluginId: string;
  sourceKind: string;
  sourceId: string;
  op: string;
  value: number;
  priority: number;
  detailJson?: string | null;
};

export type PvzStatsChannelSummary = {
  channel: string;
  final: number;
  sourceCount: number;
};

export type PvzStatsSheet = {
  playerId: number;
  revision: number;
  updatedAt?: string;
  channels: PvzStatsChannelSummary[];
};

export type PvzStatsChannelDetail = {
  playerId: number;
  revision: number;
  channel: string;
  final: number;
  contributions: PvzStatContribution[];
};

export type PvzActivityRollup = {
  playerId: number;
  revision: number;
  updatedAt?: string;
  matchesStarted: number;
  matchesEnded: number;
  victories: number;
  defeats: number;
  zombiesKilled: number;
  plantsLost: number;
  plantsPlaced: number;
  extraSpawnsFired: number;
};

export type PvzActivityFact = {
  id: number;
  playerId: number;
  runId?: number | null;
  t: string;
  kind: string;
  pluginId: string;
  sourceKind: string;
  sourceId: string;
  payloadJson?: string | null;
  matchKey?: string | null;
  dedupeKey?: string | null;
};

export type PvzActivityFactsPage = {
  playerId: number;
  revision: number;
  items: PvzActivityFact[];
};

export type RpgActorProgression = {
  playerId: number;
  kind: string;
  typeId: number;
  typeName?: string | null;
  displayName?: string | null;
  /** Promoted PlantInfo/ZombieInfo.info */
  almanacInfo?: string | null;
  /** Promoted ZombieInfo.introduce */
  almanacIntroduce?: string | null;
  /** Promoted PlantInfo.cost */
  almanacCost?: string | null;
  level: number;
  xp: number;
  xpToNext: number;
  highestLevel: number;
  demotionCount: number;
  revision: number;
  updatedAt: string;
  curveFirst: number;
  curveStep: number;
};

export type RpgProgressionSummary = {
  playerId: number;
  player: RpgActorProgression | null;
  plantActorCount: number;
  zombieActorCount: number;
  highestPlantLevel: number;
  highestZombieLevel: number;
  topPlants: RpgActorProgression[];
  topZombies: RpgActorProgression[];
};

export type RpgProgressionList = {
  playerId: number;
  items: RpgActorProgression[];
  total: number;
  limit: number;
  offset: number;
};

export type RpgXpLedgerEntry = {
  id: number;
  playerId: number;
  kind: string;
  typeId: number;
  typeName?: string | null;
  runId: number;
  t: string;
  delta: number;
  reason: string;
  activityFactId?: number | null;
  levelBefore: number;
  xpBefore: number;
  levelAfter: number;
  xpAfter: number;
  demotionBefore: number;
  demotionAfter: number;
  payloadJson?: string | null;
};

export type RpgXpLedgerPage = {
  playerId: number;
  items: RpgXpLedgerEntry[];
  limit: number;
  nextAfterId?: number | null;
};

export type RpgProgressionStats = {
  playerId: number;
  xpByReason: { reason: string; sumDelta: number; count: number }[];
  plantLevels: { level: number; count: number }[];
  zombieLevels: { level: number; count: number }[];
  recentDeltas: { t: string; delta: number; reason: string }[];
};

export type ProbePackDto = {
  id: string;
  label: string;
  hint: string;
  expectedKinds: string[];
  steps?: unknown[];
};

export type ProbeRunResult = {
  probeId: string;
  packId: string;
  label?: string;
  hint?: string;
  expectedKinds: string[];
  steps?: number;
};

export type StorageSummary = {
  archiveCount: number;
  closedRunsStillHot: number;
  openRuns: number;
  activityOverTail: boolean;
  xpOverTail: boolean;
};

export type StorageArchiveItem = {
  uri: string;
  kind: string;
  runId?: number | null;
  createdUtc: string;
};

export type StoragePurgeResult = {
  deleted: number;
  refused: number;
};

/** Cold UniqueActor specimen (W4+; lawn inspector observe W7-B). */
export type UniqueActorDto = {
  instanceId: string;
  playerId: number;
  side: string;
  typeId: number;
  phase: string;
  level: number;
  xp: number;
  matchKey?: string | null;
  lastPtr?: string | null;
  deployCorrelationId?: string | null;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
};

export type UniqueActorListDto = {
  playerId: number;
  items: UniqueActorDto[];
};

export type UniqueActorDeployResultDto = {
  ok: boolean;
  reason: string;
  queued: boolean;
  correlationId: string;
  actor?: UniqueActorDto | null;
};

export type UniqueEquipmentSlotDto = {
  slot: string;
  itemId: string;
};

export type UniqueEquipmentListDto = {
  instanceId: string;
  phase: string;
  items: UniqueEquipmentSlotDto[];
  modsJson: string;
};

export type RelicDto = {
  id: string;
  name: string;
  rarity: number;
  slot: string;
  description: string;
  effectId: string;
};

export type RelicCatalogListDto = {
  items: RelicDto[];
};

export const emptyMod = (): StatMod => ({
  hpPercent: 1,
  hpFlat: 0,
  attackPercent: 1,
  attackFlat: 0,
  defensePercent: 1,
  defenseFlat: 0
});

/** spec-specimen-respec-price.md EP1.9 — the fields `POST /api/aptitudes/allocate` and
 * `/unique/allocate` add onto their own GET shape's response (never present on a GET). A take-back
 * charges `priceAmount` souls (`priced: true`); an addition is always free (`priced: false`). */
export type AptitudeReallocationFields = {
  priced?: boolean;
  priceAmount?: number;
  respecCount?: number;
  soulBalance?: number | null;
};

/** spec-aptitude-allocation-surface.md — GET/POST /api/aptitudes. Commander Mode C; `shares` always
 * carries all twelve aptitude ids (zero if unset, never omitted). Nested `species` is additive (S10). */
export type AptitudesState = AptitudeReallocationFields & {
  theta: number;
  budget: number;
  spent: number;
  withinBudget: boolean;
  shares: Record<string, number>;
  species?: Record<string, Record<string, number>>;
};

/** aptitude-sheet unique-allocate — GET/POST UniqueCreature by instanceId (Mode A). Persisted shares only. */
export type UniqueAptitudesState = AptitudeReallocationFields & {
  instanceId: string;
  playerId: number;
  specimenLevel: number;
  budget: number;
  spent: number;
  leftover: number;
  withinBudget: boolean;
  shares: Record<string, number>;
  /** unique-theta-wire (T17): the ladder index the specimen's sheet Hub composes with (the owner's); null when the
   * owner has no player row. Never the specimen level. */
  theta?: number | null;
  /** spec-default-build.md EP1.17 — `true` when `shares` is the assign ladder's own suggestion
   * (no explicit allocation exists yet), never re-derived on the FE: the server is the one place
   * `IsDefault`/`DefaultRuleId` are computed. */
  isDefault: boolean;
  /** The winning ladder rung when `isDefault` is true (e.g. `"even"`, `"species-favour"`); `null`
   * once an explicit allocation exists. A closed vocabulary (`AptitudeAutoAssignRules`) — the sheet
   * reads its display copy from the catalog, never an FE string union. */
  defaultRuleId: string | null;
};

/** spec-specimen-respec-price.md EP1.9 — POST /api/aptitudes/respec-quote. A read-only preview of
 * whether the PROPOSED `shares` is a respec and what it would then cost, so the sheet can show the
 * price before Confirm. Never persists, never spends. The FE never decides `isRespec` itself or
 * computes `soulPrice` — both are read from this response only. */
export type AptitudeRespecQuote = {
  isRespec: boolean;
  soulPrice: number;
  respecCount: number;
};

/** spec-allocation-surface.md — GET /api/aptitudes/species/{playerId}/{speciesId}. `shares` is the
 * EFFECTIVE (baseline-or-override) allocation; `baseline` is the shipped plan's own vector, always,
 * so an override renders as a deviation from it rather than as a standalone build. */
export type SpeciesAptitudesState = {
  speciesId: string;
  level: number;
  budget: number;
  spent: number;
  withinBudget: boolean;
  hasOverride: boolean;
  shares: Record<string, number>;
  baseline: Record<string, number>;
};

/** spec-species-respec.md — GET /api/species-build/respec-price/{playerId}/{speciesId}. A read-only
 * preview of what the NEXT change would cost, so the price can be shown before the confirm.
 * `everRespecced` (NOT `respecCount === 0`) is the correct free-vs-priced predictor: `respecCount`
 * decays back to zero over time even for a species touched long ago. */
export type SpeciesRespecPrice = {
  speciesId: string;
  respecCount: number;
  priceResource: string;
  priceAmount: number;
  everRespecced: boolean;
  /** respec-free-counter EP4.10/EP4.12 — the empire's earned free respecs, and whether this change may be
   * paid with one instead of souls. The player chooses; the FE never picks for them. */
  freeRespecStock: number;
  freeAvailable: boolean;
};

/** spec-species-respec.md — POST /api/species-build/respec. The one save path for a species' build:
 * a first override and a revert-to-baseline are both free (`priced: false`); any other change is
 * priced and its `priceAmount` reflects what was actually charged. */
export type SpeciesRespecResult = {
  speciesId: string;
  level: number;
  priced: boolean;
  priceAmount: number;
  respecCount: number;
  soulBalance: number;
  replay: boolean;
  /** What the respec ACTUALLY paid (`souls`, `freeRespec`, or empty when nothing was charged). */
  paidWith: string;
  freeRespecStock: number;
  shares: Record<string, number>;
};

/** passive-tree-todo.md I2/I3, spec-tree-surface.md §10/§12 — the wire twin of
 * `FusionRpg.Contracts.ExcludedNodeDto` (D14/D40's printed exclusion: a nullified trait is never
 * un-unlocked, it renders inert and names the winner). Named without the `Dto` suffix here on
 * purpose (`AptitudesState`'s own precedent) — `contractGuard.test.ts` forbids `stages/`, `layers/`
 * and `ui/` from binding to a `*Dto`-suffixed wire type; only `contract/` may. */
export type ExcludedNode = {
  nodeId: string;
  form: string;
  winnerNodeId: string;
  isInert: boolean;
};

/** I6 (spec-tree-surface.md §2.3/§9) — the wire twin of `FusionRpg.Contracts.TreeNodeSummaryDto`:
 * the catalog's own STRUCTURAL (branch, tier) slot for one node, never its authored copy.
 *
 * `name`/`flavor` (seedsmith-content-standard, content-completeness-passive-tree, 2026-09-08): the
 * real player-facing content `tree-language` generates per node once it reaches that node — optional
 * because most nodes in the corpus still have neither yet (`tree-language` has only reached 12 of 42
 * trees so far). A node with neither field renders its existing id-based fallback, never a fabricated
 * placeholder. */
export type TreeNodeSummary = {
  nodeId: string;
  branch: string;
  tier: number;
  nodeClass: string;
  name?: string;
  flavor?: string;
};

/** The wire twin of `FusionRpg.Contracts.TreeResolveReportDto` — one per shared-corpus tree.
 * `gateState` is read as a field ("wired" | "unproduced"), never re-derived from a zero
 * (spec-tree-surface.md §9.1 rule 5). `nodes` is optional so every fixture written before I6 (Level
 * 0/1 never reads it) keeps compiling unchanged -- a real wire payload always sends it. */
export type TreeResolveReport = {
  treeId: string;
  category: string;
  gateState: "wired" | "unproduced";
  tierReached: number;
  tiers: number;
  aptitudePoints: number;
  /** I8 (spec-tree-surface.md §7.2 part 2) -- this tree's OWN base allocation, before any stance-mate's
   * credit (D28). `aptitudePoints - ownAptitudePoints` is the credited (lent) amount, meaningful only
   * when `lenderTreeId` is set. Optional for the same reason `nodes`/`lenderTreeId` are: pre-I8
   * fixtures never set it, and a caller with no real value should render no attribution line rather
   * than a fabricated one (never default it to `aptitudePoints`, which would silently claim "no
   * lending" when the split is simply unknown). */
  ownAptitudePoints?: number;
  contributingNodeIds: string[];
  invalidNodeIds: string[];
  lenderTreeId: string | null;
  herfindahlMilli: number;
  focusMilli: number;
  excludedNodes: ExcludedNode[];
  nodes?: TreeNodeSummary[];
  /** seedsmith-content-standard, passive-tree-identity-content (2026-09-08): the tree's own real
   * generated display name/description. Optional/null for any tree the identity stage has not
   * reached yet — render the existing raw `treeId` fallback for those, never a fabricated name. */
  name?: string | null;
  description?: string | null;
};

/** GET /api/passive-tree/{playerId} — the wire twin of `FusionRpg.Contracts.PassiveTreeStateDto`.
 * `skillPoints*` is the "buy a trait" wallet (D25/D34, §4.1's second currency) — a Level 0 first
 * caller of math that already shipped and tested but had no wire shape before task I3. Aptitude
 * points' own unspent total is `AptitudesState`'s `budget - spent` (the SAME wallet primary stats
 * spend from, §4.1's whole point); souls are `SoulBalanceDto.balance` — neither is duplicated here. */
export type PassiveTreeState = {
  playerId: number;
  catalogRevision: number;
  soulLevelByNodeId: Record<string, number>;
  trees: TreeResolveReport[];
  skillPointsBudget: number;
  skillPointsSpent: number;
  skillPointsAvailable: number;
  /** I6 — `req(t) = tierReqScalePoints * t*(t+1)/2` (`TierGate.Reached`'s own formula, mirrored
   * rather than re-derived: "one power ladder, no private curves"). Optional for the same reason
   * `nodes` above is: pre-I6 fixtures never read it. */
  tierReqScalePoints?: number;
  /** I8 (spec-tree-surface.md §5.2) -- `TreeUnlockCost`'s own `(first, step)` pair, mirrored so a Plan
   * preview can reproduce `Cumulative` exactly for a hypothetical owned count ("one power ladder, no
   * private curves") -- the two already-wired skill-point totals above are one `(count, cumulative)`
   * sample and cannot be inverted back into `(first, step)`. Optional for the same pre-I8-fixture
   * reason `tierReqScalePoints` is. */
  unlockCostFirstPoints?: number;
  unlockCostStepPoints?: number;
  /** I9 (spec-tree-surface.md §6) -- `PassiveTreeTuning.Concentration`'s own two dial values, so a
   * DRAFT preview (an uncommitted Plan) can mirror `Concentration.HerfindahlMilli`/`BlendMilli`/
   * `FmaxAppliedMilli` exactly for a hypothetical allocation ("one power ladder, no private curves" --
   * the same reason `tierReqScalePoints`/`unlockCostFirstPoints` are on the wire rather than hand-
   * typed). The COMMITTED Focus line never reads these: every `TreeResolveReport` already carries its
   * own already-resolved `herfindahlMilli`/`focusMilli`, and `focusReading` below only ever reads
   * those. Optional for the same pre-I9-fixture reason `tierReqScalePoints` is. */
  concentrationFmaxMilli?: number;
  concentrationWMilli?: number;
};

/** POST /api/passive-tree/allocate body — one WHOLE allocation (node id -> soul level), never a
 * per-node call (spec-tree-surface.md §4 rule 3). */
export type AllocateTreeNodesRequest = {
  playerId?: number;
  nodes: Record<string, number>;
};

/** POST /api/passive-tree/{playerId}/preview body — I8's follow-up (spec-tree-surface.md §7.2 part
 * 5). `nodes` is the draft's own current whole node set, same shape as `AllocateTreeNodesRequest.nodes`.
 * `aptitudeDelta` is a SIGNED delta keyed by aptitude id (`AptitudesState.shares`'s own vocabulary —
 * never a separately-hardcoded id list), added server-side on top of the actor's REAL committed
 * aptitude allocation. Never persists anything; the response is the same `PassiveTreeState` shape the
 * committed GET returns, computed for the hypothetical inputs instead. */
export type PreviewTreeStateRequest = {
  nodes: Record<string, number>;
  aptitudeDelta?: Record<string, number>;
};
