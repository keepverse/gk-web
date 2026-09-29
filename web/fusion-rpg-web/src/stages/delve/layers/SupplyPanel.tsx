import type { Pending } from "@/contract/pending";
import type { SupplyView } from "@/contract/types";

function fallbackText(supply: Pending<SupplyView>): string {
  return supply.state === "pending" ? supply.reason : "Pick a room first.";
}

export type SupplyPanelProps = {
  /**
   * A presentation-level wrapper, the same move `TalkPanel`/`ObjectPromptPanel` make: `SupplyView`'s
   * own fields (`ok`/`reason`/`decrementContainerId`) are real, but the type itself models an **act's
   * outcome** (`SupplyUse.Use`, spent now), not a browse read — `SupplyView`'s own doc comment names
   * this as a genuine, still-open ambiguity ("whether a future browse-panel read needs a *different*
   * type"). Opening this panel is not itself an act, so there is never a real outcome to show the
   * moment it opens either way — `DelvePanelHost.tsx`'s own `supplyForRoom` supplies `absent()` when no
   * room is selected, `pending` otherwise.
   */
  supply: Pending<SupplyView>;
};

/**
 * Band-2 Supply panel (D5.7, spec-delve-stage.md §7: "what the party carries that can be used here").
 * `decrementContainerId` is never rendered raw — an internal bookkeeping id (which container a use
 * would draw down), not something a player reads; `ok`/`reason` are the real player-facing content once
 * an outcome exists. Unlike a wire id, `SupplyView.reason` is **authored content** when it is real —
 * `SupplyUse.Use`'s own outcome sentence, the same "authored text renders verbatim, vocabulary alone is
 * translated" split §8's own opening paragraph draws — so it is shown as-is here, not routed through
 * `labels.ts`.
 */
export function SupplyPanel({ supply }: SupplyPanelProps) {
  return (
    <div data-testid="delve-panel-supply" className="flex flex-col gap-2 text-2xs">
      {supply.state === "known" ? (
        <>
          <p
            data-testid="delve-supply-outcome"
            className={supply.value.ok ? "text-ok" : "text-bad"}
          >
            {supply.value.reason}
          </p>
          {supply.value.decision.state === "pending" ? (
            <p className="italic text-muted" data-testid="delve-supply-decision-pending">
              {supply.value.decision.reason}
            </p>
          ) : null}
        </>
      ) : (
        <p className="italic text-muted" data-testid="delve-supply-fallback">
          {fallbackText(supply)}
        </p>
      )}
    </div>
  );
}
