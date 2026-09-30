import catalogJson from "@gk-data/data/seed/display/wonder-display.v1.json";
import type { SectorView, SlotView } from "@/contract/types";
import type { ThemeRef } from "@/features/gui-lego/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * empire-wonder-surfaces `wonder-display` (plan Task 4D.4, spec §Design 1) — the sector-card
 * fold. Pure data, no paint, no copy: it joins the slot's `SlotView` + the catalog-wire Wonder
 * facet (4A.4: `wonderScope`/`wonderRarity` on the slot, live counts + `wonderUpkeep` operand on
 * the sector) + the display catalog (`gk-data/packs/fusion/data/seed/display/wonder-display.v1.json`, imported
 * directly — the `element-catalog.v1.json` precedent) and returns one closed reading per card.
 *
 * Wire reason strings are translated into catalog keys here — they never render raw (GG-23). Cap
 * lines render `WonderPolicy` numbers through this fold (`ExistenceCapFor` readings, LOCKED shown
 * per Owner resolution), never literals in prose. Magnitudes format through GG-46 unit families;
 * the fold invents no number — a missing cap read renders the designed pending state, never a
 * guess and never a hidden row.
 */

export type WonderDisplayCatalog = {
  schemaVersion: number;
  version: number;
  identities: Record<string, { name: string; scope: string; rarity: string; effect: string }>;
  refusals: Record<string, { copy: string; next: string }>;
  nothingTaken: string;
  teasers: Record<string, { reason: string }>;
  placeholder: { copy: string; action: string };
  pending: { cap: string };
};

const CATALOG = catalogJson as unknown as WonderDisplayCatalog;

export function wonderDisplayCatalog(): WonderDisplayCatalog {
  return CATALOG;
}

/** Closed scope vocabulary — exact wire case (4B.1 exact-spelling rule); the reason is stated. */
export const WONDER_SCOPES = ["Sector", "Empire", "World", "Multiverse"] as const;
export type WonderScope = (typeof WONDER_SCOPES)[number];

/** Closed rarity vocabulary — exact wire case; same reason. */
export const WONDER_RARITIES = ["Common", "Unique"] as const;
export type WonderRarity = (typeof WONDER_RARITIES)[number];

/** Reserved tiers render as locked teasers with a reason — never hidden, never buildable. */
export const WONDER_RESERVED_SCOPES: readonly string[] = ["World", "Multiverse"];

/**
 * Closed refusal vocabulary — the four wire reasons that exist server-side
 * (`BuildResolver.cs:102-132`, `WorldCommandAdmission.cs:112-119`) with zero FE handlers before
 * this module. Pinning these literals is a closed-vocabulary pin (validation-ssot): the admission
 * code owns them and a human changes them.
 */
export const WONDER_REFUSAL_REASONS = [
  "wonder.cap-reached",
  "relic.count-mismatch",
  "relic.not-reachable",
  "build.cannot-afford-materials"
] as const;
export type WonderRefusalReason = (typeof WONDER_REFUSAL_REASONS)[number];

export function isWonderRefusalReason(reason: string): reason is WonderRefusalReason {
  return (WONDER_REFUSAL_REASONS as readonly string[]).includes(reason);
}

/** Paint slots only — the `wonder-scope-*` / `wonder-rarity-*` packs own css + paint + vfx. */
export function wonderThemeRefs(scope: string, rarity: string): { scope: ThemeRef; rarity: ThemeRef } {
  return {
    scope: { kind: "wonder-scope", id: scope },
    rarity: { kind: "wonder-rarity", id: rarity }
  };
}

export type WonderProgress =
  | { state: "built" }
  | { state: "rising"; nightsLeft: number }
  | { state: "pending"; reason: string };

export type WonderCap =
  | { state: "none" }
  | { state: "known"; line: string }
  | { state: "pending"; reason: string };

export type WonderCatalogRow = {
  structureId: string;
  existenceCap: number;
  relicCost: number;
  /** Optional: when the caller carries it, the rising meter renders a fraction; otherwise indeterminate. Never guessed. */
  buildTurns?: number;
};

export type WonderCardReading =
  | {
      kind: "wonder";
      name: string;
      scope: string;
      rarity: string;
      effectSentence: string;
      progress: WonderProgress;
      cap: WonderCap;
      /** Non-null only for reserved-scope rows: the locked teaser, never a build action. */
      lockedReason: string | null;
      /** Null while the catalog row is unread — never a guessed number. */
      relicCost: number | null;
      themeRefs: { scope: ThemeRef; rarity: ThemeRef };
    }
  | { kind: "placeholder"; copy: string; action: string; lockedReason: string | null }
  | { kind: "not-wonder" };

export type WonderCardInput = {
  slot: SlotView;
  sector: SectorView;
  /** The slot's own world-catalog row (existenceCap/relicCost) — null while unread. */
  catalogRow?: WonderCatalogRow | null;
  /** True once the caller has read the world catalog: only then does a missing row prove an
   * unknown id (without a catalog read, an unknown id is indistinguishable from unread data,
   * and the card must not claim it). */
  catalogProvided?: boolean;
};

/**
 * Whether the wonder card mounts for this slot instead of the legacy `SlotRow` sentence.
 * Facet-declared Wonders and display-catalogued ids always mount; a structure id the provided
 * world catalog does not know mounts as the designed placeholder. Everything else stays on the
 * legacy sentence — non-Wonder rows are world-stage's GG-23, not this module's.
 */
export function shouldMountWonderCard(input: WonderCardInput): boolean {
  const structureId = input.slot.structureId;
  if (structureId == null) return false;
  if (input.slot.wonderScope != null) return true;
  if (Object.prototype.hasOwnProperty.call(CATALOG.identities, structureId)) return true;
  if (input.catalogProvided === true && input.catalogRow == null) return true;
  return false;
}

function foldProgress(slot: SlotView): WonderProgress {
  const turns = slot.constructionTurnsRemaining;
  if (turns.state === "known") {
    // The release-ground player-words tone ("N nights of building lost"): under-construction
    // renders the authored name + "rising — N nights left" + the shared meter; built renders
    // no progress slot. `known(null)`/`known(0)` is standing work, not rising work.
    return turns.value != null && turns.value > 0 ? { state: "rising", nightsLeft: turns.value } : { state: "built" };
  }
  // Pending with no known value states the wire's own pending copy (player-facing by the
  // `Pending` contract) — never a fabricated turn count. `absent` (no estimate at all) reads
  // as standing work, the same fall-through `slotRowState` already uses.
  if (turns.state === "pending") return { state: "pending", reason: turns.reason };
  return { state: "built" };
}

function foldCap(input: WonderCardInput, scope: string, rarity: string): WonderCap {
  // `Common` is uncapped by construction (`ExistenceCapFor` returns `long.MaxValue`) — the pack
  // never paints a cap gauge on it (GG-64), and the card renders no cap line at all.
  if (rarity !== "Unique") return { state: "none" };
  const row = input.catalogRow;
  if (row == null) return { state: "pending", reason: CATALOG.pending.cap };
  // Overflow is RANGE: an existence cap past float precision must not render rounded. Unreachable
  // for shipped tuning (caps 2/3) — the pending state, not a clamp, is the honest answer.
  if (!Number.isSafeInteger(row.existenceCap) || row.existenceCap < 0) {
    return { state: "pending", reason: CATALOG.pending.cap };
  }
  const live = scope === "Empire" ? input.sector.wonderLiveCountEmpire : input.sector.wonderLiveCountSector;
  const line = `${formatMagnitude(live)} of ${formatMagnitude({ unit: "count", value: row.existenceCap })} raised`;
  return { state: "known", line };
}

/**
 * One closed reading per card: `{ name, scope, rarity, effectSentence, progress, capLine?,
 * lockedReason? }`. Names come from the display catalog keyed by `structureId` (they survive
 * without the wire); the wire facet only selects scope/rarity paint and the live counts.
 */
export function foldWonderCard(input: WonderCardInput): WonderCardReading {
  const structureId = input.slot.structureId;
  if (structureId == null) return { kind: "not-wonder" };
  const identity = Object.prototype.hasOwnProperty.call(CATALOG.identities, structureId)
    ? CATALOG.identities[structureId]!
    : null;
  const facetScope = input.slot.wonderScope;
  if (identity == null) {
    // No catalog row: a facet-declared Wonder, or an id the provided world catalog does not
    // know, renders the designed placeholder (+ `card.expand`) — never the raw id, never
    // id-words (GG-23). Reserved-scope unknowns render their locked teaser instead of the
    // generic placeholder: the reason is the reading, never an effect promise.
    if (facetScope == null && !(input.catalogProvided === true && input.catalogRow == null)) {
      return { kind: "not-wonder" };
    }
    const teaserKey = facetScope != null ? `scope.${facetScope}` : null;
    const teaser = teaserKey != null && Object.prototype.hasOwnProperty.call(CATALOG.teasers, teaserKey)
      ? CATALOG.teasers[teaserKey]!
      : null;
    if (teaser != null) return { kind: "placeholder", copy: teaser.reason, action: CATALOG.placeholder.action, lockedReason: teaser.reason };
    return { kind: "placeholder", copy: CATALOG.placeholder.copy, action: CATALOG.placeholder.action, lockedReason: null };
  }
  const scope = facetScope ?? identity.scope;
  const rarity = input.slot.wonderRarity ?? identity.rarity;
  const teaserKey = `scope.${scope}`;
  const lockedReason = WONDER_RESERVED_SCOPES.includes(scope) &&
    Object.prototype.hasOwnProperty.call(CATALOG.teasers, teaserKey)
    ? CATALOG.teasers[teaserKey]!.reason
    : null;
  return {
    kind: "wonder",
    name: identity.name,
    scope,
    rarity,
    effectSentence: identity.effect,
    progress: foldProgress(input.slot),
    cap: foldCap(input, scope, rarity),
    lockedReason,
    relicCost: input.catalogRow?.relicCost ?? null,
    themeRefs: wonderThemeRefs(scope, rarity)
  };
}

export type WonderRefusalReading = {
  copy: string;
  next: string;
  /** The Civ6 salvaged-amount precedent: every refusal states that nothing was taken. */
  nothingTaken: string;
};

/**
 * The first FE handler for the four wire refusal reasons: each maps to its catalog copy + next
 * action. Unknown reasons map to `null` — the caller renders nothing, never the raw string.
 * Pure: it reads the catalog and returns a reading; stocks and relics are untouched by
 * construction (there is no write path here at all).
 */
export function foldWonderRefusal(reason: string): WonderRefusalReading | null {
  if (!isWonderRefusalReason(reason)) return null;
  const row = CATALOG.refusals[reason as WonderRefusalReason]!;
  return { copy: row.copy, next: row.next, nothingTaken: CATALOG.nothingTaken };
}

/** Reserved-tier teaser reasons (scope + effect-kind rows) — the composer's locked shelf reads the same rows. */
export function wonderTeaser(key: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(CATALOG.teasers, key)) return null;
  return CATALOG.teasers[key]!.reason;
}
