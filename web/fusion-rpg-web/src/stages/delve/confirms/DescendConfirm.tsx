import { Banner, Button, Checkbox } from "@/ui";
import { DialogShell } from "@/shell/DialogShell";

export type DescendConfirmProps = {
  open: boolean;
  /** Authored content (`spec-domain-catalog.md:63`: "the only fields a player reads") — rendered
   * verbatim, never translated. */
  domainName: string;
  /** `entryKindLabel(offer.entryKey)` — pre-computed by the caller (`DelvePickerLayer`), which already
   * holds the `DomainOfferView`. This component stays presentational: it renders phrases, it never
   * reaches into `labels.ts` or the contract itself. */
  entryKindPhrase: string;
  /** The chosen rung or tail step's own display line (`"{label} — {bandName}"`), also pre-computed by
   * the caller — `RungOfferView` is a discriminated union the caller has already resolved by the time
   * a Descend attempt reaches this dialog. */
  rungLabel: string;
  /** `raidModeLabel(raidMode)`, pre-computed. */
  raidModePhrase: string;
  memberCount: number;
  /** The chosen rung's own `kind === "rung" && oathOffered` — spec-domain-catalog's real, per-rung
   * flag, precise-checked by the caller rather than this component approximating it from
   * `entryKey === "single-descent"` alone (the acceptance line's own compressed "single-descent
   * domains and the Oath" framing; the real gate is per-rung, not per-domain). */
  requiresOath: boolean;
  /** The chosen rung's own `permadeath` flag — shown to explain *why* the Oath matters, never gates
   * anything on its own (`oathOffered` is the real gate; a rung could in principle offer the Oath
   * without `permadeath`, and this dialog doesn't assume otherwise). */
  permadeath: boolean;
  oathAccepted: boolean;
  onOathAcceptedChange: (accepted: boolean) => void;
  busy?: boolean;
  /** `startRefusalMessage(reason)` — pre-computed by the caller from the last real POST's own answer,
   * `null` when there hasn't been a refused attempt yet. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
};

/**
 * D5.8 — the Descend confirm (spec-delve-stage.md §7: "Descent confirm (single-descent domains, and
 * the Oath)"). Built on `shell/DialogShell` — the app's own canonical band-3 shell — not
 * `ui/ConfirmDialog` (unlike `ExtractConfirm`/`RetreatConfirm`): `ConfirmDialog`'s own shape is a flat
 * `message: string` with no slot for the Oath checkbox, a real interactive control that must gate the
 * confirm button's own enabled state, not just informational text. `DialogShell` accepts arbitrary
 * `children`, which the Oath section and the refusal banner need.
 *
 * **Not a hand-rolled dialog — an earlier draft was, and it was wrong on two counts, both caught by
 * this program's own real-tree guards, not by review:** `shell/keymapGuard.ts`'s
 * `scanForStrayGlobalKeydownBindings` (T3: "the stack is the *single* source of truth for Esc" — a
 * component-local global keydown subscription is a second, competing owner, and `ui/ConfirmDialog.tsx`'s
 * own is a named, accepted, pre-existing exception, not a pattern to keep copying) and
 * `shell/bandGuard.ts`'s `scanForUnvettedDialogBandOwners` (GG-53: only an allow-listed
 * path may claim the `band-dialog` class or render `DialogShell` — `stages/delve/bandDiscipline.test.ts`'s
 * own `Only_the_summary_and_three_confirms_open_band_3`, built ahead of this file by the sibling D5.9
 * task, is the real-tree proof). `DialogShell` itself already owns both correctly — it pushes onto
 * `useLayerStack` (the single Esc owner, matching `PanelShell`'s own precedent) and is the shell GG-53
 * expects a fully-controlled band-3 surface to use — so building on it instead of hand-rolling closes
 * both guards at once, the fix being architectural, not a suppression.
 */
export function DescendConfirm({
  open,
  domainName,
  entryKindPhrase,
  rungLabel,
  raidModePhrase,
  memberCount,
  requiresOath,
  permadeath,
  oathAccepted,
  onOathAcceptedChange,
  busy = false,
  errorMessage = null,
  onConfirm,
  onCancel,
  testId = "descend-confirm"
}: DescendConfirmProps) {
  const canConfirm = !requiresOath || oathAccepted;

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        // DialogShell/Radix calls this both on backdrop click and via the global keymap's own Esc
        // handling (through the layer stack's pushed `close`) — both routes land here, matching
        // ConfirmDialog's own "cancels unless busy" rule.
        if (!next && !busy) onCancel();
      }}
      title={`Descend into ${domainName}`}
      testId={testId}
      footer={
        <>
          <Button
            data-testid={`${testId}-cancel`}
            size="sm"
            variant="ghost"
            disabled={busy}
            title={busy ? "Working — can't cancel mid-request" : undefined}
            onClick={onCancel}
          >
            Stay
          </Button>
          <Button
            data-testid={`${testId}-confirm`}
            size="sm"
            variant="primary"
            disabled={busy || !canConfirm}
            title={busy ? "Working…" : !canConfirm ? "Accept the Oath to descend" : undefined}
            onClick={onConfirm}
          >
            {busy ? "Working…" : "Descend"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted" data-testid={`${testId}-recap`}>
        {entryKindPhrase} · {rungLabel} · {raidModePhrase} · {memberCount}{" "}
        {memberCount === 1 ? "creature" : "creatures"}
      </p>

      {requiresOath ? (
        <div className="mt-3 rounded-sm border border-warn/50 bg-warn/10 p-3" data-testid={`${testId}-oath`}>
          <p className="text-sm text-text">
            {permadeath
              ? "This is a single descent. Anyone who falls here is Fallen for good — the Oath is how you say you understand that."
              : "This is a single descent — there's no second try at this rung. The Oath is how you say you understand that."}
          </p>
          <Checkbox
            label="I accept the Oath"
            checked={oathAccepted}
            onChange={(e) => onOathAcceptedChange(e.target.checked)}
            disabled={busy}
            title={busy ? "Working — can't change this mid-request" : undefined}
            data-testid={`${testId}-oath-checkbox`}
          />
        </div>
      ) : null}

      {errorMessage ? (
        <Banner tone="error" className="mt-3 rounded-sm" data-testid={`${testId}-error`}>
          {errorMessage}
        </Banner>
      ) : null}
    </DialogShell>
  );
}
