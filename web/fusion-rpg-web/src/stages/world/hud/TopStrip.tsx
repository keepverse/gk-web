import type { Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { LoamFigure } from "@/ui/world/LoamFigure";
import { calendarLabelFor, formatCalendarLabel, type CalendarRollView } from "./calendarLabel";

export type TopStripProps = {
  /** `WorldHeaderDto.CurrentTurn` — never re-derived, only formatted. */
  turn: number;
  /** `WorldStateDto.Calendar` (`world-wire` W15) — never a `calendar` report entry. */
  calendar: CalendarRollView;
  /** What the empire earns this turn, across every distinct component — always shown as a gain. */
  income: Magnitude;
  /** What the empire costs this turn — a flow, but read as a cost: this component negates it before
   * handing it to `LoamFigure`, so it draws with the same minus-sign/red/▼ a spend always gets. */
  upkeep: Magnitude;
  /** `income - upkeep`, carrying its own real sign — the number an empire-wide "are we shrinking?"
   * question is actually about. */
  net: Magnitude;
  stock: Magnitude;
  /** `LoamPhases.EffectiveCapacity` (`LoamPhases.cs:58`) — computed internally, never projected onto
   * the wire (world-numbers W52's own finding). `Pending`, never inferred client-side. */
  stockCapacity: Pending<Magnitude>;
};

/**
 * The band-1 top strip (world-stage W52) — empire-scope only, four readings through `LoamFigure`
 * (`world-numbers` W39), never a per-sector or per-component number: `resource-hub-ssot.md` §4
 * forbids mixing scopes on one surface, and this is the empire-scope surface. Built as a pure,
 * unwired component per this task's own Files list — `WorldHud.tsx`'s `topStrip` slot is where a
 * caller mounts it once real empire totals are threaded through (the wiring gap logged at W50).
 *
 * A `flex-wrap` row rather than a fixed-width one: at 200% text scale the four readings wrap onto a
 * second line instead of clipping or silently reordering — nothing here fixes a pixel width on
 * text content, which is the one thing that would break that guarantee.
 *
 * Turn and calendar (world-stage W53) share this strip per `spec-world-hud.md`'s own arbitration —
 * both are "this module." The calendar label carries day/week/month/season numbers plus whichever of
 * plague/specialMonth/specialWeek the server actually rolled, sourced from `WorldStateDto.Calendar`,
 * never a `calendar` report entry (blank six turns in seven). §8b.7 ("a calendar, never a season")
 * no longer holds — sector-development shipped a real season and the owner decided directly
 * (2026-09-05) to show it; see `calendarLabel.ts`'s own doc comment for the full history.
 */
export function TopStrip({ turn, calendar, income, upkeep, net, stock, stockCapacity }: TopStripProps) {
  const upkeepAsCost: Magnitude = { ...upkeep, value: -Math.abs(upkeep.value) };
  const calendarLabel = formatCalendarLabel(calendarLabelFor(turn, calendar));

  return (
    <div data-testid="top-strip" className="pointer-events-auto flex flex-wrap items-center gap-4 text-sm text-text">
      <span data-testid="top-strip-calendar">{calendarLabel}</span>
      <span data-testid="top-strip-income">
        <LoamFigure kind="flow" amount={income} period="per turn" />
      </span>
      <span data-testid="top-strip-upkeep">
        <LoamFigure kind="flow" amount={upkeepAsCost} period="per turn" />
      </span>
      <span data-testid="top-strip-net">
        <LoamFigure kind="flow" amount={net} period="per turn" />
      </span>
      <span data-testid="top-strip-stock">
        <LoamFigure kind="stock" amount={stock} capacity={stockCapacity} />
      </span>
    </div>
  );
}
