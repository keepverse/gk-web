import { bloodlineReadState, type BloodlineDiscovery, type BloodlineReadState } from "@/contract/passivesBloodline";
import type { Pending } from "@/contract/pending";
import { PathCard } from "./PathBrowse";

// `ui/` never binds to a REST DTO type directly (contractGuard.ts's guard 2) -- the same reasoning
// `PathBrowse.tsx:16-18` already documents for `TreeResolveReport` itself: derive the shape from a
// `contract/` function's own return type rather than importing the wire type here.
type TreeReport = Extract<BloodlineReadState, { kind: "tree" }>["report"];

/**
 * Level 0b's READ route (passive-tree-todo.md I5, spec-tree-surface.md §3). This is the Creature
 * Codex's entry point into the canonical tree surface (GG-9: "other surfaces link into the
 * canonical one rather than re-implementing it") -- read-only, no Unlock verb, no deepen stepper,
 * because nothing reachable from the Codex is spendable. The SPEND route (this creature's own actor
 * sheet, the bloodline pinned above the shared paths) is a separate task; this component only has
 * to answer "what does this bloodline look like," never "let the player allocate into it."
 *
 * Deliberately NOT wired into `CreaturesPage.tsx` by this task. That file's own codex grid
 * (`CreaturesPage.tsx:367-388`) has a live, unrelated GG-50 volume defect (840 species mapped with no
 * windowing strategy) that is another program's file to fix (§3's own callout;
 * passive-tree-todo.md's non-blocking-asks table: "I5 ships without the Codex entry point and the
 * route is added after"). This component IS the "after" -- self-contained, fixture-tested, ready to
 * be handed a real per-creature species-tree query the moment that other defect is closed.
 *
 * §9's silhouette rule is checked by `bloodlineReadState` before this component ever looks at
 * `report`, so an undiscovered bloodline degrades correctly even if a report happens to already be
 * loaded (the trust boundary lives in the pure function, not repeated here).
 */
export function BloodlineTree({
  speciesName,
  discovery,
  report
}: {
  /** Player-facing species name. Rendered only once the bloodline is known -- an undiscovered
   * bloodline never prints it, matching `CreaturesPage.tsx`'s own "???" idiom. */
  speciesName: string;
  discovery: BloodlineDiscovery;
  report: Pending<TreeReport>;
}) {
  const state = bloodlineReadState(discovery, report);

  if (state.kind === "silhouette") {
    // §9's silhouette presentation, the exact idiom `CreaturesPage.tsx:377-383` already ships for the
    // species catalog grid -- reused rather than invented a second time: grayscale, "???", no tree
    // content of any kind. Never a distance and never a condition (those are §9's other two
    // presentations, reserved for a deep tier and a gate-less path respectively -- not for this).
    return (
      <div className="rounded-md border border-border p-3 opacity-30 grayscale" data-testid="bloodline-silhouette">
        <p className="font-display text-text">???</p>
        <p className="text-xs text-muted">Undiscovered</p>
      </div>
    );
  }

  if (state.kind === "pending") {
    return (
      <p className="text-sm text-muted" data-testid="bloodline-pending" aria-busy="true">
        {state.reason}
      </p>
    );
  }

  if (state.kind === "empty") {
    return (
      <p className="text-sm text-muted" data-testid="bloodline-empty">
        No bloodline on file for {speciesName}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="bloodline-tree">
      <p className="text-2xs font-bold uppercase tracking-wide text-muted">{speciesName}&rsquo;s bloodline</p>
      <PathCard tree={state.report} />
    </div>
  );
}
