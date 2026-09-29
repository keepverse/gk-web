/**
 * The calendar slot's data (world-stage W53) — `WorldStateDto.Calendar` (`world-wire` W15), never a
 * `calendar` report entry (`TurnEngine.cs:225-231` only emits one on a week boundary, blank six
 * turns out of seven). `TurnCalendar.cs` is pure in `(turn, seed)`; the seed never reaches the wire,
 * but `DaysPerWeek`/`WeeksPerMonth` do, and placing today's turn in its week and month from those two
 * public tunables is ordinary calendar arithmetic — not a re-derivation of the hidden roll, which
 * only ever decides the boolean flags below.
 *
 * **§8b.7's premise no longer holds.** It read "this is a calendar, not a season — no season name,
 * no 'Long Wither'" at a time there was no season concept in the turn engine at all. Sector-development
 * has since shipped one (`TurnCalendar.SeasonOf`, real, hashed, replayed, never fogged), and the owner
 * decided directly (2026-09-05, asked because §8b.7 was a documented decision, not silently overridden)
 * to wire it into this slot. `season` is a plain 0-indexed number: no season-name catalog exists
 * anywhere in the engine or `gk-core/data/tuning/world.v5.json`, and inventing flavour text here would be a
 * content decision this task was never asked to make — "Season 2", not "Long Wither".
 */
export type CalendarRollView = {
  daysPerWeek: number;
  weeksPerMonth: number;
  weekBoundary: boolean;
  monthBoundary: boolean;
  specialWeek: boolean;
  specialMonth: boolean;
  plague: boolean;
  season: number;
};

export type CalendarLabel = {
  turn: number;
  /** 1-indexed: the very first turn (turn 0) is week 1 of month 1. */
  week: number;
  month: number;
  /** 1-indexed for display — the wire's `season` is 0-indexed. */
  season: number;
  /** `null` on a plain day — no flavour to report, not an empty gap. */
  flavour: string | null;
};

export function calendarLabelFor(turn: number, calendar: CalendarRollView): CalendarLabel {
  const day = Math.max(0, turn);
  // `TurnCalendar.cs`'s own boundary check is `turn % daysPerWeek == 0` — turn 7 (with
  // daysPerWeek=7) is the *last* day of week 1, so turn counts completed days, 1-indexed; turn 0 is
  // the pre-game default (week 1, month 1, matching `Roll`'s own `turn <= 0 → default` rule).
  const week = day === 0 ? 1 : Math.floor((day - 1) / calendar.daysPerWeek) + 1;
  const month = Math.floor((week - 1) / calendar.weeksPerMonth) + 1;

  const clauses: string[] = [];
  if (calendar.plague) clauses.push("plague");
  else if (calendar.specialMonth) clauses.push("a special month");
  if (calendar.specialWeek) clauses.push("a special week");

  return { turn, week, month, season: calendar.season + 1, flavour: clauses.length > 0 ? clauses.join(", ") : null };
}

/**
 * Plain text for the strip — e.g. `"Day 22 · Week 4 · Month 1 · Season 2"`, with a flavour clause
 * appended.
 */
export function formatCalendarLabel(label: CalendarLabel): string {
  const base = `Day ${label.turn} · Week ${label.week} · Month ${label.month} · Season ${label.season}`;
  return label.flavour ? `${base} — ${label.flavour}` : base;
}
