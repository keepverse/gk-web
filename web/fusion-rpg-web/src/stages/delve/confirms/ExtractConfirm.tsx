import type { Magnitude } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { ConfirmDialog } from "@/ui";

export type ExtractConfirmProps = {
  open: boolean;
  /** `DelveView.soulsUnbanked` — a `count` magnitude, never rendered raw (magnitudeGuard). This
   * component never touches the wire number itself, only `formatMagnitude`'s own output — no client
   * arithmetic, matching spec-delve-stage.md §16's "never" list. */
  unclaimedSouls: Magnitude;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * D5.8 — one of the three band-3 confirms spec-delve-stage.md §7 names ("Confirms, not results — they
 * name what is staked before it is staked"). §8's own vocabulary table gives the literal player phrase
 * for this decision kind: "`extract` → *Leave with the haul*" (`:176`) — used as both the title and the
 * confirm label here, never a paraphrase. A thin, direct reuse of the shared `ui/ConfirmDialog` (no
 * other content beyond a title/message/tone this component supplies) — the established convention
 * confirmed by reading every other call site (`SpeciesBuildPanel.tsx`, `StoragePage.tsx`) before this
 * one: none of them needed anything `ConfirmDialog`'s own flat `message: string` shape couldn't already
 * express, so this component composes it rather than inventing a second dialog shell. Contrast
 * `DescendConfirm`, which genuinely needs interactive content (the Oath checkbox) `ConfirmDialog` has
 * no slot for, and is built as its own small dialog instead.
 *
 * The actual "declare extract" order this confirms is a live-session decision
 * (spec-delve-stage.md §9's own table: navigating away is NOT extract; only an explicit decision is) —
 * `session.ts` (D5.11, unbuilt: `DelveHud.tsx`'s own doc comment names D5.11/D2.16 as "both correctly
 * still blocked") owns actually posting it. This component is deliberately pure/presentational (no
 * data-fetching, no mutation of its own) so whichever task wires the live session can drop it in as-is,
 * matching the "confirms, not results" framing exactly: this names what is staked, the caller decides
 * how the decision is actually sent.
 */
export function ExtractConfirm({ open, unclaimedSouls, busy = false, onConfirm, onCancel }: ExtractConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Leave with the haul"
      message={`Your party leaves the delve now, banking ${formatMagnitude(unclaimedSouls)} unclaimed souls and everything carried. Anyone still down stays down — there's no second trip back for them this run.`}
      confirmLabel="Extract"
      cancelLabel="Stay"
      tone="primary"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="extract-confirm"
    />
  );
}
