import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Magnitude } from "@/contract/types";
import { SupplyOverlay } from "./SupplyOverlay";
import { LifelineOverlay } from "./LifelineOverlay";
import { convexHull, pointInPolygon, supplyEnvelopeFor, type Point } from "./supplyEnvelope";

const count = (value: number): Magnitude => ({ unit: "count", value });

describe("supplyEnvelope.ts — the geometry (world-stage W48)", () => {
  it("convexHull wraps a simple square exactly", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    const hull = convexHull(square);
    expect(hull).toHaveLength(4);
  });

  it("pointInPolygon finds the centre of a square inside, and a far point outside", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 100, y: 100 }, square)).toBe(false);
  });

  it("a convex territory with no foreign ground inside gets a hull envelope", () => {
    const territory: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 }
    ];
    const envelope = supplyEnvelopeFor(territory, [{ x: 100, y: 100 }]);
    expect(envelope.kind).toBe("hull");
  });

  it("an envelope that would enclose foreign ground falls back to per-lane drawing", () => {
    // A ring of territory around one foreign sector sitting in the middle — a hull of the ring
    // necessarily contains the centre, which is not this faction's ground.
    const ring: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ];
    const foreignInCentre: Point[] = [{ x: 10, y: 10 }];
    const envelope = supplyEnvelopeFor(ring, foreignInCentre);
    expect(envelope.kind).toBe("per-lane");
  });

  it("fewer than three sectors can never form a real envelope — per-lane by construction", () => {
    expect(supplyEnvelopeFor([{ x: 0, y: 0 }, { x: 10, y: 10 }], []).kind).toBe("per-lane");
  });
});

describe("SupplyOverlay — cut-off sectors carry the words, not just the mark", () => {
  it("a cut-off sector renders both the cross mark and the word 'cut off'", () => {
    render(
      <svg>
        <SupplyOverlay
          sectors={[
            { sectorId: "s-1", position: { x: 0, y: 0 }, componentId: null },
            { sectorId: "s-2", position: { x: 10, y: 0 }, componentId: "c-1" },
            { sectorId: "s-3", position: { x: 20, y: 0 }, componentId: "c-1" },
            { sectorId: "s-4", position: { x: 5, y: 10 }, componentId: "c-1" }
          ]}
        />
      </svg>
    );

    expect(screen.getByTestId("supply-cutoff-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("supply-cutoff-label-s-1")).toHaveTextContent("cut off");
  });

  it("a fed component with no cut-off sector draws no cut-off marks at all", () => {
    render(
      <svg>
        <SupplyOverlay
          sectors={[
            { sectorId: "s-1", position: { x: 0, y: 0 }, componentId: "c-1" },
            { sectorId: "s-2", position: { x: 10, y: 0 }, componentId: "c-1" },
            { sectorId: "s-3", position: { x: 5, y: 10 }, componentId: "c-1" }
          ]}
        />
      </svg>
    );

    expect(screen.queryByTestId(/supply-cutoff-/)).not.toBeInTheDocument();
    expect(screen.getByTestId("supply-envelope-c-1")).toHaveAttribute("data-kind", "hull");
  });
});

describe("LifelineOverlay — opt-in, renders nothing without data", () => {
  it("renders nothing when lifeline/lifelineCost are Pending — no request of its own", () => {
    render(
      <svg>
        <LifelineOverlay
          sectors={[
            {
              sectorId: "s-1",
              position: { x: 0, y: 0 },
              lifeline: { state: "pending", reason: "lifelines opt-in" },
              lifelineCost: { state: "pending", reason: "lifelines opt-in" }
            }
          ]}
        />
      </svg>
    );
    expect(screen.queryByTestId("lifeline-halo-s-1")).not.toBeInTheDocument();
  });

  it("draws the halo and names the cost when both are known and lifeline is true", () => {
    render(
      <svg>
        <LifelineOverlay
          sectors={[
            {
              sectorId: "s-1",
              position: { x: 0, y: 0 },
              lifeline: { state: "known", value: true },
              lifelineCost: { state: "known", value: count(120) }
            }
          ]}
        />
      </svg>
    );
    expect(screen.getByTestId("lifeline-halo-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("lifeline-sentence-s-1")).toHaveTextContent("losing this splits your empire");
    expect(screen.getByTestId("lifeline-sentence-s-1")).toHaveTextContent("120");
  });

  it("draws nothing for a sector whose lifeline is known false", () => {
    render(
      <svg>
        <LifelineOverlay
          sectors={[
            {
              sectorId: "s-1",
              position: { x: 0, y: 0 },
              lifeline: { state: "known", value: false },
              lifelineCost: { state: "known", value: count(0) }
            }
          ]}
        />
      </svg>
    );
    expect(screen.queryByTestId("lifeline-halo-s-1")).not.toBeInTheDocument();
  });
});
