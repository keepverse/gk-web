import type { Pending } from "./pending";

/**
 * The FE view contract. Components bind here — never to a REST DTO
 * (`src/lib/bus/*.ts`) directly (game-gui-map.md's contract section, T4's
 * guard). Authored against the eleven-entity ladder in
 * `docs/design/README.md` §6: Atom, Container, Actor, Status, Element,
 * Channel, Resource, Power, Sector, Contract (the SSOT's "Creature + contract"
 * rung), Run.
 *
 * That entity list is itself flagged incomplete (item/ and action/ were
 * missed — docs/design/gap-audit-2026-08-22.md, closed by nine detail-design
 * documents in `docs/design/spec-*.md`). Extension is additive-only
 * (game-gui-map.md's rule): add a field or a variant freely; renaming or
 * narrowing one is a contract version bump + ADR.
 *
 * Fields with no server source today are `Pending<T>` with a player-facing
 * reason, not omitted — "declared, not deferred".
 */

/**
 * v2 (2026-09-04): `SectorView.typeId` narrowed `number` → `string` to match the wire
 * (`WorldSectorDto.TypeId` is `string`, `WorldDtos.cs:66`) — see `decisions.md`'s dated ADR row.
 * A narrowing, not an addition, so it earns the bump rather than riding in free.
 *
 * v3 (2026-09-06): `ContainerView.sockets` and `ContainerView.set` narrowed `Pending<unknown>` →
 * `Pending<SocketsView>` / `Pending<SetView>`. Both were declared placeholders waiting for exactly
 * this — item module 20's own build — and nothing has ever produced a value for either, so no
 * caller narrows underneath. It is still a narrowing rather than an addition, so it takes the bump
 * on the same terms v2 did. ⚠ The matching dated row in `decisions.md` is owed and is the owner's
 * to write; this note is not a substitute for it.
 *
 * v4 (2026-09-06): `DisplayLine` and two `ContainerView` fields reshaped the day
 * `GET /api/items/{instanceId}/card` started serving module 10's real `DisplayModel`, because three
 * of the placeholder shapes turned out to be wrong about what a rendered line IS:
 *
 * - `DisplayLine.unit` / `.sourceKind` widened to `| null`. **The null is load-bearing**, not a gap:
 *   a STRUCTURAL line (the header, a requirement clause, the footer) carries no magnitude, so it has
 *   no unit and declares no source kind. Naming one anyway is the exact lie SC4 exists to prevent,
 *   and it is why the C# record made both nullable in the first place.
 * - `DisplayLine.rollPolicy` → `rollBarSegments?`. The bar decision is `ItemDisplayRenderer.BarFor`'s
 *   and it is already made by the time a line exists — re-deriving it here from a policy would be a
 *   second implementation of the one rule that says `Fixed` has no luck to show and `OnApply` shows a
 *   band. `rendered` was added for the same reason: the renderer composes the sentence, the browser
 *   does not.
 * - `ContainerView.requirements` and `.grantedAction` became `Pending<DisplayLine[]>`. Both were
 *   authored as bespoke shapes (`RequirementLine[]`, ONE line) before the card existed; the card
 *   emits `{key, args}` leaves for both, and an item may grant more than one action.
 *
 * `RequirementLine` is retired with this bump — it had no producer and now has no consumer. ⚠ The
 * matching dated row in `decisions.md` is owed and is the owner's to write.
 *
 * party-dungeon D5.3 (2026-09-07): the sixteen delve view types (§"12. Delve", end of file) and
 * `Magnitude.exact?` landed with **no bump** — every addition is a new type or a new optional field,
 * never a rename or a narrowing, so the extension rule above admits the whole row free. (The task
 * brief's own acceptance line says "`CONTRACT_VERSION` stays `2`" — stale by the time this task ran;
 * two unrelated bumps, v3 and v4 above, had already landed first. The number this task actually kept
 * unchanged is `4`, and the rule the acceptance line means — no bump for additive work — holds either
 * way.)
 */
export const CONTRACT_VERSION = 4;

// ===========================================================================
// Shared primitives — spec-magnitude-and-units.md §7
// ===========================================================================

/** No overload of `formatMagnitude` (T6) accepts a bare `number` — that omission is the GG-46 guard. */
export type UnitClass =
  | "gameUnits"
  | "gameUnitsPerSecond"
  | "sigmoidPoints"
  | "sigmoidMultiplierPoints"
  | "statusPotencyPoints"
  | "perMilleRatio"
  | "milliseconds"
  | "count"
  | "flag"
  // Ten classes above (spec-magnitude-and-units.md §3); the two below are class-system additions,
  // both authorised 2026-08-26 (spec-primary-stats.md §3.2, spec-unit-class-close.md §3.3/§3.5) —
  // "ladderIndex" itself was already shipped in C# 2026-08-24 but owed here until now (§3's own
  // "Contract change owed" note).
  | "ladderIndex"
  | "aptitudePoints"
  | "reciprocalPoints"
  // loamUnits (world-numbers, owner-authorised 2026-09-04 — see decisions.md's dated ADR row and
  // spec-magnitude-and-units.md's ledger): a whole `long` count of loam, distinct from `gameUnits`
  // because its ledger row needs no `channel` (loam is not a derived channel) and it must not
  // always render signed the way `gameUnits` does (a cost or a stock is a plain count; only a flow
  // wants a sign, and that sign is `LoamFigure`'s own composition, not this unit class's).
  | "loamUnits";

export type ChannelId = string;

export type Magnitude = {
  unit: UnitClass;
  /** The frozen integer the engine holds. Never pre-formatted. */
  value: number;
  /** Required for gameUnits / sigmoid* — carries the arena. */
  channel?: ChannelId;
  /**
   * Required for perMilleRatio. `absolute` (owner-authorised 2026-09-04 — decisions.md) renders the
   * raw per-mille as a multiplier with **no delta convention** — `1400` renders `×1.40` — for a
   * field whose own neutral baseline is 1000, such as `FractureIntensityMilli`. `more` stays for a
   * field that is already a *delta* from zero (a stat modifier's own "+400‰ more" reading).
   */
  op?: "flat" | "increased" | "more" | "absolute";
  /**
   * party-dungeon D5.3 (spec-delve-stage.md §13, §18 ask 8 — landed) — the exact base-10 digit
   * string for a `long` figure whose true value may exceed `Number.MAX_SAFE_INTEGER` (2^53-1).
   * Additive and optional, so no `CONTRACT_VERSION` bump is owed (game-gui-map.md's extension rule).
   * `formatMagnitude` renders `exact` through `Intl.NumberFormat` on a `BigInt` when present, and
   * `value` otherwise (magnitude.ts) — never parses a `long` into a `number` and back (§16).
   *
   * ⚠ **Named gap, not solved by this field alone.** §13's own rule is that a `long` figure crosses
   * the wire "as a decimal string **beside** its `number`" — i.e. the server sends a second, string
   * field the adapter copies in here. `DelveEndpoints.cs`'s `HandleGetDelve` (D5.2, already shipped)
   * does not send one yet — it sends `soulsUnbanked = delve.SoulsUnbanked` as a bare `long`, which
   * `System.Text.Json`'s default policy serialises as a plain JSON number (confirmed: no
   * `JsonStringEnumConverter`-style option or `[JsonConverter]` touches it anywhere in
   * `Program.cs`/`DelveEndpoints.cs`). A JSON number past 2^53 is already rounded by the time any
   * `fetch(...).json()` call in this app parses it, so no adapter downstream can recover the true
   * digits from `soulsUnbanked` alone. This field and `formatMagnitude`'s support for it are real and
   * tested against a fixture where the exact string is already known (`A_long_soul_balance_renders_
   * exactly`) — the shape a decimal-string companion field would arrive in. Wiring that companion
   * field onto `HandleGetDelve`'s own response is a `DelveEndpoints.cs`-touching follow-up, outside
   * this task's own Files line.
   */
  exact?: string;
};

export type ContextRead = {
  reference: "neutral" | { specimenId: string };
  text: string;
};

/** The twelve closed values a rendered line's origin can be (spec-item-card.md §3). */
export type SourceKind =
  | "base"
  | "implicit"
  | "affix-prefix"
  | "affix-suffix"
  | "enhancement"
  | "socket-insert"
  | "resonance"
  | "word"
  | "set-threshold"
  | "granted-action"
  | "unique-identity"
  | "unique-variance";

export type RollPolicy = "fixed" | "onInstantiate" | "onApply";

/** A line binds to `key`/`args`, never a finished sentence — a translator reorders without touching a number. */
export type DisplayLine = {
  key: string;
  args: Record<string, Magnitude | string>;
  /**
   * `null` for a STRUCTURAL line — the header, a requirement clause, a set name, the footer. Those
   * carry no magnitude, so they have no unit, and naming one would be the lie SC4 exists to prevent.
   */
  unit: UnitClass | null;
  /** Absent means no context part (no "vs neutral" / "vs <specimen>" clause). */
  context?: ContextRead;
  /**
   * The roll-quality bar, already decided by `ItemDisplayRenderer.BarFor`: absent when the line has
   * no luck to show (a `fixed` value never rolled; an `onApply` value shows a band the hit rolls).
   * Re-deriving it here from a roll policy would be a second implementation of that one rule.
   */
  rollBarSegments?: number;
  /** Only for a value the ITEM rolled — absent for `fixed` and for an `onApply` band. */
  rollQualityPerMille?: number;
  /** `null` for the same reason `unit` is: a structural line is not an atom line. */
  sourceKind: SourceKind | null;
  groupOrder: number;
  /**
   * The renderer's own finished sentence for this line, composed from the display template and the
   * frozen magnitude. Present whenever the line came from a template; absent for a structural line,
   * which has no template. ⛔ **The browser never composes this** — that is the whole reason a
   * template lives in `item_display_template` and the magnitude formatting lives in
   * `ItemDisplayRenderer`.
   */
  rendered?: string;
};

export type Rarity = {
  ordinal: number; // 10..100, spaced by 10
  id: "chaff" | "sprout" | "grafted" | "cultivated" | "fused" | "chimeric" | "heirloom" | "firstseed" | "sunwoven" | "almanac";
  display: string;
  colour: string;
  pips: number; // 1..10
};

// ===========================================================================
// 1. Atom — Token · Chip · Row · Card (docs/design/README.md §6)
// ===========================================================================

export type AtomView = {
  id: string;
  line: DisplayLine;
};

// ===========================================================================
// 2. Container — item / trait / skill / species-passive / patron / world-buff
//    Chip · Row · Card · Panel. Eleven blocks (spec-item-card.md §1).
// ===========================================================================

export type ContainerKind = "item" | "trait" | "skill" | "species-passive" | "patron" | "world-buff";

export type ContainerHeader = {
  name: string;
  rarity: Rarity;
  baseTypeAndClassNoun: string;
  frameBadge?: string;
  itemLevel?: number;
  enhancementPrefix?: string; // "+10 "
  /**
   * species-gear-chain T26 — the rung this item was PROMOTED FROM, when it was, resolved off the
   * same ladder `rarity` came from. Absent when the item was never promoted: the header then says
   * nothing rather than "promoted from nothing".
   */
  promotedFromRarity?: Rarity;
};

export type ContainerView = {
  instanceId: string;
  kind: ContainerKind;
  header: ContainerHeader;
  /**
   * The level clause, each attribute clause, and the gate's refusal when there is one — all as
   * rendered lines, because that is what the card emits. I11's rule that a clause names WHICH number
   * gates lives in the line's own args (`need` / `unassisted` / `bonus` / `gates`), not in a shape
   * this file re-derives.
   */
  requirements: Pending<DisplayLine[]>;
  baseStats: DisplayLine[];
  implicit: Pending<DisplayLine[]>;
  affixes: Pending<DisplayLine[]>;
  enhancement: Pending<{ tier: number; nextMilestone?: DisplayLine }>;
  sockets: Pending<SocketsView>;
  set: Pending<SetView>;
  /** Plural: an item may carry more than one grant, and block 9 renders every one of them. */
  grantedAction: Pending<DisplayLine[]>;
  flavour?: string;
  /**
   * `meanRollQuality` is the renderer's own formatted percentage (`ItemDisplayRenderer.FormatPerMille`),
   * not a raw per-mille: block 11 computes the mean from the same per-atom read the bars above it use
   * and formats it there, and parsing that string back into a number here to re-format it would be
   * the second implementation the one-producer rule forbids. Absent when nothing on the item rolled.
   */
  footer: Pending<{ meanRollQuality?: string; stale: boolean; locked: boolean }>;
};

// ===========================================================================
// 2b. Item surfaces — the six surfaces of `spec-item-surfaces.md` (item module
//     20), over the read-only `GET /api/items/*` routes.
//
// Every number here is the server's. Nothing in this section is derived in
// TypeScript: distances come from module 16's evaluator through
// `CombinationDistance`, verdicts and unit-class grouping from
// `DominancePresentation`, per-piece set truth from `SetDisclosure`. A view
// type that carried a formula instead of a value would be the second
// implementation those modules exist to prevent.
// ===========================================================================

/** `SurfaceCatalog.Id` — closed, and a seventh needs a declared unlock before it can exist. */
export type ItemSurfaceId =
  | "armoury"
  | "equipScreen"
  | "itemCard"
  | "comparison"
  | "socketBench"
  | "compendium";

/**
 * GG-17's four designed states plus the named populated case. `ready` is named rather than implied
 * so a surface cannot be written with three states and a fourth nobody handled.
 */
export type ItemSurfaceState = "locked" | "loading" | "empty" | "error" | "ready";

export type SurfaceStatusView = {
  surface: ItemSurfaceId;
  state: ItemSurfaceState;
  /** Always present, so a locked surface can always say what unlocks it (GG-44). */
  unlockKey: string;
};

/** GG-50's three bands. No band refuses a row — they differ only in how much reaches the DOM. */
export type RenderStrategy = "renderAll" | "virtualize" | "searchFirst";

export type ArmouryRowView = {
  instanceId: string;
  containerId: string;
  rarity: Rarity;
  /**
   * Both live on the item's BASE TYPE, and that table does not exist yet — so they are `pending`
   * with a player-facing reason rather than answered from the container's slot, which is a
   * different axis and would be a plausible wrong answer.
   */
  role: Pending<string>;
  frame: Pending<string>;
  assigned: boolean;
  locked: boolean;
  unseen: boolean;
  stale: boolean;
  acquiredUtc: string;
  /**
   * item-content `granted-action-text` (T15) — card block 9's compact-line half
   * (`ssot-presentation.md` §9.14): the item grants a battle-only action, so it is inert on the lawn.
   * A plain answer, not `Pending`: the grant rows are on the wire, unlike `role`/`frame` above.
   */
  battleOnly: boolean;
  /**
   * item-content `item-naming` (T3): the base type's own AUTHORED name for this container, straight
   * off the wire. `null` is "this build's corpus has no row for it" — the compact line then says
   * *unnamed* rather than falling back to the container id, because an id in a name slot is the
   * defect T3 exists to remove.
   */
  containerName: string | null;
};

/** The inbox is counted over the WHOLE armoury, never the page. */
export type ArmouryInboxView = {
  unseen: Magnitude; // count
  total: Magnitude; // count
  /** A watch number, never a refusal — no row is hidden when it fires. */
  overReviewPressure: boolean;
};

export type ArmouryPageView = {
  inbox: ArmouryInboxView;
  strategy: RenderStrategy;
  rows: ArmouryRowView[];
};

/** `ArmourySortKey` — module 2's own sort axes, minus the ones whose column is not on the wire. */
export type ArmourySortKey = "acquired" | "rarity" | "assigned" | "locked" | "unseen";

/**
 * The loot filter is a client-side VIEW rule over an already-materialised row list — never a
 * server-side throttle on generation, and never a bag cap wearing a layout name. A `locked` row is
 * never hidden by any combination of these.
 */
export type ArmouryFilterState = {
  rarityMin: number | null;
  rarityMax: number | null;
  unseenOnly: boolean;
  hideAssigned: boolean;
  hideStale: boolean;
  sort: ArmourySortKey;
};

export type CombinationShape = "strain" | "splice" | "pure" | "ring" | "eclipse" | "diversity";

/** The four closed states, in the order the compendium renders them. */
export type CombinationState = "active" | "one-away" | "known-inactive" | "undiscovered";

export type CombinationView = {
  comboId: string;
  /**
   * item-content `item-naming` (T3): the row's own words, for the title where the raw `comboId` used
   * to be printed.
   *
   * ⚠ **A placement, not a translation** — the same rule `keyTail` states for `class.*` / `rarity.*`.
   * The 25 shipped combinations are GENERATED (`ResonanceGenerator`) from the element roster and no
   * corpus authors a name for one, so this is the id's own tail in words and nothing English is
   * invented. **Named gap:** a resonance name corpus, owner module 16/21 — the day one ships this
   * field reads it instead, and no caller changes.
   */
  title: string;
  shape: CombinationShape;
  state: CombinationState;
  /** `null` is ∞ — unreachable on this item, which is `undiscovered` and never `one-away`. */
  distance: number | null;
  /** Named families for an authored recipe; empty for a generated resonance. */
  missingFamilies: string[];
  /** The other half: which elements a generated resonance's fill still lacks. */
  missingElements: string[];
  grantedTier: number;
};

export type SocketCellView = {
  index: number;
  affinity: string | null;
  /** `null` is an empty cell — room, not an ingredient. */
  insertName: string | null;
  /** An omni insert counts toward Diversity only, and the cell has to say so. */
  omniCountsDiversityOnly: boolean;
};

export type SocketsView = {
  cells: SocketCellView[];
  combinations: CombinationView[];
};

export type SetTierView = {
  /** A threshold names the piece count it needs, never "next". */
  piecesRequired: number;
  active: boolean;
  isCapability: boolean;
};

export type SetView = {
  setId: string;
  name: string;
  count: number;
  total: number;
  /** The whole ladder always renders — inactive thresholds are the goal. */
  ladder: SetTierView[];
  /** Sets this piece advances, and sets where an earlier piece already claimed its role. */
  advances: string[];
  redundantIn: string[];
};

/**
 * Which sets one worn piece advances, and which it is silently redundant in. A disclosure, never a
 * refusal — wearing the second copy stays legal, and the point is that the card says why the
 * fourth piece did not count. One shipped item routinely advances more than one set.
 */
export type PieceSetDisclosureView = {
  instanceId: string;
  itemName: string;
  advances: string[];
  redundantIn: string[];
};

/**
 * The six verbs the workbench executes (item modules 14/15/16), as
 * `POST /api/items/workbench/{verb}` names them. A closed list: `forge`, `reroll` and `transfer`
 * are deliberately absent because no route serves them — see `Workbench.tsx`'s unavailable list,
 * which names each one's real reason rather than showing a control that could only fail.
 */
export type WorkbenchVerb =
  | "salvage"
  | "upcycle"
  | "enhance"
  | "socket-add"
  | "socket-insert"
  | "socket-imbue";

/** One resolved cost or yield line. The quantity is the server's own resolved price, never a guess. */
export type WorkbenchCostView = {
  /** `Substrate` | `Catalyst` | `Reagent` — the material class the server named. */
  materialClass: string;
  materialId: string;
  qty: Magnitude; // count
};

/**
 * One socket after the operation, exactly as the workbench reported it. Deliberately NOT
 * `SocketCellView`: that view carries `omniCountsDiversityOnly`, which this payload does not
 * answer, and inventing a value for it would be the fabricated-field defect the contract exists to
 * prevent.
 */
export type WorkbenchSocketView = {
  index: number;
  /** `null` when the socket declares no element affinity. */
  affinity: string | null;
  crafted: boolean;
  /** `null` is an empty socket — room, not an ingredient. */
  insertContainerId: string | null;
  /**
   * item-content `item-naming` (T4): the gem corpus's authored name for what sits here
   * ("Ember Shard"). `null` for an empty cell, and for a container this build's corpus does not
   * carry — the bench then says so rather than printing `gem.g1-001` as if it were a name.
   */
  insertName: string | null;
};

/**
 * What one workbench operation did. ⛔ **Every magnitude here is the server's**: the spend, the
 * yield, the level and the roll chance all arrive resolved, and nothing in the client composes one.
 *
 * ⚠ `ok` is about whether the operation RAN, never about whether it went the player's way — a
 * failed enhance is `ok: true` with `outcome: "failure"`, because the materials were still spent
 * and the pity counter still moved. Rendering those two the same way is the defect the split
 * between `ok` and `outcome` exists to stop.
 */
export type WorkbenchOutcomeView = {
  ok: boolean;
  verb: WorkbenchVerb;
  /** The server's named rule when it refused; empty otherwise. Never rewritten in the client. */
  reason: string;
  instanceId: string;
  recipeId: string;
  opSeq: number;
  /** A retried correlation returns the RECORDED outcome; nothing is re-priced or re-rolled. */
  replayed: boolean;
  /** `success` | `failure` | `failure-downgrade` | `salvaged` | `upcycled` | the verb, for sockets. */
  outcome: string;
  enhanceLevel: Magnitude; // count
  pityCounter: Magnitude; // count
  /** `null` for every verb that rolls nothing — an absent chance, never a zero one. */
  successChance: Magnitude | null; // perMilleRatio
  spent: WorkbenchCostView[];
  granted: WorkbenchCostView[];
  sockets: WorkbenchSocketView[];
};

export type DominanceVerdict = "strictly-better" | "strictly-worse" | "sidegrade" | "incomparable";

/** A word AND a shape, never a colour alone — and the badge carries no colour to fall back on. */
export type VerdictBadgeView = {
  verdict: DominanceVerdict;
  label: string;
  shape: string;
};

export type ChannelDeltaView = {
  channel: ChannelId;
  incumbent: Magnitude;
  candidate: Magnitude;
  delta: Magnitude;
};

/** The unit lives in the GROUP HEADER, never in the column. An unresolvable unit gets its own group. */
export type UnitClassGroupView = {
  unit: UnitClass | null;
  deltas: ChannelDeltaView[];
};

export type SidegradeTradeView = {
  youGain: ChannelDeltaView[];
  youGiveUp: ChannelDeltaView[];
};

export type ComparePayloadView = {
  badge: VerdictBadgeView;
  groups: UnitClassGroupView[];
  /** Non-null only for a sidegrade: the verdict word alone says it is a trade, not which trade. */
  trade: SidegradeTradeView | null;
  /** Non-null only for an incomparable verdict — one with no explanation reads as a bug. */
  incomparableReason: string | null;
  meanRollQualityPerMille: number | null;
};

/** `core.v1.json`'s fifteen body roles plus the reserved commander slot. Closed, append-only. */
export type ItemRoleId =
  | "armament-primary"
  | "core-guard"
  | "ward-array"
  | "armament-secondary"
  | "jewel-major"
  | "manipulator"
  | "mantle"
  | "head-guard"
  | "girdle"
  | "sense"
  | "footing"
  | "infusion"
  | "retinue"
  | "jewel-minor-a"
  | "jewel-minor-b"
  | "standard";

export type PaperdollCellView = {
  role: ItemRoleId;
  /** The registry's own two frame nouns, both shown while no frame reaches the wire. */
  humanoidName: string;
  plantName: string;
  hybridEligible: boolean;
  /** `null` is an empty role, which is a designed state and not a blank. */
  instanceId: string | null;
  itemName: string | null;
  rarity: Rarity | null;
  /**
   * Which flow put this piece here — `"item"` for an owned instance assigned through
   * `POST /api/items/equip`, `"relic"` for one of the four hand-authored relics put there by
   * `PUT /api/unique/actors/{id}/equipment/{slot}`. `null` on an empty cell.
   *
   * ⛔ Not decoration: only an item cell may be taken off from the equip screen. A relic's write
   * path also rebuilds `mods_json` and its atom bindings, so unequipping one anywhere else would
   * leave both standing.
   */
  source: "item" | "relic" | null;
};

/**
 * One durable equip decision, as the equip screen reads it. The role is the fifteen-role vocabulary,
 * not the relic layer's three legacy slot words.
 */
export type EquipAssignmentView = {
  role: ItemRoleId;
  /** `"item"` is a rolled instance the player owns; `"relic"` is a catalog id from the older flow. */
  source: "item" | "relic";
  /** An `instance_id` for an item, a `container_id` for a relic. */
  refId: string;
  assignedUtc: string;
};

/**
 * What one equip or unequip did.
 *
 * ⚠ Unlike {@link WorkbenchOutcomeView} there is no second `outcome` axis, because equipping rolls
 * nothing: `ok` is the whole answer, and `reason` carries the server's named rule when it is false.
 */
export type EquipOutcomeView = {
  ok: boolean;
  verb: "equip" | "unequip";
  /** The server's named rule when it refused; empty otherwise. Never rewritten in the client. */
  reason: string;
  specimenId: string;
  role: ItemRoleId | null;
  refId: string;
  /** The piece this write displaced — swapped out on an equip, taken off on an unequip. */
  replaced: EquipAssignmentView | null;
  assignments: EquipAssignmentView[];
};

// ===========================================================================
// 3. Actor / specimen — Token · Chip · Row · Card · Panel
// ===========================================================================

export type ActorPhase = "ActiveBound" | "ActiveUnbound" | "Retired" | "Idle";

export type ActorChannelDetail = {
  channelId: ChannelId;
  value: number;
  unitClass: UnitClass;
  state: DerivedChannelState;
  cap?: { value: number; distance: number };
  composeSentence?: string;
  contributions: Pending<{ source: string; magnitude: Magnitude }[]>;
};

/** aura-skill T18c: one source's own contribution to a derived channel, as
 * `AuraDerivedEndpoints.cs` (T18b) reports it — flat and simple by design, unlike
 * `ActorChannelDetail.contributions`'s richer (still unproduced) `Magnitude`-based shape above. A
 * distinct type rather than forcing a field-name/shape fit onto that one. */
export type DerivedContribution = {
  sourceId: string;
  op: string;
  value: number;
};

export type ActorView = {
  instanceId: string;
  playerId: number;
  side: "plant" | "zombie";
  typeId: number;
  displayName: Pending<string>;
  phase: ActorPhase;
  level: number;
  xp: number;
  xpToNext: Pending<number>;
  revision: number;
  /** Summary rung: 6-8 non-default channels + "see all N" — spec-derived-stat-sheet.md §5.1. */
  channelSummary: Pending<ActorChannelDetail[]>;
  elementTyping: Pending<{ primary: ElementId; secondary?: ElementId }>;
  shieldStack: Pending<unknown>; // spec-shield-and-elements.md §3.1
  equipSlots: Pending<unknown>; // spec-equip-and-paperdoll.md
};

// ===========================================================================
// 4. Status — Token · Chip · Row (spec-derived-stat-sheet.md §6)
// ===========================================================================

export type StatusFamily = "power" | "resist" | "immune" | "immuneReduction" | "expose";

export type StatusView = {
  id: string; // e.g. "status.resist.dot"
  family: StatusFamily;
  name: Pending<string>;
  channel: Pending<ActorChannelDetail>;
};

// ===========================================================================
// 5. Element — Token · Chip. 6 concrete + omni (ActorElementTypes.cs).
// ===========================================================================

export type ElementId = "fire" | "ice" | "air" | "earth" | "light" | "dark";
export type ElementSlot = ElementId | "omni";

export type ElementMatchupCell = {
  attacker: ElementSlot;
  defender: ElementSlot;
  multiplierPerMille: number;
};

export type ElementMatrixView = {
  mode: "combat" | "shield" | "diff";
  cells: Pending<ElementMatchupCell[]>;
};

// ===========================================================================
// 6. Channel — Token · Chip · Row. Six-state model (spec-derived-stat-sheet.md §3).
// ===========================================================================

export type DerivedChannelState = "active" | "default" | "capped" | "stub" | "no-producer" | "unregistered";

export type ChannelView = {
  channelId: ChannelId;
  unitClass: UnitClass;
  state: DerivedChannelState;
};

// ===========================================================================
// 7. Resource — Token · Meter · Row. Runtime roster comes from resource-catalog.
// ===========================================================================

export type ResourceId = string;

export type ResourceView = {
  id: ResourceId;
  label: string; // faction-resolved (hunger -> Sun/Hunger, qi -> Yang/Yin)
  value: number;
  max: number;
  polarity: "positive" | "negative";
  exhausted: boolean;
};

// ===========================================================================
// 8. Power vector — Token · Chip · Card. definitions.md §7 — unbuilt server-side.
// ===========================================================================

export type PowerCategory = "offense" | "defense" | "utility" | "mobility" | "sustain";

export type PowerView = {
  scalar: Pending<number>; // rendered "≈ 1,300 (±25%)" — two sig figs + band (spec-comparison.md §2)
  categories: Pending<Record<PowerCategory, number>>;
};

// ===========================================================================
// 9. Sector / lane / legion — Token · Chip · Card · Panel (world-stage program).
//
// world-stage W4 (2026-09-04): the six views spec-world-contract.md §1 calls for, replacing the
// six-field vocabulary-only stub. Every magnitude a player would read as a quantity carries its
// `UnitClass` in the type (GG-46) — never a bare `number` for one of those. Identifiers, layout
// coordinates and booleans are not magnitudes and stay plain.
//
// **`loamUnits` — owner-authorised 2026-09-04 (world-numbers W37/W38, decisions.md's dated ADR
// row).** Every loam/component reading below carries `unit: "loamUnits"`, not `gameUnits` — see
// `adaptSector`/`adaptWorldForce` in `adapt.ts` for the one place these are actually constructed.
//
// **The `…Milli` fracture reading — `Magnitude.op` gains `absolute` (same authorisation), not a
// divide-at-the-adapter.** `FractureIntensityMilli`'s neutral baseline is 1000
// (`WorldDtos.cs:80`); the verified defect (a raw 1400 rendering ×2.40 instead of ×1.40) is fixed by
// `formatPerMille`'s own new `absolute` arm (`×(value/1000)`, no delta), so the adapter passes the
// wire value straight through — never subtracting 1000 first, which would just move the same
// derived-in-TypeScript problem `spec-loam-fe.md` forbids one line over.
// ===========================================================================

/** `dave` sees the whole picture; anyone else sees exactly this ladder — `IntelLadder.StateOf`. */
export type IntelState = "Unknown" | "Rumored" | "Scouted" | "Watched";

/**
 * The additive operands of `LoamUpkeep.For` (`LoamUpkeep.cs:40`) — **not a design choice**.
 * Four rode the signature's own argument list (`base` is the function's own first line);
 * `wonderUpkeep` is the fifth term `BreakdownFor` adds (wonder-wire §Design 3, plan Task 4A.4) —
 * `ModifierLedger`'s whole job is reproducing the five-term sum through the four-factor Total
 * exactly. The fifth ledger ROW stays wonder-display's module; the operand lands here.
 */
export type UpkeepBreakdownView = {
  base: Magnitude; // loamUnits
  garrison: Magnitude; // loamUnits
  development: Magnitude; // loamUnits
  danger: Magnitude; // loamUnits
  /** wonder-wire §Design 3 — this sector's Wonder upkeep, straight off the server breakdown. */
  wonderUpkeep: Magnitude; // loamUnits
  intensityMilli: Magnitude; // perMilleRatio, op "absolute"
  handicapMilli: Magnitude; // perMilleRatio, op "absolute"
};

export type SectorView = {
  sectorId: string;
  /** `string` since v2 — the wire is `WorldSectorDto.TypeId: string` (.NET-cased id), not a number. */
  typeId: string;
  climate: string | null;
  ownerFactionId: string | null;
  /**
   * The rendering must branch on `intel`, never on emptiness — an unseen sector serialises every
   * other field at its record default (`WorldEndpoints.cs:271-277`) and is indistinguishable from a
   * zeroed known one except by this field.
   */
  intel: IntelState;
  /** Turns since last seen; 0 while `intel === "Watched"`. */
  intelAge: number;
  phase: string;
  dangerBand: Magnitude; // count
  developmentLevel: Magnitude; // count
  stability: Magnitude; // perMilleRatio, op "flat" — 0..1000 is 0..100%
  /**
   * Found missing 2026-09-04 (world-inspector W63, the third stale "never assigned" premise found
   * this task alone): `LoamPhases.NextPressure` writes this every turn from fade contagion
   * (`LoamPhases.cs:190,203,266-291`) — real, live state, not a stub. `pressureMilli` was already on
   * the wire DTO mirror (`lib/bus/world.ts`) but never reached this view contract at all.
   */
  pressure: Magnitude; // perMilleRatio, op "flat"
  /** `op: "absolute"` — see the module comment above. Always present; 1000 = neutral. */
  fractureIntensity: Magnitude; // perMilleRatio, op "absolute"
  habitable: boolean;
  layoutX: number;
  layoutY: number;
  loam: {
    production: Magnitude; // loamUnits
    upkeep: Magnitude; // loamUnits
    net: Magnitude; // loamUnits
    stock: Magnitude; // loamUnits
    /** `world-wire`'s `EffectiveCapacity` projection — the stock figure's own denominator. */
    capacity: Pending<Magnitude>;
    /**
     * The five operands `LoamUpkeep.For` sums, in that function's own signature order
     * (`LoamUpkeep.cs:40`) — `world-numbers` W41's `ModifierLedger` reads this, never re-derives it.
     * Found missing from the wire mirror 2026-09-04, projected server-side since `WorldEndpoints.cs
     * :490-497` (world-stage W10) — genuinely on the wire, not a `Pending` gap.
     */
    upkeepBreakdown: UpkeepBreakdownView;
  };
  /** Non-null only for a sector inside a connected territory component; totals are pooled. */
  component: {
    componentId: string | null;
    production: Magnitude; // loamUnits
    upkeep: Magnitude; // loamUnits
    net: Magnitude; // loamUnits
    stock: Magnitude; // loamUnits
  };
  willReleaseNextTurn: boolean;
  /** Opt-in server sweep (`?lifelines=true`) — absent, not merely zero, when the caller didn't ask. */
  lifelineCost: Pending<Magnitude>;
  lifeline: Pending<boolean>;
  wardenBindingId: Pending<string | null>;
  neglectedTurns: Pending<Magnitude>; // count
  /**
   * wonder-wire §Design 3 (plan Task 4A.4) — live raised Unique Wonders of Sector scope in THIS
   * sector, built + under-construction. Owner-only, structurally zero for unowned/unseen ground.
   * `Common` is deliberately absent (never scanned — reads 0).
   */
  wonderLiveCountSector: Magnitude; // count
  /** Same producer with Empire scope across the viewer's holdings — identical on every sector of
   * one faction, 0 for unowned/unseen. */
  wonderLiveCountEmpire: Magnitude; // count
  /**
   * This sector's Wonder-attributable production (GG-49 — no mystery delta):
   * stored-modifier output minus the identity call, 0 for a Wonder-free faction.
   */
  wonderProductionContribution: Magnitude; // loamUnits
};

export type LaneView = {
  laneId: string;
  fromSectorId: string;
  toSectorId: string;
  typeId: string;
  length: Magnitude; // count — a march-turn measure, not a per-mille ratio
  width: Magnitude; // count
  hazard: Magnitude; // perMilleRatio, op "flat"
  wardLevel: Magnitude; // count
  state: string;
  /** Real gap, not merely unwired — `GateKeyId` does not exist on the C# contract yet. */
  gateKeyId: Pending<string | null>;
};

export type LegionMemberRole = "Fighter" | "Bearer";

export type LegionMemberView = {
  instanceId: string | null;
  speciesId: string;
  level: Magnitude; // count
  hp: Magnitude; // gameUnits
  wounds: Magnitude; // gameUnits
  /** Bearer count is the only input to a legion's carrying capacity — not on the wire yet. */
  role: Pending<LegionMemberRole>;
};

/** Exactly one of `atSectorId` or the `onLane*` triple is set — never both, never neither. */
export type LegionPosition =
  | { kind: "sector"; sectorId: string }
  | { kind: "lane"; laneId: string; towardSectorId: string; progress: Magnitude /* perMilleRatio, flat */ };

export type LegionView = {
  entityId: string;
  kind: string;
  ownerFactionId: string;
  position: LegionPosition;
  stance: string;
  /** The name says nothing about its unit by itself — it is per-mille of one turn's march budget. */
  movementRemaining: Magnitude; // perMilleRatio, op "flat"
  routed: boolean;
  members: LegionMemberView[];
  carriedLoam: Pending<Magnitude>;
  capacity: Pending<Magnitude>;
  burn: Pending<Magnitude>;
  /** Turns until this legion runs dry at its current burn; `null` when burn is not positive. */
  runway: Pending<number | null>;
};

export type SlotView = {
  slotIndex: number;
  slotTypeId: string;
  element: string | null;
  state: string;
  ownerFactionId: string | null;
  guardWaveId: string | null;
  guardState: string;
  structureId: string | null;
  constructionTurnsRemaining: Pending<number | null>;
  /**
   * wonder-wire §Design 2 (plan Task 4A.4) — the Wonder facet without a second fetch per slot:
   * the scope/rarity of the slot's own catalog row, `null` for empty slots, unknown ids and
   * non-Wonder rows. Fog-parity with `structureId` — as visible as the slot itself. Plain
   * `string | null`, never `Pending`: the wire always sends it, so there is no "not yet" state.
   */
  wonderScope: string | null;
  wonderRarity: string | null;
};

/**
 * A band is a fog artefact, never a stand-in for a real count — the discriminated union makes
 * reading `strength` off an inexact force a compile error rather than a UI that quietly lies.
 */
export type ForceView =
  | { entityId: string; ownerFactionId: string; kind: string; exact: true; strength: Magnitude }
  | { entityId: string; ownerFactionId: string; kind: string; exact: false; bandName: string; bandCeiling: Magnitude };

export type TurnEventView = {
  sectorId: string | null;
  phase: string;
  kind: string;
  subject: string;
  detail: string;
  /** `world-playback`'s one translation table owns filling this; never a second copy. */
  sentence: Pending<string>;
};

// ===========================================================================
// 10. Contract — the SSOT's "Creature + contract" rung. Chip · Row · Card · Panel.
//     DTO-grounded already (ContractRowDto + CreatureProfileDto joined by
//     instanceId) — the gap here is compositional, not missing fields.
// ===========================================================================

export type ContractView = {
  instanceId: string;
  speciesId: string;
  rarity: string;
  bound: boolean;
  loyalty: number;
  rank: string;
  personality: string;
  upkeepPerDay: number;
  deployable: boolean;
  displayName: Pending<string>; // species catalog name, joined separately (CreatureCatalogDto)
};

// ===========================================================================
// 11. Run / wave — Row · Card.
// ===========================================================================

export type RunResult = "victory" | "defeat" | "abandoned" | "unknown";

export type RunView = {
  id: number;
  levelName: Pending<string>;
  result: RunResult;
  startedUtc: string;
  endedUtc?: string;
  zombiesKilled: Pending<number>;
  plantsLost: Pending<number>;
  /** `RunItem.summary`/`.modifiers` are typed `unknown` server-side today — prime Pending candidates. */
  summary: Pending<unknown>;
};

// ===========================================================================
// Commander list — GET /api/commanders/{playerId} (commander-surface P1)
// ===========================================================================

export type CommanderListRow = {
  id: string;
  displayName: string;
  isDefault: boolean;
  activeAuraId: string | null;
  activeAuraName: string | null;
  locationStub: string | null;
  legionStub: string | null;
  equipment?: { instanceId: string; containerId: string; role: string } | null;
};

export type OnboardingCheckpoint = {
  checkpointId: string;
  state: string;
  earnedRunId: number | null;
  rewardRef: string | null;
  payloadJson: string | null;
  earnedUtc: string;
  claimedUtc: string | null;
  revision: number;
};

export type OnboardingStory = {
  storyId: string;
  version: number;
  state: "unseen" | "acknowledged" | string;
  outcome: "completed" | "skipped" | null | string;
  eligible: boolean;
  acknowledgedUtc: string | null;
  revision: number;
};

export type OnboardingState = {
  playerId: number;
  playerLevel: number;
  revision: number;
  checkpoints: OnboardingCheckpoint[];
  stories: OnboardingStory[];
};

export type CommanderListView = {
  defaultLawnCommanderId: string;
  commanders: CommanderListRow[];
};

/** Commander drill-in context for ActorPanel — not part of ActorView (commander-sheet-role). */
export type CommanderSheetMeta = {
  isDefault: boolean;
  activeAuraName: string | null;
  locationStub: string | null;
  legionStub: string | null;
};

// ===========================================================================
// 11. Battle turn order — forecast-rail (battle-tempo FR2/FR3). Mirrors
//     FusionRpg.Core.Battle.Timeline.TurnOrderEntry field-for-field (parity
//     guarded — see ClassSystem/TurnOrderRecordContractParityTests.cs). A
//     RECORD of an already-resolved battle, never a live forecast (spec
//     spec-forecast-rail.md §2.0) — round + a display name only. No
//     actorKey, no tick numbers, no TurnState: engine vocabulary never
//     reaches this type (§2.4).
// ===========================================================================

export type TurnOrderEntry = {
  round: number;
  displayName: string;
};

// ===========================================================================
// 12. Delve — the sixteen view types (party-dungeon D5.3, spec-delve-stage.md §6).
//
// Real field shapes were read directly off the shipped C# (not guessed): `DelveEndpoints.cs`'s own
// `HandleGetDelve` (D5.2, `GET /api/delve/{delveId}`) for DelveView/RoomView/DoorView/PartyView;
// `DelveMemberState` for MemberView; `PackDto`/`PackCellDto` for PackView/PackCellView; `QuestDto`
// for QuestView; `DomainOfferDto` for DomainOfferView/RungOfferView. `formatMagnitude` has no
// bare-`number` overload (GG-46), so every field below that is a rendered quantity is a `Magnitude`;
// every field that is an id, an index, a flag or already a display name stays a plain primitive.
//
// **Two enums reach `HandleGetDelve`'s own wire as raw ints, confirmed field-for-field**:
// `SectorSight` (`DelveProjectionRoom.Sight`) and `LaneState` (`DelveProjectionDoor.State`) are never
// `.ToString()`'d before serialising (unlike `WorldEndpoints.cs:704`'s own `State = l.State.ToString()`
// for the *same* `LaneState` enum on a world lane — a real, different choice made by a different
// endpoint, not a precedent this module's adapter can copy). `adapt.ts`'s `toDelveSight`/`toLaneState`
// translate the raw ordinal to the C#-member-name string, matching `IntelState`/`ActorPhase`'s own
// established convention of keeping the wire enum's PascalCase name verbatim in the view (the English
// phrase — "unlit"/"glimpsed"/"seen" per §7 — is `labels.ts`'s translation, D5.10, not this layer's).
//
// **Six of the sixteen types have no complete, real producer to adapt from, named per type below
// rather than guessed shut.** The spec's own §6/§18 interface table cites several C# signatures that
// do not exist in the shipped tree — confirmed independently, before this task, by comments already
// sitting in `DelveWildEndpoints.cs`, `RpgStore.Delve.cs`, `QuestProgress.cs` and `AmbushDraw.cs`
// (`TalkTree.Step`/`TalkStep`, `EventResolution`, `EventDeck`, `OfferedQuest{QuestId,Need}`,
// `DelveLoot.AtExtraction` all confirmed absent by direct grep). Building an adapter against an
// invented shape, or gluing several real Core functions into one result an adapter decides on its
// own, would be exactly the "second implementation" / "adapters compute nothing" defect this file's
// item-module-10 section already states as a rule (line ~583) — so those six types are declared in
// full (every field `Pending<T>` with the real reason) and left without a same-named adapter, rather
// than shipped against a guessed contract.
// ===========================================================================

/** `SectorSight`'s own C# member names, verbatim — `Visibility.cs:6-16`. */
export type DelveSightState = "None" | "Glimpse" | "Full";

/** `LaneState`'s own C# member names, verbatim — `WorldState.cs:51-55` (shared with the world map). */
export type DelveDoorState = "Open" | "Severed";

/**
 * One room, sight-gated exactly as `DelveProjection.cs`'s `ProjectRoom` computes it: every content
 * field below is `null` at `sight: "None"`; `kind` alone is populated at `"Glimpse"`; every field is
 * populated at `"Full"` (`SectorSight.None`'s own doc comment: "position and lanes only"; §7:
 * "a glimpsed room names its kind only"). `sectorId`/`rowIndex`/`colIndex`/`visited`/`cleared`/
 * `keyForLaneId` are never sight-gated — structural graph shape, not contents.
 */
export type RoomView = {
  sectorId: string;
  rowIndex: number;
  colIndex: number;
  visited: boolean;
  cleared: boolean;
  keyForLaneId: string | null;
  sight: DelveSightState;
  kind: string | null;
  archetypeId: string | null;
  eventId: string | null;
  resolvedKind: string | null;
  resolvedArchetypeId: string | null;
  /**
   * `DelveRoomStateFact.FloorJson` — real on the wire (gated the same as the other content fields),
   * but an opaque persisted JSON blob with no structured view spec'd anywhere in spec-delve-stage.md
   * (§5's "the floor list" names `PackView.floor` instead — a *different* field, the party's own
   * dropped-item list, not a room's). `Pending`, not omitted, matching `RunView.summary`'s own
   * identical "real blob on the wire, no view shape yet" precedent.
   */
  floorContents: Pending<unknown>;
};

/** A lane/door — never sight-gated (`SectorSight.None`'s own "position and LANES only" clause). */
export type DoorView = {
  laneId: string;
  fromSectorId: string;
  toSectorId: string;
  typeId: string;
  gateKeyId: string | null;
  state: DelveDoorState;
};

/**
 * One party member. `DelveMemberState` carries only a pointer (`InstanceId`) — no species or level
 * (those live on the roster's own `UniqueActor` row, not here; confirmed by reading the record).
 */
export type MemberView = {
  instanceId: string;
  /** `DelveMemberState.Pools` — current values only, keyed by the six resource ids (resource-hub:
   * hp/stamina/hunger/spirit/qi/poise). `count`, never signed — a stock, not a delta. */
  pools: Record<ResourceId, Magnitude>;
  /**
   * A pool's maximum has no producer joined onto this record — it lives on the actor's own derived
   * channel sheet, which `ActorView.channelSummary` already carries as `Pending` for the identical
   * reason (no live read wires a specimen's derived channels to a delve member yet). Pool *fill*
   * (`perMilleRatio`, `flat` — §6's own row) needs this as its denominator, so it is `Pending` too,
   * for the same cause, not a second, unrelated gap.
   */
  poolMax: Pending<Record<ResourceId, Magnitude>>;
  poolFill: Pending<Record<ResourceId, Magnitude>>;
  /** Structural only — §6: nerve stage is "not a number... a name from §8", and this raw stack count
   * is never itself the rendered figure. Kept as a plain `number`, matching `layoutX`/`partyIndex`'s
   * own "positional, not a Magnitude" precedent, not wrapped — wrapping it would invite exactly the
   * bare-nerve-number rendering §6 forbids. */
  nerveStacks: number;
  /** The display name (`Unsettled`/`Shaken`/`Afflicted`, `bands.v1.json`'s own `nerveStage` band) —
   * needs `NerveLadder.StageFor(stacks, spiritResolved, thresholds)`, external inputs this record
   * doesn't carry alone. No endpoint composes this yet. */
  nerveStage: Pending<string>;
  downed: boolean;
  downedOnce: boolean;
  /** Real fields on `DelveMemberState` (`BattleInnateShield?`, `BattleStatusSpec[]`) — out of this
   * stage's own HUD scope (§7 names only "six pool meters and nerve stage per member"), mirroring
   * `ActorView.shieldStack`'s own identical "not this surface's job yet" posture. */
  shield: Pending<unknown>;
  statuses: Pending<unknown>;
};

/**
 * One raid party, joining `DelvePartyState` (route/members/pack/haul) with its live
 * `DelveProjectionPartyPosition` (position) by `EntityId` — **not by array index**:
 * `DelveProjection.cs`'s own `parties` list is `.OrderBy(p => p.EntityId)`, so the position array's
 * order does not match `delve.Parties`' own order; `adaptDelve` joins the two by id.
 */
export type PartyView = {
  /** The array position in `delve.Parties` — never rendered raw (§8: `PartyIndex` "never rendered").
   * `labels.ts` (D5.10) turns this into *First/Second/Third/Fourth Banner*. */
  partyIndex: number;
  entityId: number;
  /** `null`/`null` before any entity is wired into a real delve's `WorldState` — D5.2's own named,
   * still-real gap ("no real delve wires party entities into `WorldState` yet"), not new here. */
  atSectorId: string | null;
  onLaneId: string | null;
  /** Sector ids already walked — structural, not a Magnitude. */
  route: string[];
  members: MemberView[];
  /**
   * `HandleGetDelve` sends `delve.Parties[].Pack` — the raw, un-projected `DelvePartyPackState`
   * (`{rows, cols, cells: [{row, col, item}]}`), never `PackDtoProjection.Project`'s own richer
   * `PackDto` (`movable`/`floor`/`provisionCellsLeft`). `PackDtoProjection.Project` is real and
   * tested (`PackDtoTests.cs`) but has zero production callers and no route serves it — the same
   * "provably correct, no live trigger" posture this program uses elsewhere. `Pending` until a route
   * wires the projection onto this field or a sibling one.
   */
  pack: Pending<PackView>;
  /** `DelveHaulEntry[]` — pending altar pulls, real and structural (D4.8). No dedicated view type:
   * the shape is small, stable and inlined here rather than adding a 17th named export. */
  haul: {
    kind: string;
    speciesId: string;
    rarity: string;
    variant: string;
    traitIds: string[];
    row: number;
    col: number;
    n: number;
  }[];
};

/** The whole projection `GET /api/delve/{delveId}` returns (D5.2's `HandleGetDelve`). */
export type DelveView = {
  delveId: number;
  worldId: string;
  /** `DelveStates`: `"Active" | "Extracted" | "Wiped" | "Archived"` — an id, translated by `labels.ts`. */
  state: string;
  domainId: string;
  raidMode: string;
  rungId: string;
  /** `count`; see `Magnitude.exact`'s own doc comment for the named, real gap in how far this field's
   * precision survives the wire today. */
  soulsUnbanked: Magnitude;
  rooms: RoomView[];
  doors: DoorView[];
  parties: PartyView[];
  revision: number;
  /**
   * `HandleGetDelve` sends `delve.QuestsJson` as a raw JSON string — never parsed into `QuestDto[]`
   * (that needs `QuestProgress.Evaluate` + `QuestDtoProjection.Project`, neither of which this
   * endpoint calls). `Pending` rather than exposing the opaque blob, matching `RunView.summary`.
   */
  quests: Pending<QuestView[]>;
  // `contentTermsJson` is deliberately not carried onto this view at all (not even `Pending`): §10
  // frames "frozen terms" as server-internal only — "the rule id reaches the developer tree only" —
  // so it is not a future player-facing field, and declaring it `Pending` would misstate that it is.
  // `thetaRun` is the same deliberate omission for a different, sharper reason: §8's own vocabulary
  // table lists `theta_run` under "never sent" on the wire, yet `HandleGetDelve` (D5.2, already
  // shipped) *does* send `thetaRun = delve.ThetaRun` — a real, evidenced contradiction between the
  // shipped D5.2 response and this very spec section. This view follows §8 (the contract-layer rule
  // this task is scoped to enforce) and does not surface it; the wire's own over-sending is a
  // `DelveEndpoints.cs`-side fact this task's Files line does not reach.
};

/** `PackDto.Cells`/`.Floor` — `PackDtoProjection.ToDto`'s own `Origin.ToString()` sends PascalCase
 * (`"CarryIn"`/`"Haul"`), translated here to the view's lower-camel form. */
export type PackItemOriginView = "carryIn" | "haul";

/** One `PackCellDto` — landed ask 5's own `movable` flag included (spec-loot-pack.md:226). */
export type PackCellView = {
  row: number;
  col: number;
  w: number;
  h: number;
  kind: string;
  refId: string;
  qty: Magnitude; // count
  origin: PackItemOriginView;
  movable: boolean;
};

/** `PackDto` (`PackGrid.cs`) — real and tested (`PackDtoTests.cs`), but `PackDtoProjection.Project`
 * has zero production callers and no HTTP route serves it yet (confirmed by grep); see `PartyView
 * .pack`'s own doc comment. `adaptPack` is built and tested against a hand-built fixture matching
 * this real shape, ready for the day a route wires the projection. */
export type PackView = {
  rows: number;
  cols: number;
  cells: PackCellView[];
  floor: PackCellView[];
  provisionCellsLeft: Magnitude; // count
};

/**
 * Verbs `TalkTree.Offered(step, maxSteps, eligibility)` actually offers — the only real, shipped
 * output on the wild-talk surface. **`TalkTree.Step`/`TalkStep` (the spec's own cited source for a
 * turn's resolved band/quote/outcome, `spec-wild-room.md:402`) does not exist** — confirmed absent by
 * reading `TalkTree.cs` in full, and independently flagged the same way already, before this task, in
 * `DelveWildEndpoints.cs:18-21` and `RpgStore.Delve.cs:1085`. Every field past `offered` is honestly
 * `Pending` rather than glued together from unrelated pieces.
 */
export type TalkView = {
  /** `WildVerb`'s own C# member names (`"Flatter" | "Threaten" | "OfferSouls" | "OfferSpirit" |
   * "OfferSupply" | "OfferContract" | "Fight" | "Leave"`) — ids, translated by `labels.ts`. */
  offered: string[];
  effectiveBand: Pending<string>;
  quote: Pending<string>;
  decision: Pending<unknown>;
};

/**
 * **No adapter exists for this type** (see `adapt.ts`'s own module comment on why). `EventResolution`
 * and `EventDeck` — the spec's own cited source (`spec-event-deck.md:421`) — do not exist anywhere in
 * `.cs` source (confirmed by grep across the whole tree). The real pieces (`EventRow`,
 * `EventChoices.Presented`, `AmbushOutcome`, `DelveBanner`) are separate, untied Core functions with
 * no orchestrator gluing them into one apply-transaction result; composing one in this adapter layer
 * would be deciding new business logic no Core function has decided, the one thing an adapter must
 * never do. Every field is `Pending`, honestly, until that orchestrator ships.
 */
export type EventView = {
  eventId: Pending<string>;
  kind: Pending<string>;
  choices: Pending<string[]>;
  banner: Pending<{ bannerId: string; durationMs: Magnitude }>;
  warnings: Pending<string[]>;
};

/**
 * `RoomObjectBuilder.For(...)`'s real output — `verbs` is **offered-only**, no per-verb
 * enabled/disabled+reason: that shape (`VerbOutcome`, via `VerbResolver.Resolve`) is computed
 * per-attempt (needs `alreadySpent`/`breakMode`/`structureHpBand`, attempt-time context a batch
 * prompt-construction pass doesn't have), not as a precomputed batch a single adapter call can build.
 * §10's own rule ("a refusal the client can predict is a disabled control carrying its reason") is
 * therefore not yet satisfiable for a room-object verb from this adapter alone — named, not guessed.
 */
export type ObjectPromptView = {
  sectorId: string;
  /** `ObjectKind`: `"Curio" | "Obstacle" | "Building" | "Structure"`. */
  kind: string;
  verbs: string[];
  oneShot: boolean;
};

/**
 * `SupplyUse.Use(...)`'s real outcome shape — the only real Core function on this surface.
 *
 * ⚠ **A named ambiguity, not silently resolved either way**: §7 describes `SupplyView` as a *browse*
 * panel ("what the party carries that can be used here"), but no "list what's usable here" producer
 * exists anywhere — `SupplyUse.Use` is an *act* (spend a supply, now), not a listing read, and its own
 * `Decision` field is C#-typed `object?` (an anonymous literal at its one real call site,
 * `SupplyUse.cs:56`), so no declared shape exists to mirror there either. This type models the act's
 * outcome (the one real thing on this surface), matching `WorkbenchOutcomeView`'s own "outcome, not
 * browse" shape — whether a future browse-panel read needs a *different* type is this task's own
 * genuine open question, not resolved here.
 */
export type SupplyView = {
  ok: boolean;
  reason: string;
  decrementContainerId: string | null;
  decision: Pending<unknown>;
};

/**
 * **No REST adapter exists for this type — still true after D5.11's 2026-09-08 live-push wave, though
 * the reason is narrower now.** What changed and what did not, checked fresh against the working tree:
 *
 * - `RpgHub.cs` no longer "carries zero delve/battle-session messages" — it now has real CLIENT→SERVER
 *   calls (`Steer`, `Declare`, built by D2.16) AND real SERVER→CLIENT pushes (`DelveDeclared`,
 *   `DelveFightFrozen`, `DelveTurnStarted`, `DelveResumed`, `DelveReplayConsumed` — the wire vocabulary
 *   `gk-core/src/FusionRpg.Server/DelveLivePush.cs` names and `stages/delve/liveSession.ts` now consumes).
 * - What is STILL true: this type is populated by `adaptDelve` from a single REST snapshot
 *   (`GET /api/delve/{delveId}`, `DelveResponseDto`) that carries no delve-battle-session field and no
 *   `matchKey` correlating a room to a live fight — `adaptDelve` has no way to know which room's live
 *   session (if any) to read, let alone subscribe to. Wiring `dwellRemaining`/`frozen` to the real
 *   pushes above would mean composing this one-shot REST snapshot with a live SignalR subscription keyed
 *   by a `matchKey` this DTO does not carry — a UI-wiring task (the still-unbuilt live `FightInputPanel`
 *   consumer that would actually hold a `matchKey`), not a one-line adapter fix, and out of this wave's
 *   scope (`liveSession.ts`'s own doc comment: "transport layer only... does NOT wire a real UI
 *   consumer").
 * - `initiative`/`strikeFeed` remain genuinely unproduced, unchanged by this wave: no "strike feed" DTO
 *   exists anywhere (`BattleTrace` is a debug/golden-hash replay log, not a structured live-UI feed).
 *
 * The real primitives this adapter would need (`DelveBattleSession`, `DecisionTrace`,
 * `DelveBattleSessionManager`) are session/timeline plumbing one layer below a delve-fight VIEW shape —
 * assembling one here would still be inventing the missing composition, not reading a field that exists.
 */
export type FightView = {
  dwellRemaining: Pending<Magnitude>; // milliseconds
  initiative: Pending<unknown[]>;
  strikeFeed: Pending<unknown[]>;
  frozen: Pending<boolean>;
};

/** `QuestDto` (`QuestDtoProjection.Project`) — real, shipped, matches the spec's own cited source
 * (`spec-delve-quests.md:341`) exactly. */
export type QuestView = {
  name: string;
  flavor: string;
  have: Magnitude; // count
  need: Magnitude; // count
  done: boolean;
};

/**
 * Composes two independently-real, already-fully-decided Core outputs — `ExtractionSettlement.Decide`
 * (per member) and `DelveSoulLedger.AtExtraction` (per raid) — reshaping, not deciding anything new.
 * `MemberSettlement` itself carries no member id (`Outcome`/`RecoverDelves`/`Won` only), so
 * `adaptExtraction` takes an explicit `instanceId` alongside each settlement from its caller, the
 * same positional-join shape `PartyView`'s own `partyIndex` needs for the identical reason.
 *
 * **No unified "extraction result" producer exists** — confirmed: `ExtractionSettlement`,
 * `DelveSoulLedger` and `DelveLoot.InstantiateBossFirstClearGrant` (first-clear grants) are three
 * separate producers with no glue; "level-ups" and "joins" (§7's "Drops · level-ups · a wild creature
 * joining · a first clear") have no producer anywhere at the extraction boundary at all. Every one of
 * those stays `Pending`, named, rather than invented.
 */
export type ExtractionView = {
  members: { instanceId: string; outcome: string; recoverDelves: Magnitude; won: boolean }[];
  /** `ExtractionEarn.Kills`/`.Victory` — kept as the two figures the server actually separates,
   * rather than pre-summed here (that would be arithmetic on a figure in the client, §16's own
   * "never" list). */
  soulsFromKills: Magnitude; // count
  soulsFromVictory: Magnitude; // count
  wiped: Pending<boolean>;
  firstClearGrant: Pending<unknown>;
  levelUps: Pending<unknown[]>;
  joins: Pending<unknown[]>;
};

/** One `DomainRungOfferDto` or `DomainTailOfferDto` — the two real, differently-shaped wire rows
 * `DomainOffers.For` nests inside `DomainOfferDto.Rungs`/`.TailSteps`. A discriminated union rather
 * than forcing one shape or fabricating fields the other row doesn't have. */
export type RungOfferView =
  | { kind: "rung"; rungId: string; label: string; bandName: string; oathOffered: boolean; permadeath: boolean }
  | { kind: "tail"; n: Magnitude /* count */; label: string; bandName: string };

/** `DomainOfferDto` (`DomainOffers.cs`) — real, shipped, matches the spec's own cited source
 * (`spec-domain-catalog.md:380`). `entryKey` is narrowed to §8's own two vocabulary ids; an
 * unrecognised wire value falls back to `"standing"` (the non-locking, more permissive reading)
 * rather than silently miscasting a `once`-entry domain as open-ended. */
export type DomainOfferView = {
  domainId: string;
  name: string;
  flavor: string;
  climate: string;
  entranceLabel: string;
  entryKey: "single-descent" | "standing";
  sealed: boolean;
  resume: { delveId: number } | null;
  rungs: RungOfferView[];
  tailSteps: RungOfferView[];
  raidModes: string[];
  bossName: string;
  cleared: string[];
  /** Real field on the wire DTO (landed ask 6) — always empty in production today, since
   * `ProvisionableFor` throws `NotImplementedException` unconditionally and is unreachable while
   * `dungeon_domain` has no write arm (D4.16). Not `Pending`: an empty array is the honest, valid
   * current state of a real field, not a missing one. */
  provisionable: { containerId: string; label: string; price: Magnitude; cells: Magnitude }[];
};

// ===========================================================================
// 13. Empire inventory — claim endpoints (empire-inventory-surfaces `claim-endpoints`,
//     plan Task 4A.3). The three views the wave-2 surfaces (`legion-sheet` cargo tab,
//     `storage-cache-ui` claim flow) bind to.
//
// Additive-only like every section above (no CONTRACT_VERSION bump — every addition is a new
// type, never a rename or a narrowing). Every magnitude a player would read as a quantity
// carries its `UnitClass` (GG-46): weights ride `count` (mass units counted — no mass class
// exists in the twelve/thirteen, and inventing a unit here would be the second-implementation
// defect the ladder exists to prevent), slots/counts ride `count`.
// ===========================================================================

/** The closed two-kind split every overlay table uses (`'instance'` | `'stack'`). */
export type CargoRowKind = "instance" | "stack";

/** One cargo row aboard a legion, exactly as the server snapshots it. */
export type CargoRowView = {
  seq: number;
  kind: CargoRowKind;
  instanceId: string | null;
  containerId: string | null;
  qty: number | null;
  weightEach: Magnitude; // count — the snapshotted single/per-unit mass
  rowWeight: Magnitude; // count — stack: qty × weightEach, else weightEach
};

/**
 * One legion's cargo — `legion-sheet`'s cargo tab binds rows + used/capacity. The fold owns the
 * two fractions (computed from the four numbers, `null` when the denominator is not positive);
 * nothing here recomputes capacity (spec-loam-fe.md's own rule, ideal §2.7).
 */
export type CargoView = {
  worldId: string;
  entityId: string;
  asOfTurn: number;
  rows: CargoRowView[];
  weightUsed: Magnitude; // count
  weightCapacity: Magnitude; // count
  /** `weightUsed / weightCapacity`, or `null` when capacity is not positive. */
  weightFraction: number | null;
  slotsUsed: Magnitude; // count
  slotCapacity: Magnitude; // count
  /** `slotsUsed / slotCapacity`, or `null` when capacity is not positive. */
  slotFraction: number | null;
};

/** One vault row — the cargo row shape minus weight (storage is slot-gated by design). */
export type VaultRowView = {
  seq: number;
  kind: CargoRowKind;
  instanceId: string | null;
  containerId: string | null;
  qty: number | null;
};

/**
 * One sector's vault — the storage panel block binds rows + room. `ownerFactionId` is the live
 * read and the capture-header input (claim-endpoints §Design 5: the vault header always shows
 * "held by X"); `room` is what still fits (`capacity − used`, never below zero on the dial —
 * the server is the source of truth, this is a display floor, not a clamp of game state).
 */
export type VaultView = {
  worldId: string;
  sectorId: string;
  ownerFactionId: string | null;
  asOfTurn: number;
  rows: VaultRowView[];
  slotsUsed: Magnitude; // count — row count, never summed qty
  slotCapacity: Magnitude; // count — `SectorItemCapacity.EffectiveCapacity`
  /** `slotsUsed / slotCapacity`, or `null` when capacity is not positive. */
  slotFraction: number | null;
  /** `slotCapacity − slotsUsed` — the room the panel block renders. */
  room: Magnitude; // count
};

/**
 * One fallen cache the querying legion can reach — the wave-2 `cache-pin` binds presence +
 * count. Count-only, never contents (hidden-until-found: unreachable caches are absent, not
 * masked — and this view carries no legion position to compare, so no client-side fog logic
 * can be built on it even by accident).
 */
export type CachePinView = {
  cacheId: string;
  /** Closed: the only two kinds the verb serves (`world_sector` | `world_lane`). */
  placeKind: "world_sector" | "world_lane";
  placeRef: string;
  sourceKind: string;
  itemCount: Magnitude; // count — row count only, never the manifest
  createdUtc: string;
};

/** The presence-gated listing — one legion's pins plus the staleness marker. */
export type CachePinListView = {
  worldId: string;
  entityId: string;
  /** The world's `CurrentTurn` at read time — a staleness marker for the pin layer, not a
   * cache: movement next turn can strand a pin, so pins re-read per selection. */
  asOfTurn: number;
  pins: CachePinView[];
  /** Live per-act claim price, carried from the listing response — the AP slot binds this. */
  claimCostMilli: number;
};

/**
 * The closed reason/message vocabulary the folds map to authored copy (claim-endpoints §Design 5,
 * GG-62 — player sentences are wave 2's authored copy, owned elsewhere; this union is the key
 * list that copy is authored against, never a new string invented at implementation).
 * `correlation.missing` is named, never produced by the filer (unreachable-on-this-path) — listed
 * so the fold never authors copy for it by accident.
 */
export type ClaimCopyKey =
  | "ok"
  | "cache.claimed"
  | "cache.unreachable"
  | "cargo.over-weight"
  | "cargo.no-slots"
  | "cargo.not-present"
  | "cargo.wrong-faction"
  | "cargo.sector-full"
  | "cargo.not-found"
  | "cargo.cross-empire"
  | "cargo.not-owned"
  | "correlation.missing";

// ===========================================================================
// 14. Legion sheet — cargo tab (empire-inventory-surfaces `legion-sheet`,
//     plan Task 4D.1, spec-legion-sheet.md §§Design 1–8).
//
// Additive-only like every section above (no CONTRACT_VERSION bump — every
// addition is a new type, never a rename or a narrowing). Reuses §13's
// `CargoView`/`CargoRowView`/`CargoRowKind` (4A.3's read-back fold) — this
// section adds only the sheet's own closed vocabularies, the fold output,
// and the closed bus event list. Components bind here, never to a REST DTO.
// ===========================================================================

/**
 * The sheet's closed tab set (spec §Design 1). `overview` is the default —
 * the player asked to see the band, not its packs. Future tabs (orders,
 * caches-nearby) by reservation only, never snuck into this recipe.
 * Pinned as a literal because it is a closed code-owned vocabulary
 * (validation-ssot: pin a literal only for a closed vocabulary the code owns
 * and a human changes — with this reason stated).
 */
export type LegionSheetTabId = "overview" | "cargo";

/** Which gate refuses first (`slots` | `weight`), or `none` when neither does. */
export type LegionCargoGate = "slots" | "weight" | "none";

/**
 * One folded stock row for `stock-row` (spec §Design 4). `state` is
 * first-class: a skipped cache row stays visible as `left-behind:<gate>`
 * with its gate; a refused action row is `refused` with its copy key.
 * `copyKey` is null for plain `carried`/`stored`/`fits` rows.
 */
export type FoldedStockState =
  | "carried"
  | "stored"
  | "fits"
  | "left-behind:slots"
  | "left-behind:weight"
  | "refused";

export type FoldedStockRow = {
  seq: number;
  kind: CargoRowKind;
  instanceId: string | null;
  containerId: string | null;
  qty: number | null;
  weight: Magnitude; // count — snapshot display, never re-derived
  /** `#<seq>` fallback when the catalog join has no name — never blank, never a prettified id. */
  nameFallback: string;
  state: FoldedStockState;
  copyKey: LegionSheetCopyKey | null;
};

/**
 * The closed refusal/success vocabulary the legion-sheet fold maps to
 * authored copy (spec §Design 7, GG-62 — player sentences are authored copy
 * against these keys, owned in `stages/world/legionSheet/copyCatalog.ts`;
 * this union is the key list, never a new string invented at
 * implementation). `correlation.missing` is intentionally ABSENT — named in
 * the spec, never produced on the command path, so the fold maps it to
 * null rather than a key. `act.spent` is reserved (owned by
 * `world-action-economy`): the key exists so this fold has one family to
 * author against, with no finalized sentence here. `order.malformed` is the
 * authoring-time family (bus construction guarantees fields, so the recipe
 * never files a shape that triggers it) — surfaced in dev tooling, never as
 * player prose.
 */
export type LegionSheetCopyKey =
  | "cargo.done.load"
  | "cargo.done.unload"
  | "cargo.done.hand"
  | "cargo.done.deposit"
  | "cargo.done.withdraw"
  | "cache.claimed.partial"
  | "cache.claimed.all"
  | "cargo.full.weight"
  | "cargo.full.slots"
  | "cargo.not-yours"
  | "cargo.gone"
  | "cargo.not-here"
  | "vault.held-by-other"
  | "vault.full"
  | "cargo.other-empire"
  | "cache.gone"
  | "band.not-yours"
  | "band.unknown"
  | "band.missing"
  | "band.gone"
  | "band.routed"
  | "order.malformed"
  | "act.spent";

/**
 * `cargo-fold` output (spec §Design 5): meter fractions from the DTO's four
 * numbers, gate flag, folded rows in seq order, copy keys per
 * refusal/skip, and the §Design 8 header passthrough. Pure data — the fold
 * never recomputes capacity, compares positions, predicts fit, prettifies
 * an id, or invents a reason string.
 */
export type LegionCargoFold = {
  worldId: string;
  entityId: string;
  asOfTurn: number;
  slots: { used: Magnitude; capacity: Magnitude; fraction: number | null };
  weight: {
    used: Magnitude;
    capacity: Magnitude;
    fraction: number | null;
    /** Exact decimal strings beside the `long`s (types.ts `Magnitude.exact`
     * precedent) — `String(value)` of the wire number; honest about the
     * 2^53 transport limit, never a parse-back. */
    usedExact: string;
    capacityExact: string;
  };
  gateFlag: LegionCargoGate;
  rows: FoldedStockRow[];
  headerInputs: { ownerFactionId: string | null };
};

/**
 * `cargo-actions` bus — closed event list (spec §Design 6). Filing only:
 * every event files through the existing submit path
 * (`useSubmitWorldCommands`) or the claims filer — never a direct verb
 * call, never inline mutation. No weight field on any event (Locked
 * anchors — mass resolves server-side). `qty` rides `number` (whole units,
 * `long` end to end in C#; narrowed to `number` here per this file's own
 * documented transport-narrowing convention, never a logic cast).
 * This tab's recipe exposes only load / unload / hand-to-band; deposit /
 * withdraw / pick-up ride the same bus shape for `storage-cache-ui`.
 */
export type LegionCargoBusAction =
  | { type: "cargo.load"; entityId: string; cargoKind: "instance" | "stack"; instanceId?: string; containerId?: string; qty?: number }
  | { type: "cargo.unload"; entityId: string; seq: number }
  | { type: "cargo.hand-to-band"; entityId: string; targetEntityId: string; seq: number }
  | { type: "cargo.deposit"; entityId: string; sectorId: string; seq: number }
  | { type: "cargo.withdraw"; entityId: string; sectorId: string; seq: number }
  | { type: "cache.pick-up"; entityId: string; cacheId: string };

// ===========================================================================
// 15. Cache claim — pin → prompt → fits/left-behind → pick-up
//     (empire-inventory-surfaces `storage-cache-ui`, plan Task 4D.2b,
//     spec-storage-cache-ui.md §§Design 2–4).
//
// Additive-only like every section above (no CONTRACT_VERSION bump — every
// addition is a new type, never a rename or a narrowing). Reuses §13's
// `CachePinView`/`CachePinListView` (4A.3's presence-gated listing) and the
// `LegionSheetCopyKey` family above (4D.1's authored-copy keys) — this
// section adds only the claim-outcome fold output and the AP display slot.
// Components bind here, never to a REST DTO.
// ===========================================================================

/**
 * Where a filed `claim-cache` stands after the commit answers it
 * (spec §Design 2 step 4). The wire carries counts, not manifests
 * (hidden-until-found: the pin is count-only, and so is the answer) —
 * so this fold carries counts, never per-row seqs it cannot know.
 */
export type CacheClaimVerdict =
  | "unreadable" // filed (or not yet filed) — resolution not on the feed yet (GG-15)
  | "all-aboard" // `cache.claimed:<c>+0` — everything fits
  | "partial" // `cache.claimed:<c>+<s>`, s > 0 — what fits is aboard, the rest waits
  | "stale-pin"; // `cache.unreachable` — marched away / forged id

/**
 * `cache-claim` fold output (spec §Design 2 step 4): the committed
 * `cache.claimed:<c>+<s>` detail folded into aboard / left-behind counts
 * plus the authored-copy key into 4D.1's catalog (shared by name, never
 * forked). Pure data — the fold never recomputes capacity, compares
 * positions, predicts fit, prettifies an id, or invents a reason string.
 */
export type CacheClaimFold = {
  entityId: string;
  cacheId: string;
  /** Rows aboard after the claim resolved (the `<c>` in `claimed:<c>+<s>`). */
  claimed: number; // count — int, structural
  /** Rows still lying where they lay (the `<s>`). */
  skipped: number; // count — int, structural
  verdict: CacheClaimVerdict;
  /** Into `LEGION_SHEET_COPY` (4D.1): `cache.claimed.all` / `.partial` /
   * `cache.gone`; `null` while unreadable (nothing to author copy for yet). */
  copyKey: Extract<LegionSheetCopyKey, "cache.claimed.all" | "cache.claimed.partial" | "cache.gone"> | null;
};

/**
 * The pick-up button's AP display slot (spec §Design 2 step 3). The number
 * is world-action-economy's (`claimCostMilli`, act-price-table) — this slot
 * binds it, never authors it. `label` is the full button copy with the slot
 * filled (`pick up (250 AP)`); the component renders `label`, never a local
 * constant.
 */
export type CacheClaimApSlot = {
  /** `claimCostMilli` — per-mille of a turn's march budget, `int`. */
  costMilli: number;
  /** `pick up (<costMilli> AP)` — filled from `costMilli`, never hand-typed. */
  label: string;
};
