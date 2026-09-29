import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/cn";
import {
  branchesOf,
  GATELESS_CONDITION_TEXT,
  isConditionPresentation,
  type LatticeCell,
  type LatticeTierRow,
  lockedTierReason,
  scrollTargetTier,
  tierDistance,
  tierRows
} from "@/contract/passivesLattice";
import { tierAttribution, type TierAttribution } from "@/contract/passivesPlan";
import { PASSIVE_TREE_VOCABULARY } from "@/contract/passiveTreeVocabulary";

// `ui/` never binds to a REST DTO type directly (contractGuard.ts's guard 2) -- the same pattern
// `PathBrowse.tsx:16-19` and `BloodlineTree.tsx:6-8` already use: derive the shape from a `contract/`
// function's own parameter type rather than importing `TreeResolveReport` from `@/lib/bus` here.
type TreeReport = Parameters<typeof tierRows>[0];

/**
 * passive-tree-todo.md I6 — Level 2, the lattice (spec-tree-surface.md §2.3, §9, §9.1 rules 1-2).
 * `ui/` never binds to a REST DTO type directly (contractGuard.ts's guard 2) and never carries
 * derivation logic (`PathBrowse.tsx:16-18`'s own precedent) — every rule here is read straight off
 * `contract/passivesLattice.ts`'s pure functions; this file only lays them out.
 *
 * **A CSS grid, never a graph library** (§2.3: "Do not reach for a graph library. A 2x10 lattice is a
 * CSS grid... `LockedGridSlot.tsx` is already the cell.") — `xyflowGuard.test.ts` enforces the "not a
 * graph library" half repo-wide; this file simply never imports `@xyflow/react`.
 *
 * **GG-61, not GG-50** (§2.3): all of a path's cells mount directly, no windowing/virtualization —
 * the opposite failure mode from `PathBrowse.tsx`'s 39-path list, which GG-50 covers instead.
 *
 * **The locked reason is visible sibling text, never a `title`** — `ActionCluster.tsx:18-29` already
 * settled this for world verbs (`disabledReasonGuard.ts` accepts a bare `title` as its floor, but "a
 * hover-only reason is unreachable on touch and invisible to a keyboard user"); the same real
 * `<p data-testid=...>` sibling pattern is used here, queried by text in tests, never by `title`.
 */
export function PathLattice({
  tree,
  soulLevelByNodeId,
  reqScalePoints,
  actorTheta,
  onOpenNode,
  onBack,
  nextUnlockPrice,
  onUnlock
}: {
  tree: TreeReport;
  soulLevelByNodeId: Record<string, number>;
  /** `PassiveTreeState.tierReqScalePoints` — the one global ladder constant, read from the wire
   * (never re-derived) so `req(t)` reproduces `TierGate.Reached`'s own formula exactly. */
  reqScalePoints: number;
  /** The actor's OWN current power index (`AptitudesState.theta`), real per-actor data that changes
   * as the actor's build changes -- rendered on a locked tier's distance line as "your power is N
   * today," never the raw `Θ` glyph (`vocabularyGuard.ts`'s own BANNED_SYMBOLS: "a name on screen,
   * never this letter" -- a deliberate, distance-line-only choice; `chip-honesty` (T10) since fixed
   * the aptitude scope chip's own copy off "power {theta}" onto "Lv"/"Ladder", so this file's
   * wording is this surface's own decision, not shared with those anymore).
   *
   * DISCLOSED SIMPLIFICATION: `spec-tree-surface.md` §9's own worked example ("about Θ 139 at your
   * current shape") reads as a PROJECTED power index -- the level the actor would need to reach this
   * tier's aptitude threshold while holding their build's present shape -- which is doc 14's own
   * ladder-inversion math, not yet exposed anywhere as a reusable function. Inventing that inversion
   * client-side would be exactly the "private curve" AGENTS.md's power-ladder rule forbids. This
   * renders the actor's real, already-computed CURRENT power index instead, which is honestly weaker
   * (it does not itself close the gap) but is real, per-actor, and moves as the actor's build changes
   * -- never a stated-once catalog constant. Closing this gap for real is a `tree-resolve`/Core-side
   * follow-up (an inverse-ladder function), not a private client formula.
   */
  actorTheta?: number;
  /** I7 — the push into Level 3 (§2.2: "sheet(1) -> path(2) -> trait(3)"), the SAME push-state
   * pattern `PassivesTab.tsx` already uses for Level 1 -> Level 2 (`onOpen`/`setOpenTreeId`), extended
   * one level rather than a parallel navigation mechanism. Optional so a caller with no Level 3 yet
   * (none remain after this task) keeps rendering a non-interactive cell, matching `PathBrowse.tsx`'s
   * own `onOpen`-optional precedent. */
  onOpenNode?: (nodeId: string) => void;
  onBack: () => void;
  /** I8 (spec-tree-surface.md §4's worked example, "Unlock · 14 pts") — the price of unlocking the
   * VERY NEXT node, right now, at this actor's current owned count. D25's price depends only on the
   * ordinal (`TreeUnlockCost.PriceOfNth`), never on which node, so this single number is correct on
   * EVERY "available" cell in the lattice, not a per-node price table. Optional: a caller with no
   * unlock-cost rates yet (pre-I8 fixtures) simply renders no price on the Unlock verb. */
  nextUnlockPrice?: number;
  /** I8 — the Unlock verb itself (§4: "the cell carries exactly one verb"). Adds the node to the
   * actor's Plan at soul level 0 (owned, not yet deepened — B5 §1.1's own real state), never a direct
   * server write (§4 rule 3: the step edits the draft, not the server). Optional, same `onOpenNode`-
   * optional precedent: a caller with no Plan to write into renders the cell with no Unlock button. */
  onUnlock?: (nodeId: string) => void;
}) {
  const nodes = tree.nodes ?? [];
  const branches = branchesOf(nodes);
  const rows = tierRows(tree, soulLevelByNodeId);
  const targetTier = scrollTargetTier(tree);
  const condition = isConditionPresentation(tree);
  const attribution = tierAttribution(tree);
  const bodyRef = useRef<HTMLUListElement>(null);
  const targetRowRef = useRef<HTMLLIElement>(null);

  // §2.3's own acceptance criterion (test 5): "Level 2 opens scrolled to the player's own depth,
  // never to tier 1." Sets THIS element's own `scrollTop` directly rather than `scrollIntoView`
  // (which can walk up and scroll an ANCESTOR container instead — `PathLattice` renders inside
  // `PanelShell`'s own already-scrollable body, so an ambiguous scroll target is a real risk here,
  // not a theoretical one). jsdom has no layout engine, so the unit tests assert the
  // `data-scroll-target` marker below lands on the right row; the real pixel proof is at
  // e2e/passive-tree-volume.spec.ts's 1280x720 floor.
  useEffect(() => {
    const body = bodyRef.current;
    const target = targetRowRef.current;
    if (body && target) body.scrollTop = target.offsetTop;
  }, [tree.treeId, targetTier]);

  return (
    <div className="flex flex-col gap-2" data-testid="passives-lattice">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="passives-lattice-back"
          className="text-xs text-muted underline"
        >
          ← All paths
        </button>
        <span className="font-display text-text">{tree.treeId}</span>
      </div>

      {condition ? (
        // §9.1 rule 1: names the world, not the player -- no requirement, no have-number, no verb,
        // "coming soon" excluded on purpose (D37: a schedule the program holds is not a date the
        // player was given). Shown once, above the lattice; every tier row repeats the same sentence
        // in place of its own requirement (rule 2), never a bar or a price.
        <p className="text-xs text-muted" data-testid="passives-lattice-condition">
          <span className="font-display text-text">{tree.treeId}</span> — {GATELESS_CONDITION_TEXT}
        </p>
      ) : null}

      {/* I8, §7.2 part 1/D28: named in the fiction ONCE, on a path this actor has not put a point of
          its own into but which is open anyway (a real `lenderTreeId` on THIS report). No engine
          words -- never "cross-unlock", "posture" or "gate" (vocabularyGuard). DISCLOSED
          SIMPLIFICATION: "once" here means once per tree opened, not once ever across a whole
          session/account -- this surface holds no persisted "has the player already seen this"
          flag, and inventing one would be new, unscoped state. Renders only while the fact is true
          (a real lender exists on this report), so it never repeats on a tree the rule doesn't
          apply to. */}
      {!condition && tree.lenderTreeId ? (
        <p className="text-xs text-muted" data-testid="passives-lattice-cross-unlock-fiction">
          Paths of the same stance help each other. Your deepest path lends its progress to the
          others.
        </p>
      ) : null}

      {/* PanelShell's own bounded-height + internally-scrolling-body pattern (`PanelShell.tsx:86,
          96-99`), reproduced here rather than re-derived: GG-61's own text is "this surface already
          does exactly what GG-61 asks." Ten tier rows will not fit at the 1280x720 floor on purpose
          (§2.3) -- the BODY scrolls, never the shell around it. */}
      <ul
        ref={bodyRef}
        className="flex max-h-[min(720px,82vh)] flex-col gap-2 overflow-y-auto"
        data-testid="path-lattice-body"
      >
        {rows.map((row) => (
          <TierRow
            key={row.tier}
            row={row}
            report={tree}
            reqScalePoints={reqScalePoints}
            condition={condition}
            actorTheta={actorTheta}
            attribution={attribution}
            isScrollTarget={row.tier === targetTier}
            branchCount={branches.length || 2}
            rowRef={row.tier === targetTier ? targetRowRef : undefined}
            onOpenNode={onOpenNode}
            nextUnlockPrice={nextUnlockPrice}
            onUnlock={onUnlock}
          />
        ))}
      </ul>
    </div>
  );
}

function TierRow({
  row,
  report,
  reqScalePoints,
  condition,
  actorTheta,
  attribution,
  isScrollTarget,
  branchCount,
  rowRef,
  onOpenNode,
  nextUnlockPrice,
  onUnlock
}: {
  row: LatticeTierRow;
  report: TreeReport;
  reqScalePoints: number;
  condition: boolean;
  actorTheta?: number;
  attribution: TierAttribution | null;
  isScrollTarget: boolean;
  branchCount: number;
  rowRef?: RefObject<HTMLLIElement>;
  onOpenNode?: (nodeId: string) => void;
  nextUnlockPrice?: number;
  onUnlock?: (nodeId: string) => void;
}) {
  const { tier, cells } = row;
  const distance = tierDistance(tier, report, reqScalePoints);
  const reached = tier <= report.tierReached;

  return (
    <li
      ref={rowRef}
      data-testid={`lattice-tier-row-${tier}`}
      data-scroll-target={isScrollTarget ? "true" : undefined}
      className="border-t border-border pt-2 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
        <span className="font-bold text-text">Tier {tier}</span>
        {condition ? (
          // §9.1 rule 2: the tier row shows the condition INSTEAD OF a requirement and a have-number.
          <span className="text-muted" data-testid={`lattice-tier-condition-${tier}`}>
            {GATELESS_CONDITION_TEXT}
          </span>
        ) : (
          <span className="text-muted" data-testid={`lattice-tier-need-${tier}`}>
            opens at {distance.need} {PASSIVE_TREE_VOCABULARY.currency.aptitudePoints} · you have {distance.have}
            {!reached && actorTheta != null ? ` · your power is ${actorTheta} today` : ""}
          </span>
        )}
      </div>

      {!condition && !reached ? (
        // §7.2 part 4 / test 9: visible SIBLING text, never a `title` — queried by text in tests.
        // `lockedTierReason` is the one reason table (§15): the ONLY place this sentence is composed.
        <p className="mt-0.5 text-2xs text-bad" data-testid={`lattice-tier-locked-reason-${tier}`}>
          {lockedTierReason({
            short: distance.short,
            need: distance.need,
            pathName: report.treeId,
            lenderPathName: report.lenderTreeId
          })}
        </p>
      ) : null}

      {/* I8, §7.2 part 2: the POSITIVE attribution -- "55 from Fortitude · 120 lent by Might", the
          same `ChannelContributions.tsx:10-35` grammar (a source name, its own contribution) applied
          to a GATE instead of a stat. EXACTLY ONE lender, always singular (the credit is `max`, never
          a sum) -- `attribution` can only ever name one. Renders on every tier row of this tree (own
          contribution is a tree-wide fact, repeated per row same as `distance.have` already is), and
          only once real data exists (`attribution` is `null` for a pre-I8 fixture -- no fabricated
          split rendered in its place). */}
      {!condition && attribution ? (
        <p className="text-2xs text-muted" data-testid={`tier-sources-${tier}`}>
          {attribution.lenderTreeId
            ? `${attribution.own} from ${report.treeId} · ${attribution.lentAmount} lent by ${attribution.lenderTreeId}`
            : `${attribution.own} from ${report.treeId}`}
        </p>
      ) : null}

      {/* §9: "Show the traits. A locked tier renders its trait names and effects in full." No node
          in the corpus has authored copy yet (this module's own top-of-file doc comment) — cells
          render real, structural identity today, ready for real copy the moment `tree-language`
          ships it. Every cell mounts unconditionally (GG-61: no windowing). */}
      <div
        className="mt-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${branchCount}, minmax(0, 1fr))` }}
        data-testid={`lattice-tier-cells-${tier}`}
      >
        {cells.map((cell) => (
          <TraitCell
            key={cell.node.nodeId}
            cell={cell}
            onOpen={onOpenNode}
            nextUnlockPrice={nextUnlockPrice}
            onUnlock={onUnlock}
          />
        ))}
      </div>
    </li>
  );
}

/**
 * I7 — the push into Level 3. `onOpen` optional, same `PathCard.tsx` precedent: a caller with no
 * Level 3 (none remain after this task) still renders a plain, non-interactive `<div>` cell rather
 * than a dead button.
 *
 * I8, §4: "the cell carries exactly one verb" — the Unlock affordance below is that verb for an
 * "available" cell, rendered as a SIBLING button rather than nested inside the open/push button
 * above (an interactive element can't nest inside another one), with its own `stopPropagation` so
 * clicking Unlock never also pushes into Level 3.
 */
function TraitCell({
  cell,
  onOpen,
  nextUnlockPrice,
  onUnlock
}: {
  cell: LatticeCell;
  onOpen?: (nodeId: string) => void;
  nextUnlockPrice?: number;
  onUnlock?: (nodeId: string) => void;
}) {
  const className = cn(
    "rounded-sm border p-2 text-left text-2xs",
    cell.state === "owned" && "border-lawn-hot text-text",
    cell.state === "available" && "border-border text-text",
    cell.state === "locked" && "border-border text-faint opacity-60"
  );

  const content = (
    <>
      {/* seedsmith-content-standard, content-completeness-passive-tree (2026-09-08): renders the
          real generated name once tree-language has reached this node; falls back to the node id
          for the (still-common) case it hasn't yet, matching the honest placeholder
          `passivesYours.ts` already uses for `winnerNodeId` -- never a fabricated name. */}
      <p className="truncate font-display">{cell.node.name ?? cell.node.nodeId}</p>
      {cell.state === "owned" ? (
        <p className="text-muted">
          {PASSIVE_TREE_VOCABULARY.track.depthLabel} {cell.soulLevel}
        </p>
      ) : null}
    </>
  );

  const cellElement = onOpen ? (
    <button
      type="button"
      data-testid={`lattice-cell-${cell.node.nodeId}`}
      data-state={cell.state}
      className={cn(className, "w-full hover:bg-panel-inset")}
      onClick={() => onOpen(cell.node.nodeId)}
    >
      {content}
    </button>
  ) : (
    <div data-testid={`lattice-cell-${cell.node.nodeId}`} data-state={cell.state} className={className}>
      {content}
    </div>
  );

  const showUnlock = cell.state === "available" && !!onUnlock;
  if (!showUnlock) return cellElement;

  return (
    <div className="flex flex-col gap-0.5">
      {cellElement}
      <button
        type="button"
        data-testid={`lattice-unlock-${cell.node.nodeId}`}
        className="rounded-sm border border-lawn-hot px-1 py-0.5 text-2xs text-text hover:bg-panel-inset"
        onClick={(e) => {
          e.stopPropagation();
          onUnlock!(cell.node.nodeId);
        }}
      >
        {nextUnlockPrice != null
          ? `${PASSIVE_TREE_VOCABULARY.track.unlockLabel} · ${nextUnlockPrice} ${PASSIVE_TREE_VOCABULARY.currency.skillPoints}`
          : PASSIVE_TREE_VOCABULARY.track.unlockLabel}
      </button>
    </div>
  );
}
