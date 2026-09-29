import { reasonFor } from "@/stages/world/inspector/reasonFor";
import type { BlockedPlacement } from "./blockedPlacement";

export type BlockedTargetState =
  | { kind: "available" }
  | { kind: "blocked"; reason: string }
  | { kind: "inert"; explanation: string };

export type BlockedTargetProps = {
  state: BlockedTargetState;
  /** Which of the four subjects this reason belongs to — road / sector / slot / marker
   * (`blockedPlacement.ts`). Purely descriptive here: the *real* placement is wherever the caller
   * actually mounts this, inside the road/sector/slot/marker's own component. */
  placement: BlockedPlacement;
};

/**
 * A blocked or inert target (world-stage W70) — GG-23's second surface. **Three visually distinct
 * treatments, never two dressed up as three**: available is this component's absence entirely (the
 * caller renders its normal control); blocked is hatched, crossed and captioned — never hidden,
 * never merely dimmed, so the player never mistakes "refused" for "gone"; inert is a fourth-channel-
 * distinct calmer treatment (no hatch, no cross — the order simply cannot be carried yet, which is
 * not the same fact as "refused this turn"). Every reason renders through `reasonFor.ts`,
 * `world-playback`'s own one table (W72) — never a second copy — so no raw drop-reason token
 * (`claim.contested`, `build.cannot-afford`, …) ever reaches the rendered sentence.
 */
export function BlockedTarget({ state, placement }: BlockedTargetProps) {
  if (state.kind === "available") return null;

  if (state.kind === "inert") {
    return (
      <div data-testid="blocked-target" data-kind="inert" data-placement={placement}>
        <span aria-hidden="true">…</span>
        <span data-testid="blocked-target-caption">{state.explanation}</span>
      </div>
    );
  }

  const sentence = reasonFor(state.reason);
  return (
    <div data-testid="blocked-target" data-kind="blocked" data-placement={placement} data-pattern="hatched">
      <span aria-hidden="true">✕</span>
      <span data-testid="blocked-target-caption">{sentence}</span>
    </div>
  );
}
