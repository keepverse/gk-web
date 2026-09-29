import { reasonFor } from "./reasonFor";

export type ActionVerb = {
  id: string;
  /** Player-facing verb label — "Claim", "Build a well", never an engine token. */
  label: string;
  /** A raw engine refusal reason (`"claim.contested"`) when disabled; `null` when the verb is
   * available. This component never decides admissibility itself — the caller (whatever already
   * knows the sector/legion state) supplies the verdict; this only renders it correctly. */
  disabledReason: string | null;
  onActivate?: () => void;
};

export type ActionClusterProps = {
  verbs: ActionVerb[];
};

/**
 * The action cluster (world-stage W64) — GG-55's two properties, and the second is the one that
 * gets lost. **Never hidden**: every verb renders in its declared position whether enabled or not —
 * hiding an unavailable verb is AoW4's failure, where the player concludes it doesn't exist.
 * **The reason is visible, not a tooltip**: `ui/disabledReasonGuard.ts`'s own scan accepts a bare
 * `title`/`aria-label`/`aria-describedby` as satisfying GG-55, but that is the floor, not the bar
 * here — a hover-only reason is unreachable on touch and invisible to a keyboard user who hasn't
 * focused the control yet, so the reason is real, visible sibling text (queried by text, not by
 * `title`) that also happens to be the same node `aria-describedby` points at, satisfying both at
 * once. Every reason renders through `reasonFor.ts`, `world-playback`'s own one table (W72) — never
 * a second copy — so no engine token (`claim.contested`, `build.cannot-afford`, …) ever reaches
 * the visible text or the accessible name.
 */
export function ActionCluster({ verbs }: ActionClusterProps) {
  return (
    <div data-testid="action-cluster" className="flex flex-col gap-2">
      {verbs.map((verb) => {
        const disabled = verb.disabledReason != null;
        const reasonId = `action-reason-${verb.id}`;
        return (
          <div key={verb.id} data-testid={`action-row-${verb.id}`} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              aria-describedby={disabled ? reasonId : undefined}
              onClick={verb.onActivate}
              data-testid={`action-button-${verb.id}`}
              className="rounded-sm border border-border px-2 py-1 text-sm text-text disabled:opacity-50"
            >
              {verb.label}
            </button>
            {disabled ? (
              <span id={reasonId} data-testid={`action-reason-${verb.id}`} className="text-sm text-muted">
                {reasonFor(verb.disabledReason!)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
