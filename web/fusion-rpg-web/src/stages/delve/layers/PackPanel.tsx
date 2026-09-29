import type { PackCellView, PackView, PartyView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { partyBannerLabel } from "@/stages/delve/labels";

/**
 * spec-delve-stage.md §9's own row, verbatim: "An un-steered party takes drops... that party's pack
 * move handles are disabled with a reason" — `"autopilot never moves the pack"` (spec-loot-pack.md);
 * GG-55, `ui/disabledReasonGuard.ts`. Deliberately does not use the word "autopilot" itself: that's
 * this program's own internal rule-id vocabulary (`PackAutopilot.cs`, `PackMoves.DropBy.Autopilot`),
 * not a word §8's table ever offers as player copy, and "band" is already real player vocabulary here
 * (`labels.ts`'s own `raidModeLabel`: "One band" / "Two bands" / "Four bands").
 */
const AUTOPILOT_PACK_REASON = "This band moves on its own — its pack can't be moved.";

/**
 * One carried (or floored) item's row. `PackCellDto.Movable` (`PackDto.cs:8`) is real, tested
 * (`PackDtoTests.cs`) and already the SAME value for every cell of one party's pack by construction —
 * `PackDtoProjection.Project(..., partySteered)` stamps it once per party, not per cell
 * (`PackDto.cs:27-38`) — so gating each handle on its own cell's `movable` is correct today and stays
 * correct if a future producer ever varies it per cell instead of per party.
 *
 * `cell.kind`/`cell.refId` are wire ids with no display-name registry anywhere in this program yet (a
 * different subsystem's gap — item/loot naming, never named by spec-delve-stage.md's own §8 table at
 * all) — rendered here as a generic "Item" row rather than guessing at a label. `qty` and the
 * `movable`-gated handles are the real content this task's own acceptance line needs; a display name
 * is a separate, un-owned gap, not invented here.
 */
function PackCellRow({ cell, testId }: { cell: PackCellView; testId: string }) {
  const disabled = !cell.movable;
  return (
    <li
      data-testid={testId}
      className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-2xs"
    >
      <span className="text-text">Item</span>
      <span className="text-muted" data-testid={`${testId}-qty`}>
        {formatMagnitude(cell.qty)}
      </span>
      <span className="flex gap-1">
        <button
          type="button"
          disabled={disabled}
          title={disabled ? AUTOPILOT_PACK_REASON : undefined}
          data-testid={`${testId}-move`}
          className="rounded border border-border-control px-1.5 py-0.5 disabled:opacity-50"
        >
          Move
        </button>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? AUTOPILOT_PACK_REASON : undefined}
          data-testid={`${testId}-drop`}
          className="rounded border border-border-control px-1.5 py-0.5 disabled:opacity-50"
        >
          Drop
        </button>
      </span>
    </li>
  );
}

/** §8's own vocabulary row, verbatim: "Carry space — 'four spaces left', never 'cells'." */
function PackGrid({ pack, partyKey }: { pack: PackView; partyKey: string }) {
  const empty = pack.cells.length === 0 && pack.floor.length === 0;
  if (empty) {
    return (
      <p className="italic text-muted" data-testid={`delve-pack-empty-${partyKey}`}>
        Nothing carried yet
      </p>
    );
  }
  return (
    <div>
      <p className="mb-1 text-muted" data-testid={`delve-pack-spaces-left-${partyKey}`}>
        {formatMagnitude(pack.provisionCellsLeft)} spaces left
      </p>
      {pack.cells.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid={`delve-pack-carried-${partyKey}`}>
          {pack.cells.map((cell, i) => (
            <PackCellRow key={`carried-${i}`} cell={cell} testId={`delve-pack-cell-${partyKey}-${i}`} />
          ))}
        </ul>
      ) : null}
      {pack.floor.length > 0 ? (
        <>
          <h4 className="mb-1 mt-2 text-2xs uppercase tracking-wide text-muted">Floor</h4>
          <ul className="flex flex-col gap-1" data-testid={`delve-pack-floor-${partyKey}`}>
            {pack.floor.map((cell, i) => (
              <PackCellRow key={`floor-${i}`} cell={cell} testId={`delve-pack-floor-cell-${partyKey}-${i}`} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export type PackPanelProps = {
  /** `DelveView.parties` — real (D5.2/D5.3). Every party's own `.pack` is `Pending<PackView>`
   * (`adaptDelveParty`: `PackDtoProjection.Project` has zero production callers and no route serves it
   * — `PartyView.pack`'s own doc comment). Rendered per party, honestly: `known` shows the real grid,
   * `pending` shows the real reason, matching `QuestTracker`/`FightInPlace`'s own established idiom for
   * a `Pending` field, not invented for this file. */
  parties: PartyView[];
};

/**
 * Band-2 Pack panel (D5.7, spec-delve-stage.md §7: "the per-party carry grid, move and drop"). Shows
 * every raid party's own pack, not just one — a raid can carry up to four (§17's own success criterion
 * 3: "four named parties, four packs"), and nothing on the wire names a single "the player's own party"
 * to single out (confirmed: no `steered`/`autopilot`/`isMine` field anywhere on `PartyView`, the same
 * finding `graph/FightInPlace.tsx`'s own doc comment already made for the identical reason). Each
 * party's own name is `labels.ts`'s real `partyBannerLabel`, never a bare index (§8 row 4).
 *
 * Move/Drop buttons render and correctly gate on `movable` — the acceptance line's own subject. Posting
 * an actual move or drop is out of this task's own scope: no pack-mutation route or `lib/bus` hook
 * exists yet (confirmed by reading `lib/bus/delve.ts` in full — it exports `useDelve` alone), so an
 * enabled handle has no `onClick` today rather than a fabricated one.
 */
export function PackPanel({ parties }: PackPanelProps) {
  return (
    <div data-testid="delve-panel-pack" className="flex flex-col gap-3 text-2xs">
      {parties.map((party) => {
        const key = String(party.entityId);
        return (
          <section key={party.entityId} data-testid={`delve-pack-party-${key}`}>
            <h3 className="mb-1 font-display text-sm text-text">{partyBannerLabel(party.partyIndex)}</h3>
            {party.pack.state === "known" ? (
              <PackGrid pack={party.pack.value} partyKey={key} />
            ) : (
              <p className="italic text-muted" data-testid={`delve-pack-pending-${key}`}>
                {party.pack.state === "pending" ? party.pack.reason : "Nothing carried yet"}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
