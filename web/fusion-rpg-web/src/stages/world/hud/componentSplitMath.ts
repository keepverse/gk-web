import type { Magnitude } from "@/contract/types";

/**
 * The component-split state's pure fold (world-stage W54). `TerritoryComponents` makes the empire N
 * **purses**, not N sectors (`LoamGauge.tsx:6-8`'s own reasoning, reused here for the map's band-1
 * surface, which never had a place for it that doesn't scroll away): *"my empire is fine"* can be
 * false while half of it starves, so a starving component must never be foldable out of view, and a
 * mere split must never read as an alarm on its own — split is a fact, starving is the event.
 *
 * **Named `componentSplitMath.ts`, not `componentSplit.ts`** (this task's own Files list): on this
 * machine's case-insensitive filesystem, `componentSplit.ts` and `ComponentSplit.tsx` resolve to the
 * same path, so the component's own `import ... from "./componentSplit"` became a circular
 * self-import — the exact defect `modifierLedgerMath.ts` was renamed to avoid at W41/W42, hit again
 * here and fixed the same way.
 */
export type ComponentSplitInput = {
  componentId: string;
  sectorCount: number;
  /** This component's already-settled net, per `LoamComponentSummary` — never re-derived here. */
  net: Magnitude;
};

export type ComponentSplitState = "solvent" | "starving";

export type ComponentSplitRow = {
  componentId: string;
  sectorCount: number;
  net: Magnitude;
  state: ComponentSplitState;
};

/** Band 1 is a fixed height at the 720p floor — this is the ceiling that keeps it that way. */
export const MAX_SPLIT_ROWS = 3;
/** Solvent rows fold past this many, regardless of how much room starving rows leave. */
const MAX_VISIBLE_SOLVENT_ROWS = 2;

export type ComponentSplitView =
  | { kind: "no-territory" }
  | { kind: "collapsed" }
  | { kind: "rows"; rows: ComponentSplitRow[]; foldedSolventCount: number };

/**
 * **Starving rows are never folded, at any count** — the alarm is the one thing this fold refuses
 * to hide behind a row budget. Solvent rows fold past two, and further still whenever starving rows
 * have already spent the shared `MAX_SPLIT_ROWS` budget — a real conflict (more starving components
 * than the budget allows) is resolved by giving every starving row a spot and zero to solvent, never
 * the reverse.
 */
export function componentSplitFor(components: readonly ComponentSplitInput[]): ComponentSplitView {
  if (components.length === 0) return { kind: "no-territory" };
  if (components.length === 1) return { kind: "collapsed" };

  const rows: ComponentSplitRow[] = components.map((c) => ({
    ...c,
    state: c.net.value < 0 ? "starving" : "solvent"
  }));

  const starving = rows.filter((r) => r.state === "starving");
  const solvent = rows.filter((r) => r.state === "solvent");

  const solventBudget = Math.max(0, Math.min(MAX_VISIBLE_SOLVENT_ROWS, MAX_SPLIT_ROWS - starving.length));
  const shownSolvent = solvent.slice(0, solventBudget);

  return {
    kind: "rows",
    rows: [...starving, ...shownSolvent],
    foldedSolventCount: solvent.length - shownSolvent.length
  };
}
