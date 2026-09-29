import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Magnitude, UpkeepBreakdownView } from "@/contract/types";
import { ModifierLedger } from "./ModifierLedger";
import { ledgerRows, reproducedTotal } from "./modifierLedgerMath";

const magPerMille = (value: number): Magnitude => ({ unit: "perMilleRatio", op: "absolute", value });
const magLoam = (value: number): Magnitude => ({ unit: "loamUnits", value });

const breakdown: UpkeepBreakdownView = {
  base: magLoam(10),
  garrison: magLoam(6),
  development: magLoam(15),
  danger: magLoam(9),
  // wonder-wire §Design 3 (plan Task 4A.4): the fifth operand rides the sum. Zero here keeps
  // the 46 below; the nonzero case is its own test. The fifth ROW landed in wonder-display 4D.4,
  // so `ledgerRows` below returns all five, in the engine's operand order.
  wonderUpkeep: magLoam(0),
  intensityMilli: magPerMille(1150),
  handicapMilli: magPerMille(1000)
};

describe("modifierLedger.ts — the arithmetic (world-numbers W41)", () => {
  it("rows are exactly the five operands, in the engine's own order — a sixth would fail this test", () => {
    const rows = ledgerRows(breakdown);
    expect(rows.map((r) => r.key)).toEqual(["base", "garrison", "development", "danger", "wonder"]);
    expect(rows).toHaveLength(5);
  });

  it("the wonder row reads the fifth operand straight off the wire, never re-derived", () => {
    const withWonder: UpkeepBreakdownView = { ...breakdown, wonderUpkeep: magLoam(12) };
    const rows = ledgerRows(withWonder);
    expect(rows[4]).toEqual({ key: "wonder", amount: withWonder.wonderUpkeep });
  });

  it("reproduces LoamUpkeep.For's own formula: sum × intensityMilli × handicapMilli ÷ 1_000_000, one division", () => {
    // sum = 10+6+15+9 = 40; 40 * 1150 * 1000 = 46,000,000; / 1_000_000 = 46.
    expect(reproducedTotal(breakdown)).toBe(46);
  });

  it("the fifth operand flows into the total — a Wonder upkeep is never silently dropped", () => {
    // sum = 10+6+15+9+12 = 52; 52 * 1150 * 1000 = 59,800,000; / 1_000_000 = 59 (truncated).
    const withWonder: UpkeepBreakdownView = { ...breakdown, wonderUpkeep: magLoam(12) };
    expect(reproducedTotal(withWonder)).toBe(59);
  });

  it("truncates, matching C#'s long integer division, never a floating-point round", () => {
    const b: UpkeepBreakdownView = {
      base: magLoam(10),
      garrison: magLoam(0),
      development: magLoam(0),
      danger: magLoam(0),
      wonderUpkeep: magLoam(0),
      intensityMilli: magPerMille(999),
      handicapMilli: magPerMille(999)
    };
    // 10 * 999 * 999 = 9,980,010; / 1_000_000 = 9.98001 — truncates to 9, never rounds to 10.
    expect(reproducedTotal(b)).toBe(9);
  });

  it("does exactly one division in its own source — never two roundings", () => {
    const source = reproducedTotal.toString();
    expect((source.match(/\//g) ?? []).length).toBe(1);
  });
});

describe("ModifierLedger — Pending operand rows (world-numbers W42)", () => {
  it("renders the wire's own Pending reason when the breakdown is not yet projected, never a blank or a zero", () => {
    render(
      <ModifierLedger breakdown={{ state: "pending", reason: "not shown yet" }} total={magLoam(46)} />
    );
    expect(screen.getByTestId("modifier-ledger-pending")).toHaveTextContent("not shown yet");
    expect(screen.queryByTestId("modifier-ledger-trigger")).not.toBeInTheDocument();
  });
});

describe("ModifierLedger — the four WCAG 1.4.13 obligations (world-numbers W42)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Hoverable: the pointer can travel from the trigger into the popup without it closing", () => {
    render(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />);
    const trigger = screen.getByTestId("modifier-ledger-trigger");

    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    // Immediately after leaving the trigger, the grace window has not elapsed yet.
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId("modifier-ledger-popup"));
    act(() => vi.advanceTimersByTime(200));
    // The popup itself was entered before the grace window closed — it must still be open.
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();
  });

  it("Persistent: leaving both the trigger and the popup eventually closes it — it does not linger forever", () => {
    render(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />);
    fireEvent.mouseEnter(screen.getByTestId("modifier-ledger-trigger"));
    fireEvent.mouseLeave(screen.getByTestId("modifier-ledger-trigger"));

    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId("modifier-ledger-popup")).not.toBeInTheDocument();
  });

  it("Dismissible: Esc closes it without needing the pointer to move, and stops there (stopPropagation)", () => {
    render(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />);
    const trigger = screen.getByTestId("modifier-ledger-trigger");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();

    // A parent listener proves stopPropagation for real, rather than spying on a manually
    // constructed event that never goes through React's synthetic event system.
    const parentHandler = vi.fn();
    document.addEventListener("keydown", parentHandler);
    fireEvent.keyDown(trigger, { key: "Escape" });
    document.removeEventListener("keydown", parentHandler);

    expect(screen.queryByTestId("modifier-ledger-popup")).not.toBeInTheDocument();
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it("Keyboard: Enter on the focused trigger opens it locked, immune to a stray mouseleave", () => {
    render(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />);
    const trigger = screen.getByTestId("modifier-ledger-trigger");

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();

    // A stray mouseleave (the pointer was never even over it) must not close a keyboard-locked ledger.
    fireEvent.mouseLeave(trigger);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();
  });

  it("Keyboard: the rows are real DOM content the moment it opens — reachable, not merely painted on hover", () => {
    render(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />);
    fireEvent.keyDown(screen.getByTestId("modifier-ledger-trigger"), { key: "Enter" });

    expect(screen.getByTestId("modifier-ledger-row-base")).toBeInTheDocument();
    expect(screen.getByTestId("modifier-ledger-row-garrison")).toBeInTheDocument();
    expect(screen.getByTestId("modifier-ledger-row-development")).toBeInTheDocument();
    expect(screen.getByTestId("modifier-ledger-row-danger")).toBeInTheDocument();
    expect(screen.getByTestId("modifier-ledger-row-wonder")).toBeInTheDocument();
    expect(screen.getByTestId("modifier-ledger-computed-total")).toHaveTextContent("46 loam");
  });

  it("closes when the underlying value changes, even while locked open", () => {
    const { rerender } = render(
      <ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(46)} />
    );
    fireEvent.keyDown(screen.getByTestId("modifier-ledger-trigger"), { key: "Enter" });
    expect(screen.getByTestId("modifier-ledger-popup")).toBeInTheDocument();

    rerender(<ModifierLedger breakdown={{ state: "known", value: breakdown }} total={magLoam(51)} />);
    expect(screen.queryByTestId("modifier-ledger-popup")).not.toBeInTheDocument();
  });
});
