import { channelLabel } from "@/contract/adapt";
import type { Pending } from "@/contract/pending";
import type {
  ChannelDeltaView,
  ComparePayloadView,
  ContainerView,
  UnitClass,
  UnitClassGroupView
} from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { ItemCard } from "./ItemCard";

/**
 * Equipped versus candidate — the default presentation wherever a choice is being made, never a
 * tooltip afterthought.
 *
 * **Stack-first, not side-by-side, and that is measured rather than preferred.** The panel hosting
 * this is 640px wide; two columns inside that cap left the comparison too narrow to read at any
 * width. The delta table is one column with a unit-class group header.
 *
 * ⛔ **Deltas group by unit class, and the unit is in the GROUP HEADER, never in the column.** Nine
 * hit points and five accuracy points never appear in one numeric column — that is the whole
 * no-common-currency rule expressed as a layout constraint.
 *
 * ⛔ **The verdict is a word AND a shape, never a colour alone**, and the badge carries no colour
 * property to fall back on.
 *
 * ⛔ **No synthesized scalar, and the copy saying why is permanent.** The footnote has no dismiss
 * control — a player who dismissed it once would read its absence as a missing feature forever.
 *
 * ⛔ **Nothing here is computed.** The verdict, the trade, the grouping and the roll quality all
 * arrive already decided; this component chooses none of them.
 */

const UNIT_GROUP_HEADINGS: Record<UnitClass, string> = {
  gameUnits: "Damage and hit points",
  gameUnitsPerSecond: "Rate, per second",
  sigmoidPoints: "Probability",
  sigmoidMultiplierPoints: "Probability, multiplied",
  statusPotencyPoints: "Status strength",
  perMilleRatio: "Proportions",
  milliseconds: "Timing",
  count: "Counts",
  flag: "On or off",
  ladderIndex: "Power rung",
  aptitudePoints: "Primary stat points",
  reciprocalPoints: "Penetration and absorption",
  loamUnits: "Loam"
};

function groupHeading(unit: UnitClass | null): string {
  // A unit we cannot resolve gets its own heading rather than being folded in with game units —
  // guessing a unit is the exact lie the group header exists to prevent.
  return unit === null ? "Unit not known" : UNIT_GROUP_HEADINGS[unit];
}

function DeltaRow({ delta }: { delta: ChannelDeltaView }) {
  return (
    <p className="flex items-baseline gap-2 text-sm" data-testid={`compare-delta-${delta.channel}`}>
      {/* item-content `item-naming` (T3): the channel's own words, not its registered id. The id is
        * still on the row — as the test id and as the label's `title` — so a debug read loses
        * nothing, but a player never reads `combat.crit.rate.fire` in a label slot. */}
      <span className="min-w-0 flex-1 truncate text-muted" title={delta.channel}>
        {channelLabel(delta.channel)}
      </span>
      <span className="font-mono text-muted">{formatMagnitude(delta.incumbent)}</span>
      <span aria-hidden="true" className="text-muted">
        →
      </span>
      <span className="font-mono text-text">{formatMagnitude(delta.candidate)}</span>
      <span className="w-16 text-right font-mono font-semibold text-text">{formatMagnitude(delta.delta)}</span>
    </p>
  );
}

function Group({ group }: { group: UnitClassGroupView }) {
  return (
    <div data-testid={`compare-group-${group.unit ?? "unknown"}`}>
      <p className="mt-2 text-2xs font-bold uppercase tracking-wide text-muted">{groupHeading(group.unit)}</p>
      {group.deltas.map((d) => (
        <DeltaRow key={d.channel} delta={d} />
      ))}
    </div>
  );
}

export function CompareView({
  candidate,
  incumbent,
  payload
}: {
  candidate: ContainerView;
  /** `null` when the role is empty — there is nothing to swap out, and the copy says so. */
  incumbent: ContainerView | null;
  payload: Pending<ComparePayloadView>;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="compare-view">
      <p className="text-xs font-bold uppercase tracking-wide text-muted" data-testid="compare-headline">
        {incumbent
          ? `Swapping ${incumbent.header.name} → ${candidate.header.name}`
          : `Equipping ${candidate.header.name} (nothing in that slot yet)`}
      </p>

      {payload.state === "known" ? (
        <div className="rounded-md border border-border p-3" data-testid="compare-verdict">
          <p className="font-display text-base text-text">
            <span aria-hidden="true" className="mr-1">
              {payload.value.badge.shape}
            </span>
            {payload.value.badge.label}
          </p>

          {payload.value.incomparableReason ? (
            <p className="mt-1 text-sm text-muted" data-testid="compare-incomparable-reason">
              {payload.value.incomparableReason}
            </p>
          ) : null}

          {payload.value.trade ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="compare-trade">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ok">You gain</p>
                {payload.value.trade.youGain.map((d) => (
                  <DeltaRow key={`gain-${d.channel}`} delta={d} />
                ))}
              </div>
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-bad">You give up</p>
                {payload.value.trade.youGiveUp.map((d) => (
                  <DeltaRow key={`lose-${d.channel}`} delta={d} />
                ))}
              </div>
            </div>
          ) : null}

          {payload.value.groups.map((g) => (
            <Group key={g.unit ?? "unknown"} group={g} />
          ))}

          {payload.value.meanRollQualityPerMille !== null ? (
            <p className="mt-2 text-xs text-muted" data-testid="compare-roll-quality">
              Roll quality{" "}
              {formatMagnitude({
                unit: "perMilleRatio",
                value: payload.value.meanRollQualityPerMille,
                op: "flat"
              })}
            </p>
          ) : null}
        </div>
      ) : payload.state === "pending" ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-muted" data-testid="compare-pending">
          {payload.reason}
        </p>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted" data-testid="compare-absent">
          These two share nothing to weigh against each other.
        </p>
      )}

      {/* Stacked, never side by side: the panel is 640px wide and two columns inside that cap are
       * unreadable. The candidate is first because it is the thing being decided about. */}
      <ItemCard item={candidate} incumbent={incumbent} testId="compare-candidate-card" />
      {incumbent ? <ItemCard item={incumbent} testId="compare-incumbent-card" /> : null}

      {/* Permanent. There is deliberately no control to hide this. */}
      <p className="text-2xs text-muted" data-testid="compare-footnote">
        There is no single score. Nine hit points and five accuracy points are not the same currency.
      </p>
    </div>
  );
}
