import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Magnitude } from "@/contract/types";
import { TopStrip, type TopStripProps } from "./TopStrip";
import type { CalendarRollView } from "./calendarLabel";

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });

const blankCalendar: CalendarRollView = {
  daysPerWeek: 7,
  weeksPerMonth: 4,
  weekBoundary: false,
  monthBoundary: false,
  specialWeek: false,
  specialMonth: false,
  plague: false,
  season: 0
};

const baseProps: TopStripProps = {
  turn: 3,
  calendar: blankCalendar,
  income: loam(1200),
  upkeep: loam(340),
  net: loam(860),
  stock: loam(4500),
  stockCapacity: { state: "pending", reason: "capacity not yet exposed by the server" }
};

describe("TopStrip — empire-scope income/upkeep/net/stock (world-stage W52)", () => {
  it("renders all four readings through LoamFigure, with a period on every flow", () => {
    render(<TopStrip {...baseProps} />);

    expect(screen.getByTestId("top-strip-income")).toHaveTextContent("per turn");
    expect(screen.getByTestId("top-strip-upkeep")).toHaveTextContent("per turn");
    expect(screen.getByTestId("top-strip-net")).toHaveTextContent("per turn");
    expect(screen.getByTestId("top-strip-stock")).toHaveTextContent("4,500");
  });

  it("income always reads as a gain (positive sign, never negated)", () => {
    render(<TopStrip {...baseProps} />);

    const income = screen.getByTestId("top-strip-income");
    expect(income.querySelector('[data-sign="positive"]')).toBeInTheDocument();
    expect(income).toHaveTextContent("+1,200");
  });

  it("upkeep is negated before rendering — it reads as a cost, not a second gain", () => {
    render(<TopStrip {...baseProps} />);

    const upkeep = screen.getByTestId("top-strip-upkeep");
    expect(upkeep.querySelector('[data-sign="negative"]')).toBeInTheDocument();
    expect(upkeep).toHaveTextContent("−340");
  });

  it("net carries its own real sign — negative when the empire is shrinking", () => {
    render(<TopStrip {...baseProps} income={loam(200)} upkeep={loam(900)} net={loam(-700)} />);

    const net = screen.getByTestId("top-strip-net");
    expect(net.querySelector('[data-sign="negative"]')).toBeInTheDocument();
    expect(net).toHaveTextContent("−700");
  });

  it("a Pending stock capacity renders its real reason, never a derived number", () => {
    render(<TopStrip {...baseProps} />);

    expect(screen.getByTestId("loam-figure-denominator-pending")).toHaveTextContent(
      "capacity not yet exposed by the server"
    );
    expect(screen.queryByTestId("loam-figure-denominator")).not.toBeInTheDocument();
  });

  it("a known stock capacity renders the real denominator", () => {
    render(<TopStrip {...baseProps} stockCapacity={{ state: "known", value: loam(6000) }} />);

    expect(screen.getByTestId("loam-figure-denominator")).toHaveTextContent("6,000");
  });

  it("no reading uses the sub-floor text classes", () => {
    const { container } = render(<TopStrip {...baseProps} />);

    expect(container.innerHTML).not.toMatch(/\btext-(?:2xs|xs|faint)\b/);
  });

  it("the strip is a flex-wrap row, not a fixed-width one — the 200% scale guarantee", () => {
    render(<TopStrip {...baseProps} />);

    const strip = screen.getByTestId("top-strip");
    expect(strip.className).toMatch(/\bflex-wrap\b/);
    expect(strip.className).not.toMatch(/\bw-\[\d/);
  });
});

describe("TopStrip — the calendar slot (world-stage W53, season wired in 2026-09-05)", () => {
  it("renders from WorldHeaderDto.CurrentTurn and WorldStateDto.Calendar, populated on a non-boundary turn", () => {
    render(<TopStrip {...baseProps} turn={3} calendar={blankCalendar} />);

    expect(screen.getByTestId("top-strip-calendar")).toHaveTextContent(
      "Day 3 · Week 1 · Month 1 · Season 1"
    );
  });

  it("carries flavour through from a rolled month boundary", () => {
    render(
      <TopStrip
        {...baseProps}
        turn={28}
        calendar={{ ...blankCalendar, weekBoundary: true, monthBoundary: true, plague: true }}
      />
    );

    expect(screen.getByTestId("top-strip-calendar")).toHaveTextContent("plague");
  });

  it("renders the real season number from the wire, 1-indexed for display", () => {
    render(<TopStrip {...baseProps} turn={35} calendar={{ ...blankCalendar, season: 2 }} />);

    expect(screen.getByTestId("top-strip-calendar")).toHaveTextContent("Season 3");
  });

  it("never invents §G.1/§G.2's rejected season name, even though a season number now renders", () => {
    const { container } = render(
      <TopStrip
        {...baseProps}
        turn={28}
        calendar={{ ...blankCalendar, weekBoundary: true, monthBoundary: true, specialMonth: true }}
      />
    );

    expect(container.textContent).not.toMatch(/long wither/i);
  });
});
