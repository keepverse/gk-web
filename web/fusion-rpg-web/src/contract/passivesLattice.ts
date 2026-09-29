import type { TreeNodeSummary, TreeResolveReport } from "@/lib/bus";
import { GATELESS_CONDITION_TEXT } from "./passivesBrowse";
import { PASSIVE_TREE_VOCABULARY } from "./passiveTreeVocabulary";

/**
 * passive-tree-todo.md I6 — Level 2 ("the lattice", spec-tree-surface.md §2.3, §9, §9.1 rules 1-2).
 * Pure derivations over `TreeResolveReport` + `PassiveTreeState.tierReqScalePoints`, mirroring the
 * shape `passivesYours.ts`/`passivesBrowse.ts` already use so `PathLattice.tsx` stays a thin render
 * layer (contractGuard.test.ts: no DTO binding and no derivation logic lives under `ui/`).
 *
 * **A real, disclosed content gap this module works around, not hides — updated 2026-09-08**:
 * `tree-language` (H1-H2) has generated real player-facing name/flavor text for 12 of 42 shared
 * trees so far (passive-tree-todo.md's own H9 status); the rest have neither yet. Since
 * `seedsmith-content-standard`'s content-completeness-passive-tree module, `TreeNodeSummary` carries
 * optional `name`/`flavor` wired straight through from the catalog (`PathLattice.tsx`/
 * `TraitDetail.tsx` render them when present) — this module still renders real, structural node
 * identity (branch/tier/node id) as the fallback for any node `tree-language` hasn't reached, never
 * a fabricated name.
 */

export type LatticeCellState = "owned" | "available" | "locked";

export type LatticeCell = {
  node: TreeNodeSummary;
  state: LatticeCellState;
  /** Present only for an owned node -- `undefined` soul level (a node bought but never soul-levelled,
   * B5 §1.1's own real state) reads as depth 0, never as "not owned." */
  soulLevel: number;
};

export type LatticeTierRow = {
  tier: number;
  cells: LatticeCell[];
};

/** D29: the lattice is a fixed 2-branch grid, but the axis LABELS are read from the wire (whatever
 * two branch tokens the catalog's nodes actually carry, e.g. "Off"/"Def") rather than hardcoded --
 * the shape is structural, the labels are not this module's to invent. Sorted for a deterministic
 * column order regardless of node emission order. */
export function branchesOf(nodes: readonly TreeNodeSummary[]): string[] {
  return Array.from(new Set(nodes.map((n) => n.branch))).sort();
}

/** `TierGate.Reached`'s own formula (`gk-core/src/FusionRpg.Core/PassiveTree/Resolve/TierGate.cs`), mirrored
 * client-side from the ONE tuning constant the wire now carries (`PassiveTreeState.
 * tierReqScalePoints`) rather than re-derived or hand-typed -- "one power ladder, no private curves."
 */
export function tierRequirement(tier: number, reqScalePoints: number): number {
  return reqScalePoints * tier * (tier + 1) / 2;
}

/** Whether a node has anything the actor owns recorded against it -- contributing, invalid (gate
 * closed after purchase, D11/D12), or excluded (D14/D40, inert or not) all mean the actor spent for
 * it, same union `passivesYours.ts`'s own `investedTrees`/`notWorkingTraits` already use. */
function isOwned(nodeId: string, report: TreeResolveReport): boolean {
  return (
    report.contributingNodeIds.includes(nodeId) ||
    report.invalidNodeIds.includes(nodeId) ||
    report.excludedNodes.some((e) => e.nodeId === nodeId)
  );
}

export function cellStateFor(node: TreeNodeSummary, report: TreeResolveReport): LatticeCellState {
  if (isOwned(node.nodeId, report)) return "owned";
  return node.tier <= report.tierReached ? "available" : "locked";
}

/** Groups every ENABLED node the wire sent into its (tier, branch) slot -- all 40 real cells, GG-61:
 * "one entity's own content," no windowing. A tier with no authored node at all (nothing generated
 * yet for this shape) simply renders an empty row rather than a fabricated placeholder cell. */
export function tierRows(report: TreeResolveReport, soulLevelByNodeId: Record<string, number>): LatticeTierRow[] {
  const nodes = report.nodes ?? [];
  const rows: LatticeTierRow[] = [];
  for (let tier = 1; tier <= report.tiers; tier++) {
    const cells = nodes
      .filter((n) => n.tier === tier)
      .slice()
      .sort((a, b) => a.branch.localeCompare(b.branch) || a.nodeId.localeCompare(b.nodeId))
      .map((node) => ({
        node,
        state: cellStateFor(node, report),
        soulLevel: soulLevelByNodeId[node.nodeId] ?? 0
      }));
    rows.push({ tier, cells });
  }
  return rows;
}

/** §2.3's own acceptance criterion: "Level 2 opens scrolled to the player's own depth, never to tier
 * 1." A fresh actor (tierReached 0) has no depth to scroll to, so tier 1 is the honest starting point
 * for them specifically -- the rule guards against defaulting to tier 1 for an actor who has ALREADY
 * gone deeper, not against a brand-new actor legitimately starting there. */
export function scrollTargetTier(report: Pick<TreeResolveReport, "tierReached" | "tiers">): number {
  return Math.max(1, Math.min(report.tierReached, report.tiers));
}

/** §9.1: a tree whose gate quantity has no producer yet takes the CONDITION presentation -- no price,
 * no have-number, no Unlock verb, on ANY tier (rule 2), read from `gateState`, never inferred from a
 * zero (rule 5). */
export function isConditionPresentation(report: Pick<TreeResolveReport, "gateState">): boolean {
  return report.gateState === "unproduced";
}

export { GATELESS_CONDITION_TEXT };

export type TierDistance = {
  need: number;
  have: number;
  /** `need - have`, floored at 0 -- a reached tier (need <= have) has nothing left to close. */
  short: number;
};

/** §9's distance bar: "Tier 9 · 225 aptitude points · you have 175." Computed per actor from the
 * report's own `aptitudePoints` (base + at most one lender's credit, D28) — never a catalog constant
 * stated once. */
export function tierDistance(tier: number, report: TreeResolveReport, reqScalePoints: number): TierDistance {
  const need = tierRequirement(tier, reqScalePoints);
  const have = report.aptitudePoints;
  return { need, have, short: Math.max(0, need - have) };
}

/**
 * §7.2 part 4 / §14 test 9: "the locked reason is visible sibling text ... and it names BOTH routes."
 * ONE function -- the "one reason table" spec §15 requires -- so the tier row's sibling text and any
 * other future caller can never print two hand-authored sentences that drift apart. Mirrors the
 * worked example in `spec-tree-surface.md` §13's own `TierRow` doc comment exactly, translated into
 * this module's real (non-`t`-tagged) template-literal convention (`PassivesTab.tsx`/`PathBrowse.tsx`
 * render plain JSX text, never a `t\`...\`` tag -- that tag is spec-illustrative pseudocode, not a
 * real helper in this tree).
 *
 * Never the bare word "points" alone (§4.1, test 33) -- always "aptitude points," naming the wallet
 * (I10: read from `passiveTreeVocabulary.ts`, the one place that word is spelled out).
 */
export function lockedTierReason(args: {
  short: number;
  pathName: string;
  lenderPathName: string | null;
  need: number;
}): string {
  const { short, pathName, lenderPathName, need } = args;
  const { aptitudePoints } = PASSIVE_TREE_VOCABULARY.currency;
  if (lenderPathName) {
    return `Opens at ${need} ${aptitudePoints}. ${short} more in ${pathName}, or ${short} more in ${lenderPathName}.`;
  }
  return `Opens at ${need} ${aptitudePoints}. ${short} more in ${pathName}.`;
}
