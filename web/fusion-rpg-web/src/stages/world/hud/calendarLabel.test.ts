import { describe, expect, it } from "vitest";
import { calendarLabelFor, formatCalendarLabel } from "./calendarLabel";

const blank = {
  daysPerWeek: 7,
  weeksPerMonth: 4,
  weekBoundary: false,
  monthBoundary: false,
  specialWeek: false,
  specialMonth: false,
  plague: false,
  season: 0
};

describe("calendarLabelFor — WorldStateDto.Calendar, never a report entry (world-stage W53)", () => {
  it("populates on a non-boundary turn — not blank six turns out of seven", () => {
    const label = calendarLabelFor(3, blank);
    expect(label).toEqual({ turn: 3, week: 1, month: 1, season: 1, flavour: null });
  });

  it("turn 0 (before any roll) is week 1 of month 1, no flavour", () => {
    expect(calendarLabelFor(0, blank)).toEqual({ turn: 0, week: 1, month: 1, season: 1, flavour: null });
  });

  it("rolls week and month numbers forward correctly across boundaries", () => {
    // daysPerWeek=7, weeksPerMonth=4 → day 22 is week 4 (days 22-28), month 1 (weeks 1-4).
    expect(calendarLabelFor(22, blank)).toEqual({ turn: 22, week: 4, month: 1, season: 1, flavour: null });
    // day 28 is the last day of week 4 / month 1; day 29 starts week 5 / month 2.
    expect(calendarLabelFor(28, blank).week).toBe(4);
    expect(calendarLabelFor(28, blank).month).toBe(1);
    expect(calendarLabelFor(29, blank)).toMatchObject({ week: 5, month: 2 });
  });

  it("plague is the headline flavour, and beats specialMonth per Roll()'s own rule", () => {
    const label = calendarLabelFor(28, { ...blank, monthBoundary: true, plague: true, specialMonth: true });
    expect(label.flavour).toBe("plague");
  });

  it("specialMonth reports on its own when there is no plague", () => {
    const label = calendarLabelFor(28, { ...blank, monthBoundary: true, specialMonth: true });
    expect(label.flavour).toBe("a special month");
  });

  it("specialWeek folds in as a second clause rather than being dropped, even during a plague month", () => {
    const label = calendarLabelFor(28, {
      ...blank,
      weekBoundary: true,
      monthBoundary: true,
      plague: true,
      specialWeek: true
    });
    expect(label.flavour).toBe("plague, a special week");
  });

  it("a plain week with no rolled flags carries no flavour clause at all", () => {
    expect(calendarLabelFor(7, { ...blank, weekBoundary: true }).flavour).toBeNull();
  });

  it("season is 1-indexed for display, unlike the wire's 0-indexed value", () => {
    expect(calendarLabelFor(3, { ...blank, season: 0 }).season).toBe(1);
    expect(calendarLabelFor(3, { ...blank, season: 2 }).season).toBe(3);
  });
});

describe("formatCalendarLabel — day/week/month/season, plus a flavour clause (§8b.7, superseded 2026-09-05)", () => {
  it("formats turn/week/month/season plainly with no flavour", () => {
    expect(formatCalendarLabel({ turn: 3, week: 1, month: 1, season: 1, flavour: null })).toBe(
      "Day 3 · Week 1 · Month 1 · Season 1"
    );
  });

  it("appends a flavour clause when one exists", () => {
    expect(formatCalendarLabel({ turn: 28, week: 4, month: 1, season: 2, flavour: "plague" })).toBe(
      "Day 28 · Week 4 · Month 1 · Season 2 — plague"
    );
  });

  it("never invents §G.1/§G.2's rejected season name, even though a season number now renders", () => {
    const rendered = [
      formatCalendarLabel({ turn: 0, week: 1, month: 1, season: 1, flavour: null }),
      formatCalendarLabel({ turn: 28, week: 4, month: 1, season: 2, flavour: "plague" }),
      formatCalendarLabel({ turn: 7, week: 1, month: 1, season: 1, flavour: "a special week" })
    ].join("\n");
    expect(rendered).not.toMatch(/long wither/i);
  });
});
