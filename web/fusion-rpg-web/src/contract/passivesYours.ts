import type { TreeResolveReport } from "@/lib/bus";

/**
 * passive-tree-todo.md I3 — Level 0 ("Yours", spec-tree-surface.md §2.2). Pure derivations over the
 * already-resolved `TreeResolveReport[]` the server hands back, so `PassivesTab.tsx` stays a thin
 * render layer and these rules are unit-testable without mounting React. Every value here is read
 * from the report, never recomputed from a lower-level number — the report's own "plain,
 * already-resolved value" contract (TreeResolveReport.cs) extends to this surface too.
 */

/** A tree this actor has put anything into — contributing, invalid, or nullified all count as
 * "invested," because all three mean the player spent for something in this tree (spec-tree-
 * surface.md §2.2: "the paths this actor has invested in"). A tree with zero owned nodes in any of
 * the three buckets has nothing of the player's in it at all. */
export function investedTrees(trees: TreeResolveReport[]): TreeResolveReport[] {
  return trees.filter(
    (t) => t.contributingNodeIds.length > 0 || t.invalidNodeIds.length > 0 || t.excludedNodes.length > 0
  );
}

export type NotWorkingTrait = {
  treeId: string;
  nodeId: string;
  /** D14/D11 are the same visual "Not working" state (§8) but need different sentences — a
   * nullified trait names its winner, an invalidated one names the closed gate. */
  reason: "nullified" | "invalid";
  /** Only present for `reason: "nullified"` — the node that wins the exclusion (§8: "both sides
   * print the rule and name the same winner"). Rendered as a raw node id today: the catalog has no
   * display-name field on the wire yet (§8's own callout, "the property vocabulary D14 keys on is
   * thin today" — a content gap, not something this surface can fabricate a name around). */
  winnerNodeId?: string;
};

/** D14's nullification (`isInert`) and D11/D12's gate-closed invalidation are printed as the SAME
 * "Not working" state (§8: "the same red, different sentence") — this is the one place that unions
 * them, so the Level-0 count and its filter can never drift from each other (an I4 acceptance bullet
 * this module's shape already satisfies: "the Level-0 count and its filter agree with what the
 * lattice shows"). A node can only ever be reported as invalid OR excluded, never both
 * (TreeResolveReport.Build's own contract), so this list has no duplicate entries. */
export function notWorkingTraits(trees: TreeResolveReport[]): NotWorkingTrait[] {
  const out: NotWorkingTrait[] = [];
  for (const tree of trees) {
    for (const nodeId of tree.invalidNodeIds) {
      out.push({ treeId: tree.treeId, nodeId, reason: "invalid" });
    }
    for (const excluded of tree.excludedNodes) {
      if (!excluded.isInert) continue; // reroute/precedence still work — only nullification stops a trait
      out.push({ treeId: tree.treeId, nodeId: excluded.nodeId, reason: "nullified", winnerNodeId: excluded.winnerNodeId });
    }
  }
  return out;
}

export type FocusReading = {
  /** The `F` multiplier itself, e.g. `1.1` for ×1.10 (§6: read from the report, never re-derived). */
  multiplier: number;
  /** `1/H`, the Herfindahl index's own standard reading — "about N paths" (§6). */
  effectivePaths: number;
};

/** `H`/`F` are computed ONCE server-side over the actor's whole allocation and hand the identical
 * value to every tree's report (PassiveTreeEndpoints.cs's own comment: "handed to every tree's
 * report unchanged") — so any one tree's numbers are the actor's numbers. `null` when nothing is
 * invested yet: `H` is undefined over an empty allocation, and §6's Focus line only ever appears
 * once a build exists to read. */
export function focusReading(trees: TreeResolveReport[]): FocusReading | null {
  const withInvestment = trees.find((t) => t.herfindahlMilli > 0);
  if (!withInvestment) return null;
  return {
    multiplier: withInvestment.focusMilli / 1000,
    effectivePaths: Math.round(1000 / withInvestment.herfindahlMilli)
  };
}

// ---- I9: the DRAFT preview -- mirrored ONLY here, and ONLY for a non-committed Plan -------------

export type ConcentrationTuning = { fmaxMilli: number; wMilli: number };

/** `TreeNodeSet.TreeIdOf`'s own grammar (`skill.<treeId>-<branch>-t<tier>-<nodeKey>`, R3), mirrored
 * here as a plain STRUCTURAL parse -- it groups a merged soul-level map by tree, the same job the
 * catalog's own `nodes[].nodeId` already does server-side, never a re-derivation of `H`/`F`
 * themselves. Returns `null` for a malformed id (skip, never throw) -- a defensive no-op befitting a
 * preview, not a hard failure the way the Core-side parse is for a store row that should never be
 * malformed in the first place. */
function treeIdOfNodeId(nodeId: string): string | null {
  const prefix = "skill.";
  if (!nodeId.startsWith(prefix)) return null;
  const rest = nodeId.slice(prefix.length);
  const dash = rest.indexOf("-");
  if (dash <= 0) return null;
  return rest.slice(0, dash);
}

/** `Concentration.RoundHalfAwayFromZero` mirrored -- integer per-mille rounding, away from zero,
 * matching the engine's own rounding direction exactly (both operands here are always safe
 * `Number`-range integers: node/soul counts in a real actor's draft never approach
 * `Number.MAX_SAFE_INTEGER`). */
function roundHalfAwayFromZero(numerator: number, denominator: number): number {
  const q = Math.trunc(numerator / denominator);
  const r = numerator - q * denominator;
  if (r === 0) return q;
  const twiceR = Math.abs(r) * 2;
  return numerator >= 0 ? (twiceR >= denominator ? q + 1 : q) : (-twiceR >= denominator ? q - 1 : q);
}

/** `Concentration.HerfindahlMilli` mirrored -- `round_half_away(Σ(n_i²)·1000, (Σn)²)`, zero when
 * `Σn = 0` (no `1/n` fallback, matching the Core doc comment's own stated rule). */
function herfindahlMilli(counts: readonly number[]): number {
  let sum = 0;
  let sumSquares = 0;
  for (const n of counts) {
    if (n < 0) throw new RangeError(`herfindahlMilli: counts must be >= 0, got ${n}`);
    sum += n;
    sumSquares += n * n;
  }
  if (sum === 0) return 0;
  return roundHalfAwayFromZero(sumSquares * 1000, sum * sum);
}

/** `Concentration.BlendMilli` mirrored -- `H = w·H_nodes + (1-w)·H_souls`, per-mille. */
function blendMilli(hNodesMilli: number, hSoulsMilli: number, wMilli: number): number {
  return roundHalfAwayFromZero(wMilli * hNodesMilli + (1000 - wMilli) * hSoulsMilli, 1000);
}

/** `Concentration.FmaxAppliedMilli` mirrored -- `F = 1 + (Fmax - 1)·H`, per-mille. */
function fmaxAppliedMilli(hMilli: number, fmaxMilli: number): number {
  return 1000 + roundHalfAwayFromZero((fmaxMilli - 1000) * hMilli, 1000);
}

/**
 * A DRAFT-ONLY MIRROR of `Concentration.HerfindahlMilli`/`BlendMilli`/`FmaxAppliedMilli`
 * (`gk-core/src/FusionRpg.Core/PassiveTree/Resolve/Concentration.cs`), fed from `mergedSoulLevelByNodeId`
 * (server-committed values with the pending Plan's own edits layered on top, `mergeSoulLevels`) and
 * the real tuning dial now on the wire (`PassiveTreeState.concentrationFmaxMilli`/`concentrationWMilli`,
 * task I9). This mirror is legitimate ONLY because both inputs are real: the tuning dial is read off
 * the wire rather than hand-typed (a hardcoded 1200/500 would be exactly the private curve AGENTS.md
 * forbids, and would break §6's own "a dial change moves the line with no FE edit" promise for this
 * one line specifically), and the grouping-by-tree above is a plain structural parse, not a
 * recomputation of any resolved fact.
 *
 * **Never used for the committed Focus line.** `focusReading` above stays the ONLY reader of the
 * server's own already-resolved `herfindahlMilli`/`focusMilli`. This function exists solely so
 * `PlanPanel` can show "what Focus would become" while a Plan is still a draft (§5.1 item 2, §6: "it
 * moves while you edit... the player moves points between two paths and watches both halves of the
 * line move together" -- M8/GG-33, test 14). The moment a Plan commits, the next GET's real
 * `herfindahlMilli`/`focusMilli` supersede this preview entirely; it is never persisted and never
 * treated as authoritative.
 *
 * `null` when the draft owns nothing yet (mirrors `focusReading`'s own "H is undefined over an empty
 * allocation" rule) or when the blended `H` itself is exactly zero (a defensive mirror of
 * `focusReading`'s `herfindahlMilli > 0` guard — real tuning never reaches this, since at least one
 * owned node always makes `H_nodes` positive, but a preview must never divide by zero on a
 * pathological dial).
 */
export function draftFocusPreview(
  mergedSoulLevelByNodeId: Readonly<Record<string, number>>,
  tuning: ConcentrationTuning
): FocusReading | null {
  const perTree = new Map<string, { nodeCount: number; soulLevels: number }>();
  for (const [nodeId, soulLevel] of Object.entries(mergedSoulLevelByNodeId)) {
    const treeId = treeIdOfNodeId(nodeId);
    if (!treeId) continue;
    const prior = perTree.get(treeId) ?? { nodeCount: 0, soulLevels: 0 };
    perTree.set(treeId, { nodeCount: prior.nodeCount + 1, soulLevels: prior.soulLevels + soulLevel });
  }
  if (perTree.size === 0) return null;

  const nodeCounts = Array.from(perTree.values(), (s) => s.nodeCount);
  const soulCounts = Array.from(perTree.values(), (s) => s.soulLevels);
  const hMilli = blendMilli(herfindahlMilli(nodeCounts), herfindahlMilli(soulCounts), tuning.wMilli);
  if (hMilli === 0) return null;

  return {
    multiplier: fmaxAppliedMilli(hMilli, tuning.fmaxMilli) / 1000,
    effectivePaths: Math.round(1000 / hMilli)
  };
}
