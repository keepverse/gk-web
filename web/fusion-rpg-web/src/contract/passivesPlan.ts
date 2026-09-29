/**
 * passive-tree-todo.md I8 — "The Plan object" (spec-tree-surface.md §5.1, §5.2, §5.3, §7.2). Pure
 * derivations only (contractGuard.test.ts: no DTO binding and no derivation logic lives under `ui/`).
 *
 * **A Plan vs. the draft I7 already wired.** I7's `useAllocationDraft` (TraitDetail.tsx) holds one
 * trait's edit for exactly as long as that trait's own Level-3 panel stays mounted -- closing it
 * (`onBack`) unmounts the hook and any unsaved edit is gone. A **Plan** is the same shape
 * (`Record<nodeId, soulLevel>`) lifted to live at `PassivesTab`'s own scope instead: it is a SPARSE
 * overlay of only the entries the player has touched this session (new unlocks at soul level 0, or a
 * depth change on an already-owned node), so it survives navigating Level 3 -> Level 2 -> Level 1 and
 * back, and survives the whole actor sheet closing and reopening (`PassivesTab`'s own state, never
 * unmounted while the sheet exists -- the same GG-51 argument `browseQuery` already relies on).
 * `encodePlanCode`/`decodePlanCode` extend that persistence past a reload or a bookmark, per GG-8.
 */

import type { TreeResolveReport } from "@/lib/bus";

// ---- GG-8: the plan lives in the URL, the plain "open layers" mechanism only -----------------

/** The query-string key this module reads/writes, matching `panel`/`sel`'s own naming style
 * (`SanctumStage.tsx`). Kept as a named constant so the encode and decode sides can never drift. */
export const PLAN_URL_PARAM = "plan";

/** `nodeId=soulLevel` pairs, `&`-joined, URI-component-encoded per field. Deliberately NOT base64 or
 * JSON-in-one-blob: a plain delimited string stays short for the realistic case (a handful of touched
 * nodes) and is trivial to eyeball in an address bar, matching GG-8's own "the address IS the state"
 * spirit. Carries WHICH nodes and HOW MANY -- never a price (§5.3, test 19): there is no numeric field
 * in this format that isn't a node id or a soul level, so a price can't leak into it by construction.
 * An empty plan encodes to `""` (the caller is expected to omit the param entirely in that case). */
export function encodePlanCode(plan: Readonly<Record<string, number>>): string {
  return Object.entries(plan)
    .map(([nodeId, soulLevel]) => `${encodeURIComponent(nodeId)}=${Math.max(0, Math.trunc(soulLevel))}`)
    .join("&");
}

/**
 * The inverse of `encodePlanCode`. Never throws -- a malformed, truncated or hand-edited code decodes
 * to as much as it CAN parse, dropping only the individual pairs that don't parse (matching this
 * codebase's "fall through to the normal render rather than get stuck on nothing" precedent,
 * `PassivesTab.tsx`'s own `openTree`/`openNode` fallback). An empty or whitespace-only code decodes to
 * an empty plan, not `null` -- `null` is reserved for a caller that wants to distinguish "no code was
 * ever present" from "a code was present and decoded to nothing," which this module leaves to the
 * caller (it never receives `null` itself).
 */
export function decodePlanCode(code: string): Record<string, number> {
  const plan: Record<string, number> = {};
  if (!code || !code.trim()) return plan;

  for (const pair of code.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue; // no '=', or an empty node id -- drop this one pair, keep parsing the rest
    const nodeId = decodeURIComponent(pair.slice(0, eq));
    const raw = pair.slice(eq + 1);
    const soulLevel = Number(raw);
    if (!nodeId || !Number.isFinite(soulLevel) || soulLevel < 0) continue;
    plan[nodeId] = Math.trunc(soulLevel);
  }
  return plan;
}

/** The merged view a lattice/trait-detail cell reads: server-committed values with the Plan's own
 * sparse edits layered on top. Server values win on nothing -- a Plan entry always overrides, which is
 * exactly what "planned, not yet committed" means for the number shown. */
export function mergeSoulLevels(
  serverValues: Readonly<Record<string, number>>,
  plan: Readonly<Record<string, number>>
): Record<string, number> {
  return { ...serverValues, ...plan };
}

// ---- §5.2: the price of a PLAN, three numbers, order-independent -----------------------------

export type UnlockCostRates = { firstPoints: number; stepPoints: number };

/** `TreeUnlockCost.Cumulative` (`gk-core/src/FusionRpg.Core/PassiveTree/State/TreeUnlockCost.cs`), MIRRORED
 * client-side rather than re-derived -- "one power ladder, no private curves." The Core doc comment's
 * own order-independence lemma is what test `plan_price_is_order_independent` (passivesPlan.test.ts)
 * proves client-side too: this is a pure function of `count` alone, so summing it over any sequence of
 * additions that ends at the same final count always returns the same total. */
export function unlockCumulative(count: number, rates: UnlockCostRates): number {
  if (count < 0) throw new RangeError(`unlockCumulative: count must be >= 0, got ${count}`);
  return count * rates.firstPoints + (rates.stepPoints * count * (count - 1)) / 2;
}

/** `TreeUnlockCost.PriceOfNth` mirrored -- the price of the Nth node (1-indexed) an actor owns,
 * `first + (n-1)*step`. D25's price depends only on the ORDINAL, never on which node -- so every
 * "available" cell on the lattice quotes the SAME number for "Unlock, right now" (§4's worked example,
 * "Unlock · 14 pts"), not a per-node price table. */
export function priceOfNth(n: number, rates: UnlockCostRates): number {
  if (n < 1) throw new RangeError(`priceOfNth: n must be >= 1, got ${n}`);
  return rates.firstPoints + (n - 1) * rates.stepPoints;
}

/** The node ids in `plan` that are NOT already in `serverValues` -- D25's "N-th node the actor owns":
 * only a brand-new key raises the owned count. A depth change on an ALREADY-owned node (soul level,
 * D3's other track) never counts here, matching `OwnershipRules.SoulLevelsCount = false`. */
export function planNewNodeIds(
  serverValues: Readonly<Record<string, number>>,
  plan: Readonly<Record<string, number>>
): string[] {
  return Object.keys(plan).filter((id) => !(id in serverValues));
}

export type PlanPrice = {
  /** Count of brand-new nodes this plan would unlock -- the "9 traits" line (§5.2's worked example). */
  newTraits: number;
  /** `Cumulative(ownedCountBefore + newTraits) - Cumulative(ownedCountBefore)` -- the marginal skill-
   * point cost of the plan's new unlocks, independent of the order they're taken in (§5.2's own printed
   * promise, "a plan costs the same whichever order you follow it in"). */
  skillPoints: number;
  /** DISCLOSED GAP, not fabricated: no soul-level deepen price exists anywhere in Core today --
   * `RpgStore.SaveTreeNodeState` writes any `soul_level` with no deduction, and I7's own evidence
   * already named this ("no souls-cost formula exists anywhere in Core for deepening... correctly NOT
   * fabricated as a private cost curve"). Rendering a real number here would be exactly the private
   * curve AGENTS.md forbids, so this is honestly `0` until a real depth-price ships in Core -- the
   * field stays in the shape (three numbers, §5.2) so that day's change is additive, not a reshape. */
  souls: number;
};

/**
 * The Plan's own price -- three numbers, never a single trait's price in isolation (§5.2). Pure and
 * order-independent by construction: it reads only the FINAL `plan` object's key set against
 * `serverValues`' current owned count, never the sequence of edits that produced it.
 */
export function planPrice(
  serverValues: Readonly<Record<string, number>>,
  plan: Readonly<Record<string, number>>,
  rates: UnlockCostRates
): PlanPrice {
  const ownedCountBefore = Object.keys(serverValues).length;
  const newTraits = planNewNodeIds(serverValues, plan).length;
  const skillPoints = unlockCumulative(ownedCountBefore + newTraits, rates) - unlockCumulative(ownedCountBefore, rates);
  return { newTraits, skillPoints, souls: 0 };
}

// ---- §7.2 part 3: exactly one lender, named, once -----------------------------------------------

export type TierAttribution = { own: number; lentAmount: number; lenderTreeId: string | null };

/**
 * The tier row's own positive attribution line (§7.2 part 2's worked example: "55 from Fortitude · 120
 * lent by Might") -- reads `TreeResolveReport.ownAptitudePoints` (I8's own wire addition) rather than
 * reverse-engineering a base/credit split from `aptitudePoints`/`lenderTreeId` alone, which is
 * genuinely underdetermined when two same-stance trees mutually lend to each other (each the other's
 * largest mate) -- more than one `(own, lent)` split is consistent with the same pair of wire numbers
 * in that case, so guessing would risk rendering a plausible-looking but WRONG split. Returns `null`
 * when the report carries no real split yet (`ownAptitudePoints` undefined, e.g. a pre-I8 fixture) --
 * the caller renders no attribution line rather than a fabricated one.
 */
export function tierAttribution(report: Pick<TreeResolveReport, "aptitudePoints" | "lenderTreeId" | "ownAptitudePoints">): TierAttribution | null {
  if (report.ownAptitudePoints === undefined) return null;
  const own = report.ownAptitudePoints;
  const lentAmount = report.lenderTreeId ? Math.max(0, report.aptitudePoints - own) : 0;
  return { own, lentAmount, lenderTreeId: report.lenderTreeId };
}

// ---- §7.2 part 5: "the draft preview reports what a change would close" -----------------------

/**
 * The highest-value line the preview renders, computed by DIFFING two already-server-resolved report
 * arrays -- never by re-deriving `CrossUnlock`/`TierGate` here (AGENTS.md "one power ladder, no
 * private curves"; the actual resolution happens once, server-side, for each of `committed` and
 * `preview`, via `POST /api/passive-tree/{playerId}/preview`). `committed` is the actor's real,
 * already-fetched state (`usePassiveTree`'s own data); `preview` is that same shape recomputed by the
 * server for a hypothetical node set plus aptitude delta.
 *
 * Matched by `treeId` -- a tree present in one array and not the other (should not happen; both calls
 * resolve the same shared corpus) is simply skipped rather than treated as a change.
 */
export type ClosePreview = {
  /** Tree ids whose `tierReached` would go DOWN under the hypothetical -- "closes tier N in X." */
  closingTreeIds: string[];
  /** Tree ids whose `tierReached` would go UP -- the positive symmetric case, "opens tier N in X." */
  openingTreeIds: string[];
  /** Count of nodes currently CONTRIBUTING (owned, tier-valid, not excluded) that the preview reports
   * as newly INVALID -- summed across every tree, matching the worked example's own "4 of your traits
   * would stop working." Never counts a node that was already not-contributing. */
  traitsThatWouldStopWorking: number;
};

type CommittedReportForPreview = Pick<TreeResolveReport, "treeId" | "tierReached" | "contributingNodeIds">;
type PreviewReportForPreview = Pick<TreeResolveReport, "treeId" | "tierReached" | "invalidNodeIds">;

export function closePreview(
  committed: readonly CommittedReportForPreview[],
  preview: readonly PreviewReportForPreview[]
): ClosePreview {
  const previewByTreeId = new Map(preview.map((t) => [t.treeId, t]));
  const closingTreeIds: string[] = [];
  const openingTreeIds: string[] = [];
  let traitsThatWouldStopWorking = 0;

  for (const before of committed) {
    const after = previewByTreeId.get(before.treeId);
    if (!after) continue; // both calls resolve the same shared corpus; a mismatch names nothing

    if (after.tierReached < before.tierReached) closingTreeIds.push(before.treeId);
    else if (after.tierReached > before.tierReached) openingTreeIds.push(before.treeId);

    const invalidAfter = new Set(after.invalidNodeIds);
    for (const nodeId of before.contributingNodeIds) {
      if (invalidAfter.has(nodeId)) traitsThatWouldStopWorking++;
    }
  }

  return { closingTreeIds, openingTreeIds, traitsThatWouldStopWorking };
}

/** The one printed sentence (§7.2 part 5's own worked example shape) -- `null` when the hypothetical
 * changes nothing, so the caller renders no line rather than an empty one. Closing always outranks
 * opening as the highest-value line: a player is warned about what breaks before being told what's
 * newly available, the same L6 "the failure mode is worse" ordering §7.1 states for D28 in general. */
export function closePreviewSentence(preview: ClosePreview): string | null {
  if (preview.closingTreeIds.length > 0) {
    const trees = preview.closingTreeIds.join(", ");
    if (preview.traitsThatWouldStopWorking > 0) {
      // "traits" stays plural regardless of count -- the same convention `PassivesTab.tsx`'s own
      // `NotWorkingCount` already uses ("N of your traits is/are not working": the noun never
      // singularizes, only a verb would, and this sentence has none to conjugate).
      return `Closes a tier in ${trees} — ${preview.traitsThatWouldStopWorking} of your traits would stop working.`;
    }
    return `Closes a tier in ${trees}.`;
  }
  if (preview.openingTreeIds.length > 0) {
    return `Opens a tier in ${preview.openingTreeIds.join(", ")}.`;
  }
  return null;
}
