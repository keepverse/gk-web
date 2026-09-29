import type { TreeResolveReport } from "@/lib/bus";
import { notWorkingTraits, type NotWorkingTrait } from "./passivesYours";
import { PASSIVE_TREE_VOCABULARY } from "./passiveTreeVocabulary";

/**
 * passive-tree-todo.md I7 — Level 3 ("the trait, and both tracks", spec-tree-surface.md §4, §8).
 * Pure derivations over `TreeResolveReport`, mirroring the shape `passivesLattice.ts`/
 * `passivesYours.ts` already use so `TraitDetail.tsx` stays a thin render layer (contractGuard.test.ts:
 * no DTO binding and no derivation logic lives under `ui/`).
 *
 * This module deliberately does NOT re-derive a node's owned/available/locked state — `TraitDetail.tsx`
 * imports `cellStateFor` straight from `passivesLattice.ts` (I6), the same function the lattice cells
 * already use, so Level 2 and Level 3 can never disagree about which of the three states a cell is in.
 */

/**
 * §8 finding rule 1 / I4's own acceptance line ("the Level-0 count and its filter agree with what the
 * lattice shows"): this DELEGATES to `passivesYours.ts`'s own `notWorkingTraits` rather than writing a
 * second "is this trait not working" predicate — the two can never drift because there is only one
 * function. `[report]` is enough: D14/D40 exclusions only ever match within one tree
 * (`ExclusionResolver.cs`'s own stated scope), and the gate-closed (D11/D12) invalidation this unions
 * with is per-tree too (`TreeResolveReport.InvalidNodeIds`).
 */
export function traitNotWorking(
  treeId: string,
  nodeId: string,
  report: TreeResolveReport
): NotWorkingTrait | undefined {
  return notWorkingTraits([report]).find((t) => t.treeId === treeId && t.nodeId === nodeId);
}

/** D40's three kept forms, lowercased for player-surface use — the wire sends the C# enum name
 * verbatim (`Form = e.Form.ToString()`, `PassiveTreeEndpoints.cs`), matching `passivesBrowse.ts`'s own
 * "normalize with `.toLowerCase()` rather than assume a casing" precedent. */
export type ExclusionForm = "reroute" | "precedence" | "nullification";

function normalizeForm(form: string): ExclusionForm {
  return form.toLowerCase() as ExclusionForm;
}

/**
 * §8 / D40: "both sides print the rule and name the same winner, in the same words." ONE function
 * composes the sentence and BOTH `exclusionPrintFor` call sites below (the winner's own card and the
 * loser's own card) render this exact string — byte-identical by construction, so the two sides can
 * never disagree about wording or about which node won (test 34).
 *
 * All three forms get their own real sentence — D40 keeps reroute and precedence reachable, not
 * nullification alone. **A real, disclosed content gap, not a fabricated one**: the wire carries no
 * PROPERTY text (`NodeRecord.ExcludeProps` never reaches `ExcludedNodeDto` — `ExclusionResolver.cs`'s
 * key lookup is server-only), so this names the two NODES and the mechanical form, not the authored
 * property sentence §8's own worked example uses ("does nothing while your damage is converted away
 * from fire"). That is the same honest-placeholder shape `passivesYours.ts`'s own `winnerNodeId`
 * already uses (a raw node id stands in for a display name that `tree-language` has not emitted yet)
 * — this renders correctly today and needs no further change once the property text ships.
 */
export function exclusionRuleText(form: ExclusionForm, winnerNodeId: string, loserNodeId: string): string {
  switch (form) {
    case "nullification":
      return `${winnerNodeId} and ${loserNodeId} exclude each other. If both are taken, ${loserNodeId} is the one that stops.`;
    case "precedence":
      return `${winnerNodeId} and ${loserNodeId} exclude each other. If both are taken, ${winnerNodeId} takes precedence.`;
    case "reroute":
      // I10: never the bare word "points" (§15) -- the trait's own wallet is skill points (§4.1:
      // "buys a trait"), named through the vocabulary module rather than spelled out here.
      return `${winnerNodeId} and ${loserNodeId} exclude each other. If both are taken, ${loserNodeId}'s ${PASSIVE_TREE_VOCABULARY.currency.skillPoints} reroute to ${winnerNodeId}.`;
  }
}

export type ExclusionPrint = {
  /** The other node in the pair — the winner when THIS node is the loser, or vice versa. */
  otherNodeId: string;
  /** Whether the node this print is FOR is the one that wins the exclusion. */
  isWinner: boolean;
  form: ExclusionForm;
  /** Only meaningful when `isWinner` is false — D40's nullification is the one form that stops a
   * trait from contributing (§8: "the same red, different sentence"); reroute/precedence still work. */
  isInert: boolean;
  ruleText: string;
};

/**
 * Renders whichever side of an exclusion pair `nodeId` sits on. The wire (`ExcludedNodeDto`) only
 * ever carries an entry keyed on the LOSING node, so a winner's own card has no matching entry of its
 * own — it has to be found by scanning for `winnerNodeId === nodeId` instead. That reverse lookup is
 * what makes "both sides print the rule, naming the same winner" possible with no backend change: the
 * winner id string handed to `exclusionRuleText` is identical whichever side asks (test 34).
 */
export function exclusionPrintFor(
  nodeId: string,
  report: Pick<TreeResolveReport, "excludedNodes">
): ExclusionPrint | null {
  const asLoser = report.excludedNodes.find((e) => e.nodeId === nodeId);
  if (asLoser) {
    const form = normalizeForm(asLoser.form);
    return {
      otherNodeId: asLoser.winnerNodeId,
      isWinner: false,
      form,
      isInert: asLoser.isInert,
      ruleText: exclusionRuleText(form, asLoser.winnerNodeId, nodeId)
    };
  }

  const asWinner = report.excludedNodes.find((e) => e.winnerNodeId === nodeId);
  if (asWinner) {
    const form = normalizeForm(asWinner.form);
    return {
      otherNodeId: asWinner.nodeId,
      isWinner: true,
      form,
      isInert: asWinner.isInert,
      ruleText: exclusionRuleText(form, nodeId, asWinner.nodeId)
    };
  }

  return null;
}

export type NewlyInertFinding = {
  treeId: string;
  nodeId: string;
  winnerNodeId: string;
};

/**
 * §8 "Finding it without opening thirty-nine paths", part 2: "A toast at the moment it happens...
 * allocating the trait that switches another off reports immediately, naming both." A pure diff over
 * two resolve snapshots (the tree(s) before a save, the same tree(s) after) so the toast-firing side
 * effect in `TraitDetail.tsx`/`PassivesTab.tsx` never has to re-derive "is this newly not-working"
 * itself — it reads `ExcludedNode.isInert` off the report both times, the same field
 * `passivesYours.ts`'s own nullified filter reads, never a second definition.
 */
export function newlyInertFindings(
  before: readonly TreeResolveReport[],
  after: readonly TreeResolveReport[]
): NewlyInertFinding[] {
  const beforeInert = new Set(
    before.flatMap((t) => t.excludedNodes.filter((e) => e.isInert).map((e) => `${t.treeId}:${e.nodeId}`))
  );

  const findings: NewlyInertFinding[] = [];
  for (const tree of after) {
    for (const excluded of tree.excludedNodes) {
      if (!excluded.isInert) continue;
      if (beforeInert.has(`${tree.treeId}:${excluded.nodeId}`)) continue;
      findings.push({ treeId: tree.treeId, nodeId: excluded.nodeId, winnerNodeId: excluded.winnerNodeId });
    }
  }
  return findings;
}
