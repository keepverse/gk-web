import { DialogShell } from "@/shell/DialogShell";
import { formatMagnitude } from "@/i18n/magnitude";
import type { Magnitude, SlotView } from "@/contract/types";
import type { Pending } from "@/contract/pending";

export type PourOption = {
  entityId: string;
  displayName: string;
  carriedLoam: Pending<Magnitude>;
};

export type ReleaseGroundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorName: string;
  /** The whole component's own totals — the same numbers `LoamForecast.Weakest`'s caller already
   * computed, never re-derived here (`WorldSectorDto.componentProduction/componentUpkeep/
   * componentStock`, already on the wire mirror). */
  componentProduction: Magnitude;
  componentUpkeep: Magnitude;
  componentStock: Magnitude;
  /** `sector.lifeline` — the same fact lens 4 already draws (world-stage W99). */
  splitsTerritory: boolean;
  /** What goes with it — the sector's own built/building slots. */
  slots: readonly SlotView[];
  /** A legion that could actually pour in the shortfall, with what it is really carrying — so the
   * option is checkable, not aspirational. Empty when nothing nearby could help. */
  pourOptions: readonly PourOption[];
  onPourLoam: (entityId: string) => void;
};

/**
 * world-stage W104 (spec-world-confirms.md §4, plate 11 §K.4) — drawn a full turn early with the
 * same selection (`LoamForecast.Weakest`) the engine applies the fade with, so the warning and the
 * event can never disagree. **Offers no picker of which ground goes** — this dialog only ever names
 * the one sector the engine already picked (`LoamForecast.Weakest`) and what would stop it losing
 * that ground; `forbiddenCopy.test.ts` (W105) is the standing guard for this across the whole
 * module.
 *
 * **No "Bind a warden here" act** (warden-freeze-fix, server `RulesetVersion` 13). The owner
 * withdrew the warden on 2026-09-13 (`warden-mortality-ideal.md`): a binding no longer stops a
 * sector fading, and the server refuses every bind with `warden.retired`. This dialog was the only
 * designed way into `BindWardenDialog`, so dropping the button here is what keeps a player from
 * starting a bind — and from reading it as something that would stop the release.
 */
export function ReleaseGroundDialog({
  open,
  onOpenChange,
  sectorName,
  componentProduction,
  componentUpkeep,
  componentStock,
  splitsTerritory,
  slots,
  pourOptions,
  onPourLoam
}: ReleaseGroundDialogProps) {
  const shortfall = componentUpkeep.value - componentProduction.value;
  const builtSlots = slots.filter((s) => s.structureId != null);

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`${sectorName} is about to be released`}
      testId="release-ground-dialog"
      footer={
        <button type="button" data-testid="release-ground-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      }
    >
      <p data-testid="release-ground-arithmetic">
        Together your ground here earns {formatMagnitude(componentProduction)} and costs{" "}
        {formatMagnitude(componentUpkeep)}. They are {formatMagnitude({ unit: "loamUnits", value: shortfall })}{" "}
        short, and the stores are {componentStock.value === 0 ? "empty" : formatMagnitude(componentStock)}.
      </p>

      <p data-testid="release-ground-sector">
        <strong>{sectorName}</strong> is the one that goes — the weakest contributor.
      </p>

      <ul data-testid="release-ground-slots">
        {builtSlots.length === 0 ? (
          <li data-testid="release-ground-slots-empty">Nothing built here yet.</li>
        ) : (
          builtSlots.map((slot) => (
            <li key={slot.slotIndex} data-testid={`release-ground-slot-${slot.slotIndex}`}>
              {slot.structureId}
              {slot.constructionTurnsRemaining.state === "known" && slot.constructionTurnsRemaining.value != null
                ? ` — ${slot.constructionTurnsRemaining.value} night${slot.constructionTurnsRemaining.value === 1 ? "" : "s"} of building lost`
                : null}
            </li>
          ))
        )}
      </ul>

      <p data-testid="release-ground-split">
        {splitsTerritory
          ? "Losing this would cut your territory in two."
          : "This will not split your territory."}
      </p>

      <section data-testid="release-ground-stop-it">
        <p>What would stop it:</p>
        <ul data-testid="release-ground-pour-options">
          {pourOptions.length === 0 ? (
            <li data-testid="release-ground-pour-empty">No legion nearby is carrying loam to pour in.</li>
          ) : (
            pourOptions.map((option) => (
              <li key={option.entityId} data-testid={`release-ground-pour-${option.entityId}`}>
                {option.displayName} carries{" "}
                {option.carriedLoam.state === "known"
                  ? formatMagnitude(option.carriedLoam.value)
                  : option.carriedLoam.state === "pending"
                    ? option.carriedLoam.reason
                    : "nothing"}
                <button type="button" data-testid={`release-ground-pour-button-${option.entityId}`} onClick={() => onPourLoam(option.entityId)}>
                  Pour in the shortfall
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </DialogShell>
  );
}
