import { useEffect } from "react";
import type { ExtractionView, Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { DialogShell } from "@/shell/DialogShell";
import { formatMagnitude } from "@/i18n/magnitude";
import { extractionOutcomeLabel } from "@/stages/delve/labels";
import { useDelveReportQueue } from "./reportQueue";

export type ExtractionSummaryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: ExtractionView;
};

/** `Pending<unknown[]>` (`levelUps`/`joins`) has no defined shape for a hypothetical `known` value —
 * no adapter anywhere produces one (`ExtractionView`'s own doc comment). The one honest thing this
 * component can say about a `known` array it cannot interpret is its length — the same "read by length
 * only, never a per-entry shape" idiom `FightInPlace.tsx` already established for `initiative`/
 * `strikeFeed`, the closest real precedent for an opaque-content array on this exact stage. */
function pendingCountLine(p: Pending<unknown[]>, noun: string): string {
  if (p.state === "known") return `${p.value.length} ${noun}${p.value.length === 1 ? "" : "s"}`;
  return p.state === "pending" ? p.reason : "Nothing to show.";
}

/** `firstClearGrant` is `Pending<unknown>` — a single opaque value, not an array, so there is nothing
 * to count either; a hypothetical `known` state can only honestly report THAT a grant exists, never
 * its contents (the same "shape not built, fact acknowledged" restraint `pendingCountLine` above
 * takes for the plural case). */
function pendingFlagLine(p: Pending<unknown>, whenKnown: string): string {
  if (p.state === "known") return whenKnown;
  return p.state === "pending" ? p.reason : "Nothing to show.";
}

function recoverPhrase(recoverDelves: Magnitude): string {
  return `${formatMagnitude(recoverDelves)} more descent${recoverDelves.value === 1 ? "" : "s"}`;
}

/**
 * D5.9 (spec-delve-stage.md §7's band-3 row: "The extraction summary — the one result, with any wipe
 * or permanent-loss notice **folded in**"). The only band-3 result this stage produces
 * (`ExtractionSettlement.Decide`, `DelveLoot.AtExtraction`) — a report, not a decision, so its footer
 * carries one dismissal, never a confirm/cancel pair.
 *
 * **No live trigger exists anywhere in this codebase, named honestly rather than hidden.** Confirmed
 * by direct search, not assumed: `DelveEndpoints.cs` registers exactly `GET /{delveId}`,
 * `GET /domains/{playerId}`, `POST /start` — no `extract`/`retreat` route of any kind — and
 * `lib/bus/delve.ts` exposes only `useDelve`, no extraction-fetching hook. `adaptExtraction`
 * (`contract/adapt.ts`) is real and tested (`adaptDelve.test.ts`) but has zero production callers. This
 * component is consequently built and proven purely against `ExtractionView`'s own real, sealed shape
 * plus this task's own fixture (`extractionFixture.ts`) and test suite — the same "structurally
 * complete, no live wire yet" posture `FightView`'s own consumers (`FightInPlace.tsx`, D5.5) already
 * established for the identical reason.
 *
 * **"Folded in," read from real fields, not invented ones.** `wiped: Pending<boolean>` has no producer
 * wired (`ExtractionView`'s own doc comment) and is rendered honestly through the `Pending` convention
 * below — today that is always its own real pending reason, never a guess. The PER-MEMBER permanent
 * loss the acceptance line is chiefly about is not `Pending` at all, though: `outcome === "Retire"` is
 * a real, already-decided field on every member (`ExtractionSettlement.Decide`'s own `permadeathApplies`
 * branch), so the notice below is built from that real signal — a plain count of `Retire` outcomes,
 * `Array.prototype.filter`+`.length` over an already-resolved list of strings, not arithmetic on a
 * Magnitude (§16's own "never" list is about game-balance figures — souls, damage — never about
 * counting categorical outcomes for a UI notice; `shell/Toasts.tsx`'s own `hiddenCount` already does
 * the identical plain-array-length arithmetic for the same reason).
 *
 * **No display name anywhere for a member, the same absence `hud/MemberRow.tsx` (D5.6) already named
 * for the live, in-room case.** `ExtractionView.members` carries only `instanceId` — no species or
 * roster name is joined in (that lives on the roster's own `UniqueActor` row). This component follows
 * `MemberRow.tsx`'s own resolution exactly: `instanceId` keys `data-testid` for tests/devtools only and
 * is never rendered as copy; each row shows only what IS real (outcome, the recovery count, whether it
 * cleared), with no invented name or ordinal standing in for one.
 */
export function ExtractionSummary({ open, onOpenChange, extraction }: ExtractionSummaryProps) {
  const hold = useDelveReportQueue((s) => s.hold);
  const release = useDelveReportQueue((s) => s.release);

  // Spec §7's own "a report arriving while the summary is open waits behind it" — the band-4 queue is
  // held for exactly this component's own open lifetime, mirroring DialogShell's own push/pop-on-open
  // effect shape one layer up. This does not make the summary self-opening (GG-53/W105's own concern):
  // `open` is still entirely the caller's — this effect only holds an UNRELATED queue while it is true.
  useEffect(() => {
    if (!open) return;
    hold();
    return () => release();
  }, [open, hold, release]);

  const fallenCount = extraction.members.filter((m) => m.outcome === "Retire").length;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Extraction summary"
      testId="extraction-summary"
      footer={
        <button type="button" data-testid="delve-summary-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      }
    >
      <dl data-testid="delve-summary-souls" className="flex flex-col gap-1 text-xs">
        {/* Kept as two figures, never pre-summed here — §16's own "never do arithmetic on a figure in
            the client" list; `soulsFromKills`/`soulsFromVictory` are the two the server actually
            separates (`ExtractionEarn.Kills`/`.Victory`), and there is no third, server-composed total
            field to read instead. */}
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Souls from kills</dt>
          <dd data-testid="delve-summary-souls-kills">{formatMagnitude(extraction.soulsFromKills)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Souls from victory</dt>
          <dd data-testid="delve-summary-souls-victory">{formatMagnitude(extraction.soulsFromVictory)}</dd>
        </div>
      </dl>

      {fallenCount > 0 ? (
        <p data-testid="delve-summary-fallen-notice" className="mt-2 font-semibold text-bad">
          {fallenCount} member{fallenCount === 1 ? "" : "s"} fell for good this run.
        </p>
      ) : null}

      <p data-testid="delve-summary-wiped" className="mt-1 text-2xs italic text-muted">
        {extraction.wiped.state === "known"
          ? extraction.wiped.value
            ? "The raid wiped."
            : "The raid did not wipe."
          : extraction.wiped.state === "pending"
            ? extraction.wiped.reason
            : "Nothing to show."}
      </p>

      <ul data-testid="delve-summary-members" className="mt-2 flex flex-col gap-1 text-xs">
        {extraction.members.map((m) => (
          <li key={m.instanceId} data-testid={`delve-summary-member-${m.instanceId}`} className="flex items-center gap-1.5">
            <span data-testid={`delve-summary-outcome-${m.instanceId}`}>{extractionOutcomeLabel(m.outcome)}</span>
            {m.outcome === "Recover" ? (
              <span data-testid={`delve-summary-recover-${m.instanceId}`} className="text-muted">
                — {recoverPhrase(m.recoverDelves)}
              </span>
            ) : null}
            {m.won ? (
              <span data-testid={`delve-summary-cleared-${m.instanceId}`} className="rounded-pill bg-ok-solid px-1.5 py-0.5 text-2xs">
                Cleared
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-col gap-1 text-2xs italic text-muted">
        <p data-testid="delve-summary-first-clear">{pendingFlagLine(extraction.firstClearGrant, "A first-clear reward was granted.")}</p>
        <p data-testid="delve-summary-level-ups">{pendingCountLine(extraction.levelUps, "level-up")}</p>
        <p data-testid="delve-summary-joins">{pendingCountLine(extraction.joins, "new arrival")}</p>
      </div>
    </DialogShell>
  );
}
