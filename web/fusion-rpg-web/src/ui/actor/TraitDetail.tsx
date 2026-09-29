import { Button } from "@/ui";
import { useToastStack } from "@/shell/toastStack";
import { cellStateFor } from "@/contract/passivesLattice";
import { exclusionPrintFor, newlyInertFindings, traitNotWorking } from "@/contract/passivesTrait";
import { PASSIVE_TREE_VOCABULARY } from "@/contract/passiveTreeVocabulary";
import { useAllocationDraft } from "@/hooks/useAllocationDraft";

// `ui/` never binds to a REST DTO type directly (contractGuard.ts's guard 2) -- same pattern
// `PathLattice.tsx`/`PathBrowse.tsx` already use: derive the element shape from a `contract/`
// function's own parameter type rather than importing `TreeResolveReport`/`TreeNodeSummary` here.
type TreeReport = Parameters<typeof cellStateFor>[1];
type TreeNode = Parameters<typeof cellStateFor>[0];

/**
 * passive-tree-todo.md I7 — Level 3, the trait detail (spec-tree-surface.md §4, §8). Pushed from
 * `PathLattice.tsx` (Level 2) exactly the way Level 2 is pushed from `PathBrowse.tsx` (Level 1) --
 * `PassivesTab.tsx`'s own `openTreeId`/`setOpenTreeId` push-state pattern, extended one level with
 * `openNodeId`/`setOpenNodeId`, never a parallel navigation mechanism.
 *
 * **One verb per cell, three states (§4)** — this file reads the SAME `cellStateFor` I6's own
 * `TraitCell` already renders (imported straight from `passivesLattice.ts`), so Level 2 and Level 3
 * can never disagree about whether a node is owned, available or locked.
 *
 * **The deepen control is a STEPPER, never a slider or a raw-id `NumberInput`** (§4 rule 1: "a slider
 * needs a maximum; PS-8 forbids one"; rule 2: "a 40-trait grid must not inherit" the raw-id defect at
 * `AptitudesPage.tsx:64-65`). No shared Stepper component exists anywhere in this app today (searched:
 * zero hits) -- these are three plain `Button`s, matching §4's own worked example (`[ - ] [ + ]
 * [ +10 ]`), each with a real `aria-label`, never a bare numeric `<input>`.
 *
 * **The step edits the DRAFT, not the server** (§4 rule 3) -- `useAllocationDraft` (I2's own shared
 * hook, extracted for exactly this: "a tree-spend flow reads/writes a Record<string, number>
 * allocation exactly the same shape"), never a lattice-local sibling. `budget: Infinity` is the
 * literal rendering of PS-8 ("souls are uncapped") through a hook whose own contract is "never clamps
 * to the budget, only to a legal non-negative integer" -- `withinBudget` is simply always true, which
 * is the honest state for an uncapped currency, not a fabricated cap.
 *
 * **A nullified trait renders INERT, never un-unlocked** (§8, D40) -- `traitNotWorking` reads the
 * exact same union `passivesYours.ts`'s Level-0 count already reads, so this card and that count can
 * never disagree about which traits have stopped working.
 *
 * **The finding is a toast (GG-16), never a modal** (§8 "Finding it without opening thirty-nine
 * paths", part 2) -- a successful save diffs the tree's own excluded-node set before/after
 * (`newlyInertFindings`, pure) and pushes one `useToastStack` toast per newly-inert trait, naming both
 * the trait and its winner. No dialog shell or its band class anywhere in this file —
 * `bandGuard.test.ts` scans the real tree for exactly that.
 */
export function TraitDetail({
  node,
  report,
  soulLevelByNodeId,
  initialSoulLevelByNodeId,
  onSaveNodes,
  isSaving,
  onBack,
  onDraftChange,
  onCommitted
}: {
  node: TreeNode;
  report: TreeReport;
  /** The WHOLE actor's owned soul-level map, never this tree's own subset -- `onSaveNodes` submits
   * one whole allocation (§4 rule 3), and a tree-scoped draft would silently drop every other tree's
   * owned nodes on save (`SaveTreeNodeState`'s own full delete-then-insert contract). This is the
   * TRUE, COMMITTED server state -- `dirty`/Revert always compare/restore against exactly this
   * (GG-15), never `initialSoulLevelByNodeId` below. */
  soulLevelByNodeId: Record<string, number>;
  /** I8 — what the draft SEEDS from the one time it seeds, when it differs from `soulLevelByNodeId`
   * (`PassivesTab`'s own server-values-merged-with-its-lifted-Plan view, `mergeSoulLevels`). Lets
   * reopening this panel show wherever the Plan last left this node -- "a Plan outlives the panel"
   * (§5.1) -- WITHOUT that pending value ever being mistaken for already-committed: `dirty` still
   * reads `soulLevelByNodeId` only. Optional; omitting it (every pre-I8 caller) reproduces I7's exact
   * behaviour, since `useAllocationDraft` itself falls back to `serverValues` when this is absent. */
  initialSoulLevelByNodeId?: Record<string, number>;
  /** Commits the whole draft and resolves with the resulting reports (I8 owns the surrounding
   * Revert/Plan/preview UX around this same save path -- this is the first real caller of it). */
  onSaveNodes: (nodes: Record<string, number>) => Promise<TreeReport[]>;
  isSaving: boolean;
  onBack: () => void;
  /** I8 — fires on every draft edit (stepper click), mirroring the new value up to `PassivesTab`'s
   * own lifted Plan so it survives THIS panel closing. Optional: a caller with no lifted Plan (e.g.
   * every pre-I8 test) simply keeps this component's own local draft as the only copy, exactly the
   * I7 behaviour. */
  onDraftChange?: (nodeId: string, soulLevel: number) => void;
  /** I8 — fires once a Save has committed successfully, so `PassivesTab` can clear its lifted Plan
   * (the whole Plan, not just this node: Save always commits the WHOLE draft, §4 rule 3, so whatever
   * else was pending elsewhere in the Plan just committed too). Optional, same reasoning as
   * `onDraftChange`. */
  onCommitted?: () => void;
}) {
  const state = cellStateFor(node, report);
  const notWorking = traitNotWorking(report.treeId, node.nodeId, report);
  const exclusion = exclusionPrintFor(node.nodeId, report);
  const push = useToastStack((s) => s.push);

  const draft = useAllocationDraft({
    serverValues: soulLevelByNodeId,
    initialValues: initialSoulLevelByNodeId,
    budget: Number.POSITIVE_INFINITY,
    isSaving,
    onSave: async (nodes) => {
      const before = [report];
      const afterTrees = await onSaveNodes(nodes);
      const after = afterTrees.filter((t) => t.treeId === report.treeId);
      for (const finding of newlyInertFindings(before, after)) {
        push({
          tone: "warn",
          title: `${finding.nodeId} stopped working`,
          message: `Switched off by ${finding.winnerNodeId}.`
        });
      }
      onCommitted?.();
    }
  });

  const currentDepth = draft.draft?.[node.nodeId] ?? soulLevelByNodeId[node.nodeId] ?? 0;

  function step(delta: number) {
    const next = Math.max(0, Math.trunc(currentDepth + delta));
    draft.setValue(node.nodeId, next);
    onDraftChange?.(node.nodeId, next);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="passives-trait-detail">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="passives-trait-back"
          className="text-xs text-muted underline"
        >
          ← {report.treeId}
        </button>
        <span className="font-display text-text" data-testid="passives-trait-name">
          {node.name ?? node.nodeId}
        </span>
      </div>

      {/* seedsmith-content-standard, content-completeness-passive-tree (2026-09-08): the real
          generated flavor text once tree-language has reached this node -- omitted entirely
          (never a placeholder) when it hasn't. */}
      {node.flavor ? (
        <p className="text-2xs italic text-muted" data-testid="passives-trait-flavor">
          {node.flavor}
        </p>
      ) : null}

      <p className="text-xs text-muted" data-testid="passives-trait-state" data-state={state}>
        {state === "owned"
          ? `${PASSIVE_TREE_VOCABULARY.track.depthLabel} ${currentDepth}`
          : state === "available"
            ? `Available to ${PASSIVE_TREE_VOCABULARY.track.unlockVerb}`
            : "Locked -- open more tiers to reach this trait"}
      </p>

      {/* §8: a nullified trait renders INERT, never un-unlocked -- it keeps its "owned" state above
          AND carries this distinct block: red border, the word "Not working", a distinct fill --
          never colour alone (GG-27). Same union `passivesYours.ts`'s Level-0 count already reads. */}
      {notWorking ? (
        <p
          className="border-l-2 border-bad bg-panel-inset pl-2 text-xs text-text"
          data-testid="passives-trait-not-working"
          data-kind={notWorking.reason}
        >
          <span className="font-bold text-bad">Not working</span> —{" "}
          {notWorking.reason === "nullified"
            ? `switched off by ${notWorking.winnerNodeId}`
            : "the gate that opened it has since closed"}
        </p>
      ) : null}

      {/* §8: printed on both traits, always, whether or not it is currently firing -- reroute and
          precedence still contribute (only nullification is inert, rendered above), so this prints
          for every form the wire carries, all three of D40's kept forms. */}
      {exclusion ? (
        <p
          className="text-2xs text-muted"
          data-testid="passives-trait-exclusion"
          data-form={exclusion.form}
          data-winner={exclusion.isWinner ? node.nodeId : exclusion.otherNodeId}
        >
          {exclusion.ruleText}
        </p>
      ) : null}

      {state === "owned" ? (
        <div className="flex flex-col gap-1" data-testid="passives-trait-deepen">
          <p className="text-2xs text-muted">
            Planned {PASSIVE_TREE_VOCABULARY.track.depthNoun}{" "}
            <span data-testid="passives-trait-planned-depth">{currentDepth}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              aria-label="Decrease depth"
              data-testid="passives-trait-step-down"
              onClick={() => step(-1)}
            >
              −
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              aria-label="Increase depth"
              data-testid="passives-trait-step-up"
              onClick={() => step(1)}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              aria-label="Increase depth by 10"
              data-testid="passives-trait-step-up-10"
              onClick={() => step(10)}
            >
              +10
            </Button>
          </div>

          {draft.dirty ? (
            <div className="flex items-center gap-2" data-testid="passives-trait-save-row">
              <Button
                size="sm"
                variant="primary"
                type="button"
                disabled={isSaving}
                aria-label={isSaving ? "Saving…" : "Save"}
                data-testid="passives-trait-save"
                onClick={() => void draft.save()}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                data-testid="passives-trait-revert"
                onClick={draft.revert}
              >
                Revert
              </Button>
            </div>
          ) : null}

          {draft.error ? (
            <p className="text-2xs text-bad" data-testid="passives-trait-error">
              {draft.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
