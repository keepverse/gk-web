import { useEffect, useState } from "react";
import { DialogShell } from "@/shell/DialogShell";
import { needsSayItBack } from "./wardenGate";

/** The four real engine refusals `BindAsWarden` can return (`RpgStore.Contracts.cs:283-326`) —
 * `specimen.missing` should never actually be reachable from this dialog, but the refusal exists
 * on the engine's own list, so it still gets a sentence rather than a silent fallback. */
export type WardenRefusalReason =
  | "capacity.full"
  | "souls.insufficient"
  | "contract.already-bound"
  | "specimen.missing";

function refusalSentence(reason: WardenRefusalReason, creatureName: string): string {
  switch (reason) {
    case "capacity.full":
      return "Every binding slot is taken.";
    case "souls.insufficient":
      return "You cannot pay the fee.";
    case "contract.already-bound":
      return `${creatureName} is already under an ordinary contract.`;
    case "specimen.missing":
      return "This should never be reachable — the specimen is missing.";
    default: {
      const exhaustive: never = reason;
      throw new Error(`refusalSentence: unhandled reason ${JSON.stringify(exhaustive)}`);
    }
  }
}

export type BindWardenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatureName: string;
  sectorName: string;
  /** Binding slots used **after** this bind would count, out of the capacity — e.g. `7` of `8`. */
  slotsUsedAfterBind: number;
  slotsCapacity: number;
  /** The same number as `upkeepPerDay` — binding charges day one (spec §2's own correction). */
  fee: number;
  upkeepPerDay: number;
  balance: number;
  /** One of the engine's four refusals, or `null` when the bind is actually allowed. A refusal
   * renders its sentence before any act is offered — GG-55 — and there is no path past it. */
  refusal: WardenRefusalReason | null;
  onConfirm: () => void;
};

/**
 * world-stage W102/W103 (spec-world-confirms.md §2, §3, plate 11 §K.2/K.3) — the one act on the
 * stage the rest of the game will not undo. Step 1 states the full cost; step 2 ("say it back")
 * appears only when `needsSayItBack` (`wardenGate.ts`, W100) says the balance cannot carry the fee
 * plus one more day's upkeep, and requires typing `bind` — the deliberate GG-24 exception, because
 * the friction *is* the safeguard on an unpayable permanent debt. The verb is **"Bind a warden
 * here"**, never "Ward" — `WardLevel` sits on a lane, `WardenBindingId` on a sector, and an earlier
 * plate calling both "Ward" sent a player choosing the irreversible act to the road overlay instead.
 */
export function BindWardenDialog({
  open,
  onOpenChange,
  creatureName,
  sectorName,
  slotsUsedAfterBind,
  slotsCapacity,
  fee,
  upkeepPerDay,
  balance,
  refusal,
  onConfirm
}: BindWardenDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setTyped("");
    }
  }, [open]);

  const needsStep2 = needsSayItBack(balance, fee, upkeepPerDay);
  const canConfirmStep2 = typed.trim().toLowerCase() === "bind";

  function commit() {
    onConfirm();
    onOpenChange(false);
  }

  function handleContinue() {
    if (needsStep2) setStep(2);
    else commit();
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Bind a warden here"
      testId="bind-warden-dialog"
      footer={
        refusal ? (
          <button type="button" data-testid="bind-warden-cancel" onClick={() => onOpenChange(false)}>
            Close
          </button>
        ) : (
          <>
            <button type="button" data-testid="bind-warden-cancel" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            {step === 1 ? (
              <button type="button" data-testid="warden-continue" onClick={handleContinue}>
                Continue ›
              </button>
            ) : (
              <button
                type="button"
                data-testid="warden-confirm"
                disabled={!canConfirmStep2}
                title={canConfirmStep2 ? undefined : 'Type "bind" to confirm.'}
                onClick={commit}
              >
                Bind the warden
              </button>
            )}
          </>
        )
      }
    >
      {refusal ? (
        <p data-testid="warden-refusal">{refusalSentence(refusal, creatureName)}</p>
      ) : step === 1 ? (
        <>
          <p data-testid="warden-permanence">
            {creatureName} will never leave your roster, never take another contract, and can never be
            released — not for souls, not by retiring it, not ever.
          </p>
          <p data-testid="warden-keep-ground">You keep the ground. You do not keep the creature.</p>
          <ul data-testid="warden-rows">
            <li data-testid="warden-row-permanent">The binding becomes permanent.</li>
            <li data-testid="warden-row-slot">
              One binding slot, spent for good: {slotsUsedAfterBind} / {slotsCapacity} used.
            </li>
            <li data-testid="warden-row-fee">A soul fee, taken now: {fee} souls.</li>
            <li data-testid="warden-row-upkeep">Its daily upkeep never stops: {upkeepPerDay} souls a day.</li>
            <li data-testid="warden-row-exemption">{sectorName} stops fading — permanently exempt.</li>
          </ul>
          <p data-testid="warden-same-rate">
            The fee and the daily rate are the same number, {fee} souls, because binding charges day one.
          </p>
        </>
      ) : (
        <>
          <p data-testid="warden-arithmetic">
            You have {balance} souls. The fee is {fee} and the upkeep is {upkeepPerDay} a day. After
            tonight you cannot pay {creatureName} — an unpaid warden is still bound, and you would be
            carrying a debt you cannot release your way out of.
          </p>
          <label data-testid="warden-bind-label">
            Type <strong>bind</strong> to confirm
            <input
              data-testid="warden-bind-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        </>
      )}
    </DialogShell>
  );
}
