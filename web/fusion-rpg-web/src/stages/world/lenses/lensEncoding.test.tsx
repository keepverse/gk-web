import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  encodeOwnershipLens,
  encodeLoamFlowLens,
  encodeFadeRiskLens,
  encodeSupplyLens,
  encodeDangerLens,
  encodeIntelAgeLens
} from "./lensCatalog";

/**
 * world-stage W99 (spec-world-lenses.md §7) — six colour-independence tests, one per lens. Each
 * reading is rendered into a minimal, real accessible node and queried by role or text, never by
 * class name — a regression that dropped a fact down to colour alone would still pass a bare object
 * check but fail here. None of the six reading types carries a colour field at all (asserted
 * structurally below), so "survives a greyscale rendering" is true by construction rather than by a
 * rendering test this task has no renderer to run.
 */
describe("Lens encodings carry their fact on a text/pattern channel, never colour alone (world-stage W99)", () => {
  it("ownership (lens 1) — four patterns, reusing sectorChannels.channelsFor", () => {
    const yours = encodeOwnershipLens({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 });
    render(<p role="status">{yours.word}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("yours");
    expect(yours.crest).toBeTruthy(); // a distinct glyph, not only a colour token

    const contested = encodeOwnershipLens({
      intel: "Watched",
      ownership: "contested",
      health: "anchored",
      stabilityMilli: 500
    });
    expect(contested.crest).not.toBe(yours.crest);
    expect(contested.word).toBe("contested");
  });

  it("loam flow (lens 2) — an arrow plus a signed number, and — never 0 for ground that is not yours", () => {
    const notYours = encodeLoamFlowLens(null);
    render(<p role="status">{notYours.label}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("—");
    expect(notYours.label).not.toBe("0");

    const positive = encodeLoamFlowLens(12);
    expect(positive.arrow).toBe("up");
    expect(positive.label).toBe("+12");

    const negative = encodeLoamFlowLens(-4);
    expect(negative.arrow).toBe("down");
    expect(negative.label).toBe("-4");

    const balanced = encodeLoamFlowLens(0);
    expect(balanced.arrow).toBe("flat");
    expect(balanced.label).toBe("0"); // a real, owned, exactly-balanced sector — 0 is correct here
  });

  it("fade risk (lens 3) — a word", () => {
    const reading = encodeFadeRiskLens("will-release");
    render(<p role="status">{reading.word}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("will release next turn");
  });

  it("supply & lifelines (lens 4) — line weight plus a caption on the hinge sector", () => {
    const hinge = encodeSupplyLens({ lifeline: true, lifelineCost: 40 });
    render(<p role="status">{hinge.caption}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("40");
    expect(hinge.weight).toBe("thick");

    const ordinary = encodeSupplyLens({ lifeline: false, lifelineCost: 0 });
    expect(ordinary.weight).toBe("thin");
    expect(ordinary.caption).toBe("");
  });

  it("intel age (lens 5) — a hatch plus a number of turns", () => {
    const stale = encodeIntelAgeLens(7);
    render(<p role="status">{stale.turnsLabel}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("7 turns old");
    expect(stale.hatch).toBe("heavy");

    const current = encodeIntelAgeLens(0);
    expect(current.hatch).toBe("none");
    expect(current.turnsLabel).toBe("current");
  });

  it("danger (lens 6) — a count of diamonds", () => {
    const reading = encodeDangerLens(3);
    render(<p role="status">{reading.label}</p>);
    expect(screen.getByRole("status")).toHaveTextContent("danger 3");
    expect(reading.diamondCount).toBe(3);
  });

  it("none of the six readings carries a colour field — greyscale survival is structural, not a rendering test", () => {
    const readings = [
      encodeOwnershipLens({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 }),
      encodeLoamFlowLens(5),
      encodeFadeRiskLens("fading"),
      encodeSupplyLens({ lifeline: true, lifelineCost: 10 }),
      encodeIntelAgeLens(2),
      encodeDangerLens(1)
    ];
    for (const reading of readings) {
      const keys = Object.keys(reading).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes("color") || k.includes("colour") || k === "token")).toBe(false);
    }
  });
});
