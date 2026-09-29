import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { lanePath } from "../stageIds";
import { Lane } from "./Lane";

const base = { laneId: "l-1", widthMilli: 1000, sourceX: 0, sourceY: 0, targetX: 200, targetY: 0 };

describe("Lane", () => {
  it("the path carries stageIds.lanePath(laneId) as its own element id", () => {
    render(<Lane {...base} kind="corridor" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    const path = document.getElementById(lanePath("l-1"));
    expect(path).not.toBeNull();
    expect(path?.tagName.toLowerCase()).toBe("path");
  });

  it("a severed lane draws a real gap — two path segments, not one continuous line", () => {
    render(<Lane {...base} kind="rift" state={{ severed: true, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-path-l-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-path-second-l-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-severed-l-1")).toHaveTextContent("✕");
  });

  it("an open (non-severed) lane draws one continuous path only", () => {
    render(<Lane {...base} kind="rift" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-path-l-1")).toBeInTheDocument();
    expect(screen.queryByTestId("lane-path-second-l-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lane-severed-l-1")).not.toBeInTheDocument();
  });

  it("one-way draws arrowheads and nothing else does", () => {
    render(<Lane {...base} kind="one-way" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-arrow-l-1")).toBeInTheDocument();
  });

  it("deep is marked no-supply", () => {
    render(<Lane {...base} kind="deep" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-no-supply-l-1")).toHaveTextContent("⊘");
  });

  it("gated carries the lock glyph at the midpoint", () => {
    render(<Lane {...base} kind="gated" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-gate-l-1")).toHaveTextContent("🔒");
  });

  it("ley draws a second, twin rail path", () => {
    render(<Lane {...base} kind="ley" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />);
    expect(screen.getByTestId("lane-rail-l-1")).toBeInTheDocument();
  });

  it("a warded lane prints its level, never a percent", () => {
    render(<Lane {...base} kind="corridor" state={{ severed: false, wardLevel: 3, hazardMilli: 0 }} />);
    const badge = screen.getByTestId("lane-ward-l-1");
    expect(badge).toHaveTextContent("ward 3");
    expect(badge.textContent).not.toMatch(/%/);
  });

  it("a hazardous lane prints its chance as a percent, straight off HazardMilli", () => {
    render(<Lane {...base} kind="corridor" state={{ severed: false, wardLevel: null, hazardMilli: 400 }} />);
    expect(screen.getByTestId("lane-hazard-l-1")).toHaveTextContent("40%");
  });

  it("a severed, warded, hazardous lane draws all three markers at once", () => {
    render(<Lane {...base} kind="ley" state={{ severed: true, wardLevel: 1, hazardMilli: 600 }} />);
    expect(screen.getByTestId("lane-severed-l-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-ward-l-1")).toBeInTheDocument();
    expect(screen.getByTestId("lane-hazard-l-1")).toBeInTheDocument();
  });

  it("stroke width scales with widthMilli, never with hazard or ward state", () => {
    const { container: full } = render(
      <Lane {...base} laneId="l-full" widthMilli={1000} kind="corridor" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />
    );
    const { container: thin } = render(
      <Lane {...base} laneId="l-thin" widthMilli={200} kind="corridor" state={{ severed: false, wardLevel: null, hazardMilli: 0 }} />
    );
    const fullWidth = full.querySelector('[data-testid="lane-path-l-full"]')?.getAttribute("stroke-width");
    const thinWidth = thin.querySelector('[data-testid="lane-path-l-thin"]')?.getAttribute("stroke-width");
    expect(Number(fullWidth)).toBeGreaterThan(Number(thinWidth));
  });
});
