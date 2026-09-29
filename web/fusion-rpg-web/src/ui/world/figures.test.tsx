import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Magnitude } from "@/contract/types";
import { LoamFigure } from "./LoamFigure";
import { PerMilleFigure } from "./PerMilleFigure";
import { BandFigure } from "./BandFigure";

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });
const perMille = (value: number, op: Magnitude["op"] = "flat"): Magnitude => ({
  unit: "perMilleRatio",
  value,
  op
});
const count = (value: number): Magnitude => ({ unit: "count", value });

describe("LoamFigure — golden cases (world-numbers W39)", () => {
  it("a stock renders against its known denominator", () => {
    render(<LoamFigure kind="stock" amount={loam(120)} capacity={{ state: "known", value: loam(300) }} />);
    const el = screen.getByTestId("loam-figure-stock");
    expect(el).toHaveTextContent("120 loam");
    expect(screen.getByTestId("loam-figure-denominator")).toHaveTextContent("/ 300");
  });

  it("a stock with no projected capacity renders its player-facing Pending reason, never a bare number", () => {
    render(
      <LoamFigure kind="stock" amount={loam(120)} capacity={{ state: "pending", reason: "not shown yet" }} />
    );
    expect(screen.getByTestId("loam-figure-denominator-pending")).toHaveTextContent("not shown yet");
  });

  it("a positive flow carries its sign on the arrow, the real minus/plus, and colour", () => {
    render(<LoamFigure kind="flow" amount={loam(22)} period="per turn" />);
    const el = screen.getByTestId("loam-figure-flow");
    expect(el).toHaveAttribute("data-sign", "positive");
    expect(el).toHaveTextContent("▲");
    expect(el).toHaveTextContent("+22 loam per turn");
  });

  it("a negative flow reads with the real minus sign, never a doubled negative", () => {
    render(<LoamFigure kind="flow" amount={loam(-22)} period="per turn" />);
    const el = screen.getByTestId("loam-figure-flow");
    expect(el).toHaveAttribute("data-sign", "negative");
    expect(el).toHaveTextContent("▼");
    expect(el.textContent).toContain("−22 loam per turn");
    expect(el.textContent).not.toMatch(/--|−-|-−/); // never a doubled sign
  });
});

describe("PerMilleFigure — golden cases", () => {
  it("hold renders a plain percentage", () => {
    render(<PerMilleFigure reading="hold" value={perMille(720, "flat")} />);
    expect(screen.getByTestId("permille-figure-hold")).toHaveTextContent("72% hold");
  });

  it("intensity renders through the absolute op — no delta convention", () => {
    render(<PerMilleFigure reading="intensity" value={perMille(1400, "absolute")} />);
    expect(screen.getByTestId("permille-figure-intensity")).toHaveTextContent("×1.40 intensity");
  });

  it("hazard renders with its own glyph and percentage", () => {
    render(<PerMilleFigure reading="hazard" value={perMille(400, "flat")} />);
    expect(screen.getByTestId("permille-figure-hazard")).toHaveTextContent("☠ 40% hazard");
  });

  it("march-remaining renders as a fraction of the budget, never a bare movement count", () => {
    render(<PerMilleFigure reading="march-remaining" value={perMille(750, "flat")} />);
    const el = screen.getByTestId("permille-figure-march-remaining");
    expect(el).toHaveTextContent("75% of march remaining");
    expect(el.textContent).not.toContain("750 movement");
  });
});

describe("BandFigure — golden case", () => {
  it("renders the glyph row and the index with its denominator, e.g. Danger 3 of 5", () => {
    render(<BandFigure index={count(3)} ceiling={count(5)} label="Danger" />);
    const el = screen.getByTestId("band-figure");
    expect(el).toHaveTextContent("Danger 3 of 5");
    expect(el.textContent).toContain("◆◆◆");
    expect(el.textContent).toContain("◇◇");
  });

  it("clamps the filled count at the ceiling rather than overflowing the glyph row", () => {
    render(<BandFigure index={count(9)} ceiling={count(5)} label="Danger" />);
    const el = screen.getByTestId("band-figure");
    expect(el.textContent).toContain("Danger 9 of 5");
    // The glyph row itself never exceeds the ceiling even though the printed index does.
    const glyphs = el.querySelector("[aria-hidden]")?.textContent ?? "";
    expect(glyphs).toBe("◆◆◆◆◆");
  });
});
