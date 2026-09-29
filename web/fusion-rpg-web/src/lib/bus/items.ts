import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, sendJson } from "./rest";

/**
 * The item program's surfaces — the read half is `ItemSurfaceEndpoints.cs` (item module 20), the
 * write half is `WorkbenchEndpoints.cs` (item modules 14/15/16).
 *
 * Self-contained the way `expeditions.ts` and `commanders.ts` are: DTOs, keys and hooks in one
 * file, imported by path rather than through the `index.ts` barrel.
 *
 * ⛔ **The three READ routes stay read-only, and the write verbs do not live among them.** Module
 * 20 carries no `MapPost` by design — a second write path through the presentation layer is the
 * duplicate surface it exists to prevent. The mutations below post to `/api/items/workbench/*`,
 * which is modules 14/15/16's own surface and a different file on the server for the same reason.
 */

// ---- DTOs (item module 20 wire shapes; camelCase body, PascalCase enum names) ----

export type ItemSurfaceStatusDto = {
  /** `armoury` | `equipScreen` | `itemCard` | `comparison` | `socketBench` | `compendium`. */
  surface: string;
  /** `Locked` | `Loading` | `Empty` | `Error` | `Ready` — the C# enum name, not camelCased. */
  state: string;
  /** Always present, including when the surface is already unlocked, so a "locked" render never
   * has to discover its own key at the moment it must draw one. */
  unlockKey: string;
};

export type ArmouryRowDto = {
  instanceId: string;
  containerId: string;
  rarity: string;
  rarityOrdinal: number;
  assigned: boolean;
  locked: boolean;
  unseen: boolean;
  stale: boolean;
  acquiredUtc: string;
  /**
   * item-content `granted-action-text` (T15): this item grants an action that only exists inside a
   * battle. `ssot-presentation.md` §9.14 asks for the tag on the compact line and not only on the
   * card — "a player scanning an armoury should not have to open each item to learn that half of
   * them are inert on the lawn."
   */
  battleOnly: boolean;
  /**
   * item-content `item-naming` (T3): the base type's own AUTHORED name for this container
   * ("Card-Proof Charm"), read through the same corpus the card uses. `""` — or absent, on a server
   * older than the field — means this build has no corpus row for the container, and the compact
   * line says so rather than printing the container id where a name belongs.
   *
   * ⚠ It is the BASE TYPE's name, not module 8's composed one: composing the affix name needs a
   * full card render per row and the armoury page is up to 200 of them. Open the item for the whole
   * name.
   */
  containerName?: string;
};

export type ArmouryPageDto = {
  /** Over the WHOLE armoury, never the page. */
  total: number;
  /** The inbox, also over the whole armoury — an inbox you can empty by paging past it is not one. */
  unseen: number;
  overReviewPressure: boolean;
  /** `RenderAll` | `Virtualize` | `SearchFirst`. */
  renderStrategy: string;
  rows: ArmouryRowDto[];
};

export type CombinationRowDto = {
  comboId: string;
  /** `strain` | `splice` | `pure` | `ring` | `eclipse` | `diversity`. */
  shape: string;
  /** `Active` | `OneAway` | `KnownInactive`. `Undiscovered` never reaches the wire. */
  state: string;
  /** `null` is ∞ — unreachable on this item. A nullable, never a sentinel. */
  distance: number | null;
  missingFamilies: string[];
  missingElements: string[];
  grantedTier: number;
};

/**
 * The server's own per-request page bound (`ArmouryQuery.MaxLimit`). Asking for more returns the
 * same 200 rows, so this is the largest single call, not a ceiling on what a player may own —
 * paging past it is the `after` cursor's job.
 */
const ARMOURY_MAX_LIMIT = 200;

// ---- the rendered card (item module 10, served by `ItemCardEndpoints.cs`) ----------------------

/**
 * One rendered line — module 10's `DisplayLine`, unchanged.
 *
 * `unit` and `sourceKind` arrive as the C# enum NAMES (`GameUnits`, `AffixPrefix`), the same
 * `.ToString()` convention the surface and combination routes already use, and both are nullable
 * because a structural line (a header, a footer, a requirement clause) carries no magnitude and
 * declares no source kind.
 *
 * `args` is a flat string map. `args.__rendered` is the renderer's own finished sentence for the
 * line; every other key is the frozen argument the template used to compose it.
 */
export type DisplayLineDto = {
  key: string;
  args: Record<string, string>;
  unit: string | null;
  sourceKind: string | null;
  groupOrder: number;
  /** `null` when the line has no luck to show. Already decided server-side. */
  rollBarSegments: number | null;
  contextRead: string | null;
  rollQualityPerMille: number | null;
};

export type DisplayBlockDto = { blockKey: string; lines: DisplayLineDto[] };

/** `fingerprint` is `DisplayModel.Fingerprint()` — the byte-identity the determinism test asserts on. */
export type ItemCardDto = {
  instanceId: string;
  blocks: DisplayBlockDto[];
  fingerprint: string;
};

// ---- the preview (item-content module `atom-preview`, served by `ItemPreviewEndpoints.cs`) -----

/**
 * An **unsaved** container, posted for preview.
 *
 * Every field down to `pool` is `ContainerRow`'s own, so a container an author is about to write can
 * be posted with no translation step. The four below it are the preview's own inputs and none is a
 * property of a container — see the C# record's docs for what each defaults to.
 *
 * ⛔ **Nothing posted here is stored.** The route mints an instance in memory, renders it through the
 * same `ItemCardRenderer.Render` the live card route calls, and drops both.
 */
export type ItemPreviewRequestDto = {
  containerId: string;
  kind?: string | null;
  slot?: string | null;
  rarity?: string | null;
  minTier?: number | null;
  maxTier?: number | null;
  levelReq?: number | null;
  prefixRolls?: number;
  suffixRolls?: number;
  tagsJson?: string | null;
  atoms?: { seq: number; atomId: string; overridesJson?: string | null }[];
  pool?: { affixId: string; weight: number; group?: string | null }[];
  baseTypeId?: string | null;
  rollSeed?: number | null;
  thetaContent?: number | null;
  itemLevel?: number;
};

/** `mode` is `rolled` | `min` | `max`. `card` is the SAME `ItemCardDto` the live card route returns. */
export type ItemPreviewCardDto = { mode: string; card: ItemCardDto };

export type ItemPreviewDto = {
  containerId: string;
  rollSeed: number;
  /** The depth actually used — the request's, or the power tuning's pin index it defaulted to. */
  thetaContent: number;
  /** What that depth multiplied every scaled magnitude by. 1000 = ×1.000. */
  contentScaleMilli: number;
  cards: ItemPreviewCardDto[];
};

/**
 * ⭐ Render an unsaved container, three ways: as the seed draws it, and at both ends of every atom's
 * authored range.
 *
 * A mutation rather than a query because the payload is a whole container definition, not because it
 * writes anything — `sendJson` throws on a refusal and `httpErrorMessage` lifts the server's own named
 * reason out of it, which is exactly what an author needs to see.
 */
export function useItemPreview() {
  return useMutation({
    meta: { entity: "Item preview" },
    mutationFn: (req: ItemPreviewRequestDto) =>
      sendJson<ItemPreviewDto>("/api/items/preview/card", "POST", req)
  });
}

export type ChannelDeltaDto = {
  channel: string;
  /**
   * The `UnitClass` member name — the SAME vocabulary the group header uses, and nullable for the
   * same reason. Before 2026-09-06 this was a second vocabulary (`game-units` / `per-mille`) derived
   * from the atom's op, which could disagree with the group the row sat in.
   */
  unit: string | null;
  incumbent: number;
  candidate: number;
  delta: number;
  /** The top of an `onApply` BAND. `null` means a point value and `incumbent` is the whole answer. */
  incumbentMax: number | null;
  /** The candidate side of the same band. */
  candidateMax: number | null;
};

/** A word AND a shape, never a colour alone — and there is no colour field to fall back on. */
export type VerdictBadgeDto = { labelKey: string; shape: string };

export type ItemCompareDto = {
  incumbent: ItemCardDto;
  candidate: ItemCardDto;
  /** Positions in the FLATTENED line sequence where the two cards do not render the same thing. */
  differingLineIndexes: number[];
  deltas: ChannelDeltaDto[];
  /** `StrictlyBetter` | `StrictlyWorse` | `Sidegrade` | `Incomparable`. */
  dominance: string;
  badge: VerdictBadgeDto;
  trade: { youGain: ChannelDeltaDto[]; youGiveUp: ChannelDeltaDto[] };
  /** The unit lives in the GROUP, never in a column. `unit: null` is its own group, never folded in. */
  unitGroups: { unit: string | null; deltas: ChannelDeltaDto[] }[];
  meanRollQualityMilliIncumbent: number;
  meanRollQualityMilliCandidate: number;
  /** Permanent. There is no server flag and no client control that can hide it. */
  footnoteKey: string;
  /** Non-null only for an incomparable verdict — one with no explanation reads as a bug. */
  incomparableReasonKey: string | null;
};

/**
 * One craft recipe as the picker offers it — item-content `item-naming` (T4), over
 * `GET /api/items/workbench/recipes`.
 *
 * ⛔ **The list a picker offers is the list the executor prices against.** The route reads
 * `ItemWorkbench.Recipes` itself, so a row offered here can never be one the very next POST refuses
 * with `material.recipe-unknown`.
 */
export type WorkbenchRecipeDto = {
  recipeId: string;
  /** The corpus's authored English name ("Forge: Cloth Armor"). `""` if the entry authors none. */
  name: string;
  /** `forge` | `upcycle` | `forge-gem` | `bore` | `imbue` | `socket` | `elevate` | `temper` | `reroll-one` | `reroll-all`. */
  operation: string;
  frame: string;
  outputKind: string;
  outputRef: string | null;
};

/** One insert the player actually holds, named — `GET /api/items/workbench/inserts/{playerId}`. */
export type WorkbenchInsertDto = {
  containerId: string;
  /** The gem corpus's authored name ("Ember Shard"). `""` when the corpus has no row. */
  name: string;
  /** `""` is a genuinely element-free insert, not an absent read. */
  element: string;
  qty: number;
};

export const itemKeys = {
  surfaces: (playerId: string) => ["itemSurfaces", playerId] as const,
  workbenchRecipes: (operation: string) => ["workbenchRecipes", operation || "all"] as const,
  heldInserts: (playerId: string) => ["workbenchInserts", playerId] as const,
  armoury: (playerId: string, after: string | null) => ["itemArmoury", playerId, after ?? "head"] as const,
  combinations: (instanceId: string, playerId: string) => ["itemCombinations", instanceId, playerId] as const,
  assignments: (specimenId: string) => ["itemAssignments", specimenId] as const,
  card: (instanceId: string, specimenId: string) => ["itemCard", instanceId, specimenId || "anon"] as const,
  compare: (candidateId: string, incumbentId: string, specimenId: string) =>
    ["itemCompare", candidateId, incumbentId, specimenId || "anon"] as const
};

function specimenQuery(specimenId: string): string {
  return specimenId.length > 0 ? `?specimenId=${encodeURIComponent(specimenId)}` : "";
}

/**
 * ⭐ The eleven rendered blocks of one item — module 10's `DisplayModel`, over the read-only route
 * item module 20 added on 2026-09-06.
 *
 * `specimenId` is optional and adds the three wearer-shaped blocks (requirements, the gate's refusal,
 * set progress). Leaving it out is a different card, not a poorer one: an item in the bag advances no
 * set and refuses nothing.
 *
 * `retry: false` because every refusal this route gives is a content decision, not a blip — an
 * unknown instance is a 404 and an unrenderable one is a 409, and retrying either just spends time.
 */
export function useItemCard(instanceId: string | null | undefined, specimenId?: string | null) {
  const id = instanceId?.trim() || "";
  const spec = specimenId?.trim() || "";
  return useQuery({
    queryKey: itemKeys.card(id, spec),
    queryFn: () => getJson<ItemCardDto>(`/api/items/${encodeURIComponent(id)}/card${specimenQuery(spec)}`),
    enabled: id.length > 0,
    staleTime: 5_000,
    retry: false
  });
}

/**
 * ⭐ Incumbent versus candidate — both rendered cards plus `DominancePresentation`'s verdict, trade
 * and unit-class grouping.
 *
 * ⛔ **Nothing here is computed in the browser.** The verdict, the grouping, the trade split and the
 * footnote all arrive already decided; a delta table assembled client-side would be the second
 * implementation module 13 exists to prevent.
 */
export function useItemCompare(
  candidateId: string | null | undefined,
  incumbentId: string | null | undefined,
  specimenId?: string | null
) {
  const candidate = candidateId?.trim() || "";
  const incumbent = incumbentId?.trim() || "";
  const spec = specimenId?.trim() || "";
  return useQuery({
    queryKey: itemKeys.compare(candidate, incumbent, spec),
    queryFn: () =>
      getJson<ItemCompareDto>(
        `/api/items/${encodeURIComponent(candidate)}/compare/${encodeURIComponent(incumbent)}${specimenQuery(spec)}`
      ),
    enabled: candidate.length > 0 && incumbent.length > 0 && candidate !== incumbent,
    staleTime: 5_000,
    retry: false
  });
}

/** GG-17 / GG-44 — which designed state each of the six surfaces is in, and what unlocks it. */
export function useItemSurfaces(playerId: number | string) {
  const pid = String(playerId ?? "").trim();
  return useQuery({
    queryKey: itemKeys.surfaces(pid),
    queryFn: () => getJson<ItemSurfaceStatusDto[]>(`/api/items/surfaces/${encodeURIComponent(pid)}`),
    enabled: pid.length > 0 && pid !== "0",
    staleTime: 10_000
  });
}

/** One keyset page of the armoury, plus the inbox count and the render strategy for the whole of it. */
export function useArmoury(playerId: number | string, after: string | null = null) {
  const pid = String(playerId ?? "").trim();
  const cursor = after ? `&after=${encodeURIComponent(after)}` : "";
  return useQuery({
    queryKey: itemKeys.armoury(pid, after),
    queryFn: () =>
      getJson<ArmouryPageDto>(
        `/api/items/armoury/${encodeURIComponent(pid)}?limit=${ARMOURY_MAX_LIMIT}${cursor}`
      ),
    enabled: pid.length > 0 && pid !== "0",
    staleTime: 5_000
  });
}

/**
 * The four-state combination list for one item — the ONE combination read, so the socket bench's
 * preview and the compendium's rows can never come from two different functions.
 *
 * Without a `playerId` the reveal ledger is empty and only active rows come back, so the id is
 * passed whenever it is known rather than treated as optional decoration.
 */
export function useItemCombinations(instanceId: string | null | undefined, playerId: number | string) {
  const id = instanceId?.trim() || "";
  const pid = String(playerId ?? "").trim();
  return useQuery({
    queryKey: itemKeys.combinations(id, pid),
    queryFn: () =>
      getJson<CombinationRowDto[]>(
        `/api/items/${encodeURIComponent(id)}/combinations?playerId=${encodeURIComponent(pid)}`
      ),
    enabled: id.length > 0,
    staleTime: 5_000,
    retry: false
  });
}

/**
 * ⭐ The craft recipes, by their real names — item-content `item-naming` T4.
 *
 * ⏸ Until 2026-09-06 no route served these 30 rows at all, so both benches asked the player to TYPE
 * `recipe.014`. `operation` narrows the list to the verb the control actually runs, so a temper
 * picker never offers a bore recipe the executor would refuse.
 *
 * The corpus is content that changes only on redeploy, so it is cached for the session rather than
 * re-read per dialog open.
 */
export function useWorkbenchRecipes(operation?: string) {
  const op = operation?.trim() || "";
  return useQuery({
    queryKey: itemKeys.workbenchRecipes(op),
    queryFn: () =>
      getJson<WorkbenchRecipeDto[]>(
        `/api/items/workbench/recipes${op.length > 0 ? `?operation=${encodeURIComponent(op)}` : ""}`
      ),
    staleTime: Infinity,
    retry: false
  });
}

/** The inserts this player holds, named — so "set an insert" is a pick rather than a typed id. */
export function useHeldInserts(playerId: number | string) {
  const pid = String(playerId ?? "").trim();
  return useQuery({
    queryKey: itemKeys.heldInserts(pid),
    queryFn: () =>
      getJson<WorkbenchInsertDto[]>(`/api/items/workbench/inserts/${encodeURIComponent(pid)}`),
    enabled: pid.length > 0 && pid !== "0",
    staleTime: 5_000,
    retry: false
  });
}

// ---- The workbench (item modules 14/15/16 — `WorkbenchEndpoints.cs`) ---------------------------

/** One resolved cost or yield line, as the server priced it. */
export type WorkbenchCostDto = { class: string; materialId: string; qty: number };

/** One socket after the operation. `insert` is `null` for an empty socket. */
export type WorkbenchSocketDto = {
  index: number;
  affinity: string;
  crafted: boolean;
  insert: string | null;
  /** item-content T4: the gem corpus's authored name for the insert. `""` when there is none. */
  insertName?: string;
};

/**
 * `WorkbenchOutcomeDto` — what one operation did, in the one shape every verb returns.
 *
 * The server sends this body on **both** paths: 200 when the operation ran, 409 when a content rule
 * refused it. `sendJson` throws on the 409 and `httpErrorMessage` lifts `reason` out of it, so a
 * refusal reaches a caller as an `Error` carrying the server's own named rule — never a rewritten one.
 */
export type WorkbenchOutcomeDto = {
  ok: boolean;
  verb: string;
  reason: string;
  instanceId: string;
  recipeId: string;
  opSeq: number;
  replayed: boolean;
  outcome: string;
  enhanceLevel: number;
  pityCounter: number;
  /** Per-mille. `0` for every verb that rolls nothing. */
  successMilli: number;
  spent: WorkbenchCostDto[];
  granted: WorkbenchCostDto[];
  sockets: WorkbenchSocketDto[];
};

/**
 * The six request shapes, field-for-field against `WorkbenchEndpoints.cs`'s own records.
 *
 * ⛔ **`correlationId` is required by the server on every spending verb**, and the refusal says why:
 * *"a spend without one is not retry-safe"*. It is the key both `rpg_material_spend_log` and
 * `effect_instance_op` are unique on, so a retried request returns the recorded outcome from both
 * instead of charging twice. Mint one with `newCorrelationId()` per user action, not per render.
 *
 * `playerId` is optional on every verb — the server falls back to the current player.
 */
export type SalvageRequest = { playerId?: number; instanceId: string };

export type UpcycleRequest = { playerId?: number; recipeId: string; correlationId: string };

export type EnhanceRequest = {
  playerId?: number;
  instanceId: string;
  recipeId: string;
  correlationId: string;
};

export type SocketAddRequest = {
  playerId?: number;
  instanceId: string;
  recipeId: string;
  correlationId: string;
};

export type SocketInsertRequest = {
  playerId?: number;
  instanceId: string;
  recipeId: string;
  insertContainerId: string;
  /** Omitted lets the server pick the first open socket. */
  socketIndex?: number | null;
  correlationId: string;
};

export type SocketImbueRequest = {
  playerId?: number;
  instanceId: string;
  recipeId: string;
  socketIndex: number;
  element: string;
  correlationId: string;
};

/**
 * Everything a workbench write can move. Sockets, ownership and the combination preview all change
 * together — a socket-insert alters the fill the compendium reads — so one helper invalidates the
 * lot rather than each call site remembering which of the three it touched.
 */
export function invalidateItemQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["itemArmoury"] });
  void qc.invalidateQueries({ queryKey: ["itemSurfaces"] });
  void qc.invalidateQueries({ queryKey: ["itemCombinations"] });
  // Enhancing, socketing and salvaging all move what the card renders — the enhancement block, the
  // socket cells, the footer's flags — so the rendered card and any comparison built on it go too.
  void qc.invalidateQueries({ queryKey: ["itemCard"] });
  void qc.invalidateQueries({ queryKey: ["itemCompare"] });
  // Every verb but salvage debits materials, and salvage credits them.
  void qc.invalidateQueries({ queryKey: ["creatureMaterials"] });
}

// ---- equip / unequip (item module 4 — `ItemEquipEndpoints.cs`) ---------------------------------

/**
 * One durable assignment: this specimen wears this thing in this role.
 *
 * `refKind` is `"rolled"` for an item instance the player owns and `"stock"` for a catalog id —
 * which today means one of the four hand-authored relics, put there by the older relic flow. The
 * two are the same table and **not** the same write path.
 */
export type ItemAssignmentDto = {
  /** One of the sixteen registry role ids, e.g. `armament-primary`. */
  role: string;
  /** `rolled` (an item instance) or `stock` (a catalog id — a relic). */
  refKind: string;
  refId: string;
  assignedUtc: string;
};

/**
 * `ItemEquipOutcomeDto` — what one equip or unequip did.
 *
 * Same two-path shape the workbench uses: 200 when it happened, 409 with the named rule when a
 * gate refused it, and the identical body either way, so `httpErrorMessage` lifts `reason` out of a
 * refusal without a special case. `assignments` is the specimen's whole list afterwards, so a
 * paperdoll never has to guess what moved.
 */
export type ItemEquipOutcomeDto = {
  ok: boolean;
  /** `equip` | `unequip`. */
  verb: string;
  reason: string;
  specimenId: string;
  role: string;
  refKind: string;
  refId: string;
  /** The occupant this write displaced — the swapped-out piece on an equip, the removed one on an
   * unequip. `null` when the role was empty. */
  replaced: ItemAssignmentDto | null;
  assignments: ItemAssignmentDto[];
};

export type ItemEquipRequest = {
  playerId?: number;
  specimenId: string;
  instanceId: string;
  role: string;
};

export type ItemUnequipRequest = {
  playerId?: number;
  specimenId: string;
  role: string;
};

/**
 * What one specimen is wearing, across all fifteen roles.
 *
 * ⚠ Not the same read as `useUniqueEquipment`. That one goes through
 * `GET /api/unique/actors/{id}/equipment`, which projects the same table down to the three legacy
 * slot words (`weapon`/`armor`/`trinket`) for the relic layer. An item can occupy any of the
 * fifteen roles, so it needs the unprojected list.
 */
export function useItemAssignments(specimenId: string | null | undefined) {
  const id = specimenId?.trim() || "";
  return useQuery({
    queryKey: itemKeys.assignments(id),
    queryFn: () => getJson<ItemAssignmentDto[]>(`/api/items/assignments/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
    staleTime: 5_000,
    retry: false
  });
}

/**
 * Both writes touch the same three surfaces: the assignment list, the armoury row's `assigned`
 * flag, and the legacy three-slot projection the relic layer reads off the very same table.
 */
function invalidateEquipQueries(qc: ReturnType<typeof useQueryClient>, specimenId: string) {
  void qc.invalidateQueries({ queryKey: itemKeys.assignments(specimenId) });
  void qc.invalidateQueries({ queryKey: ["itemArmoury"] });
  void qc.invalidateQueries({ queryKey: ["uniqueEquipment", specimenId] });
  // The card's requirement block and set progress are facts about a WEARER, so equipping moves them.
  void qc.invalidateQueries({ queryKey: ["itemCard"] });
  void qc.invalidateQueries({ queryKey: ["itemCompare"] });
}

/**
 * item module 4 — put an owned item into a role on a bound specimen.
 *
 * ⛔ **No `correlationId`, unlike every workbench verb.** Equipping debits nothing, so there is no
 * double-spend for an idempotency key to protect against, and the server's write upserts on
 * `(specimen, role)` — a retry lands the same row and comes back `equip.already-in-this-role`.
 */
export function useEquipItem() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Equipment" },
    mutationFn: (req: ItemEquipRequest) =>
      sendJson<ItemEquipOutcomeDto>("/api/items/equip", "POST", req),
    onSuccess: (_outcome, req) => invalidateEquipQueries(qc, req.specimenId)
  });
}

/** item module 4 — take whatever is in a role off. One row deleted; the item stays in the armoury. */
export function useUnequipItem() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Equipment" },
    mutationFn: (req: ItemUnequipRequest) =>
      sendJson<ItemEquipOutcomeDto>("/api/items/unequip", "POST", req),
    onSuccess: (_outcome, req) => invalidateEquipQueries(qc, req.specimenId)
  });
}

/** item module 14 — the converter. The item becomes `salvaged` and its yield lands, in one transaction. */
export function useSalvageItem() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Item" },
    mutationFn: (req: SalvageRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/salvage", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/** item module 14 — five of grade `g` become one of grade `g+1`. The one verb with no item at all. */
export function useUpcycleMaterials() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Materials" },
    mutationFn: (req: UpcycleRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/upcycle", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/**
 * item module 15 — `+n → +n+1`.
 *
 * ⚠ A 200 here is not a success: a failed attempt still spends, still appends an op and still moves
 * the pity counter, so the caller must read `outcome`, not the HTTP status.
 */
export function useEnhanceItem() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Item" },
    mutationFn: (req: EnhanceRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/enhance", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/**
 * species-gear-chain T37 — the upgrade's read-only preview: the SAME decision the verb makes, with
 * nothing spent and nothing consumed. `ok` carries the successor chassis, both implicits, the carried
 * affix count and the souls price; `!ok` carries the refusing rule in `reason`.
 */
export type WorkbenchUpgradePreviewDto = {
  ok: boolean;
  reason: string;
  instanceId: string;
  successorBaseTypeId: string;
  outgoingImplicitFamily: string;
  incomingImplicitFamily: string;
  carriedAffixCount: number;
  soulsCost: number;
  spent: WorkbenchCostDto[];
};

export type UpgradePreviewRequest = { playerId: number | string; instanceId: string };
export type UpgradeRequest = UpgradePreviewRequest & { correlationId: string };

/** The preview writes nothing, so it invalidates nothing. */
export function useUpgradePreview() {
  return useMutation({
    meta: { entity: "Item" },
    mutationFn: (req: UpgradePreviewRequest) =>
      sendJson<WorkbenchUpgradePreviewDto>("/api/items/workbench/upgrade-preview", "POST", req)
  });
}

/**
 * species-gear-chain T37 — consume the instance and produce its authored successor chassis. The
 * input leaves the loadout and the world; the result is a different instance carrying the same
 * affixes, which is why the surface shows the swap first (see the preview above).
 */
export function useUpgradeItem() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Item" },
    mutationFn: (req: UpgradeRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/upgrade", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/** item module 16 — open one empty, crafted socket (priced by module 14's `bore` rows). */
export function useSocketAdd() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Sockets" },
    mutationFn: (req: SocketAddRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/socket-add", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/** item module 16 — put a held insert into an open socket, and take it out of stock in the same write. */
export function useSocketInsert() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Sockets" },
    mutationFn: (req: SocketInsertRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/socket-insert", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}

/**
 * item module 16 — declare a crafted, empty socket's element affinity.
 *
 * ⏸ Wired but **unpayable**: no shipped recipe authors the `imbue` operation, so this can only ever
 * come back `material.recipe-unknown` until module 14's corpus carries one. The bench says so in
 * the player's own words rather than offering an action that cannot complete.
 */
export function useSocketImbue() {
  const qc = useQueryClient();
  return useMutation({
    meta: { entity: "Sockets" },
    mutationFn: (req: SocketImbueRequest) =>
      sendJson<WorkbenchOutcomeDto>("/api/items/workbench/socket-imbue", "POST", req),
    onSuccess: () => invalidateItemQueries(qc)
  });
}
