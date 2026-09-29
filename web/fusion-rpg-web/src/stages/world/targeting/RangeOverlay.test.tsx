import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { hopDistancesFromHoldings, RangeOverlay, type RangeLane, type RangeSector } from "./RangeOverlay";

const sectors: RangeSector[] = [
  { sectorId: "homeworld", habitable: true },
  { sectorId: "ember-hollow", habitable: true },
  { sectorId: "ash-waste", habitable: true },
  { sectorId: "black-gate", habitable: true },
  { sectorId: "void-reach", habitable: false } // fails Habitability.For — skipped entirely
];

const lanes: RangeLane[] = [
  { laneId: "l-home-ember", fromSectorId: "homeworld", toSectorId: "ember-hollow", severed: false },
  { laneId: "l-ember-ash", fromSectorId: "ember-hollow", toSectorId: "ash-waste", severed: false },
  { laneId: "l-ash-gate", fromSectorId: "ash-waste", toSectorId: "black-gate", severed: false },
  { laneId: "l-ember-void", fromSectorId: "ember-hollow", toSectorId: "void-reach", severed: false }
];

describe("hopDistancesFromHoldings — matches BuildResolver.cs's WithinWaystationRange (world-stage W69)", () => {
  it("the source itself is hop 0", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["homeworld"], 3);
    expect(distances.get("homeworld")).toBe(0);
  });

  it("counts real hop distance along the lane graph", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["homeworld"], 3);
    expect(distances.get("ember-hollow")).toBe(1);
    expect(distances.get("ash-waste")).toBe(2);
    expect(distances.get("black-gate")).toBe(3);
  });

  it("never reaches past maxHops", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["homeworld"], 2);
    expect(distances.has("black-gate")).toBe(false);
    expect(distances.get("ash-waste")).toBe(2);
  });

  it("a sector failing habitability is skipped entirely — never a hop, never a destination", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["homeworld"], 3);
    expect(distances.has("void-reach")).toBe(false);
  });

  it("a severed lane never carries a hop", () => {
    const severedLanes = lanes.map((l) => (l.laneId === "l-home-ember" ? { ...l, severed: true } : l));
    const distances = hopDistancesFromHoldings(sectors, severedLanes, ["homeworld"], 3);
    expect(distances.has("ember-hollow")).toBe(false);
    expect(distances.has("ash-waste")).toBe(false);
  });

  it("multi-source: the shortest distance from any holding wins", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["homeworld", "ash-waste"], 3);
    expect(distances.get("black-gate")).toBe(1); // via ash-waste, not 3 hops via homeworld
  });

  it("an unhabitable holding contributes no source at all", () => {
    const distances = hopDistancesFromHoldings(sectors, lanes, ["void-reach"], 3);
    expect(distances.size).toBe(0);
  });
});

describe("RangeOverlay — reachable ground gets a ring plus its hop number (world-stage W69)", () => {
  it("renders a ring with the hop number in text — the number is what makes it teachable", () => {
    render(<RangeOverlay shape="sectors" reachable={[{ sectorId: "ember-hollow", hops: 1 }]} />);
    expect(screen.getByTestId("range-ring-ember-hollow")).toHaveAttribute("data-hops", "1");
    expect(screen.getByTestId("range-hop-number-ember-hollow")).toHaveTextContent("1");
  });

  it("a range-0 target (claim, or a well's own slot) still draws — silence would read as a missed target", () => {
    render(<RangeOverlay shape="sectors" reachable={[{ sectorId: "homeworld", hops: 0 }]} />);
    expect(screen.getByTestId("range-ring-homeworld")).toHaveAttribute("data-hops", "0");
    expect(screen.getByTestId("range-hop-number-homeworld")).toHaveTextContent("0");
  });

  it("out-of-reach ground draws nothing but carries its reason for hover/focus", () => {
    render(
      <RangeOverlay
        shape="sectors"
        reachable={[]}
        outOfReach={[{ sectorId: "black-gate", reason: "4 hops away — the range is 3" }]}
      />
    );
    const blocked = screen.getByTestId("range-blocked-black-gate");
    expect(blocked).toHaveAttribute("aria-label", "4 hops away — the range is 3");
    expect(screen.queryByTestId("range-ring-black-gate")).not.toBeInTheDocument();
  });

  it("a ring with a real x/y actually paints at that position, not at the SVG origin (world-stage W71)", () => {
    render(<RangeOverlay shape="sectors" reachable={[{ sectorId: "ember-hollow", hops: 1, x: 220, y: 190 }]} />);
    expect(screen.getByTestId("range-ring-ember-hollow")).toHaveAttribute("transform", "translate(220, 190)");
  });

  it("a ring with no x/y offset still renders (existing callers never break)", () => {
    render(<RangeOverlay shape="sectors" reachable={[{ sectorId: "ember-hollow", hops: 1 }]} />);
    expect(screen.getByTestId("range-ring-ember-hollow")).toHaveAttribute("transform", "translate(0, 0)");
  });

  it("ward's overlay shape is a lane, not a node — the click target is a line", () => {
    render(<RangeOverlay shape="lane" laneId="l-home-ember" />);
    const overlay = screen.getByTestId("range-lane-l-home-ember");
    expect(overlay).toHaveAttribute("data-shape", "lane");
    expect(screen.getByTestId("range-lane-target-l-home-ember").tagName.toLowerCase()).toBe("line");
    expect(screen.queryByTestId(/range-ring-/)).not.toBeInTheDocument();
  });
});
