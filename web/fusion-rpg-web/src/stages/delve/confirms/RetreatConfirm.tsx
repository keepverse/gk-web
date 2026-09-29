import { ConfirmDialog } from "@/ui";

export type RetreatConfirmProps = {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * D5.8 — one of the three band-3 confirms spec-delve-stage.md §7 names. §8's own vocabulary table
 * gives the literal player phrase: "`retreat` → *Fall back*" (`:176`) — the title and confirm label
 * here, never a paraphrase. `tone="danger"`, unlike `ExtractConfirm`'s `"primary"`: a retreat forfeits
 * the haul and the unclaimed souls (never banked), the real cost `ExtractionSettlement`/
 * `DelveSoulLedger` would apply — the same "name what is staked before it is staked" framing §7 gives
 * every confirm on this surface, just naming a loss instead of a gain.
 *
 * A direct reuse of the shared `ui/ConfirmDialog` (see `ExtractConfirm.tsx`'s own doc comment for why
 * — no other real caller needed anything richer, and this decision has no interactive content of its
 * own either). Pure/presentational for the identical reason `ExtractConfirm` is: the live-session
 * "declare retreat" order is D5.11's own unbuilt wiring, not this component's job.
 */
export function RetreatConfirm({ open, busy = false, onConfirm, onCancel }: RetreatConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Fall back"
      message="Your party pulls out now, without banking the haul or the souls still unclaimed down there. Whatever wasn't already carried out stays behind."
      confirmLabel="Retreat"
      cancelLabel="Keep going"
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="retreat-confirm"
    />
  );
}
