import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Fog } from "./Fog";
import { fogTreatmentFor } from "./fogTreatments";

describe("fogTreatmentFor — four treatments, branch on intel (world-stage W47)", () => {
  it("Watched: full clarity, no wash, no stamp, no forces strip", () => {
    const t = fogTreatmentFor("Watched", 0);
    expect(t.wash).toBe("none");
    expect(t.stamp).toBeNull();
    expect(t.forcesStrip).toBeNull();
  });

  it("Scouted: doubled border + parchment wash capped at 13% + a dated stamp + the forces strip", () => {
    const t = fogTreatmentFor("Scouted", 3);
    expect(t.wash).toBe("parchment");
    expect(t.washCapPercent).toBe(13);
    expect(t.doubledBorder).toBe(true);
    expect(t.stamp).toBe("seen 3 turns ago");
    expect(t.forcesStrip).toBe("who stands here is not known");
  });

  it("Scouted at age 1 uses the singular", () => {
    expect(fogTreatmentFor("Scouted", 1).stamp).toBe("seen 1 turn ago");
  });

  it("Rumored: ragged border + torn wash capped at 18% + hearsay + the forces strip", () => {
    const t = fogTreatmentFor("Rumored", 12);
    expect(t.wash).toBe("torn");
    expect(t.washCapPercent).toBe(18);
    expect(t.raggedBorder).toBe(true);
    expect(t.stamp).toBe("hearsay");
    expect(t.forcesStrip).toBe("who stands here is not known");
  });

  it("Unknown answers with nothing to say — the real branch happens one level up in sectorChannels.ts", () => {
    const t = fogTreatmentFor("Unknown", 0);
    expect(t.wash).toBe("none");
    expect(t.stamp).toBeNull();
  });
});

describe("Fog — the forces strip is explicit, never a gap", () => {
  it("a Scouted card shows the explicit strip, not an empty space where forces would be", () => {
    render(
      <Fog intel="Scouted" intelAge={2}>
        <div data-testid="inner-card">card</div>
      </Fog>
    );
    expect(screen.getByTestId("fog-forces-strip")).toHaveTextContent("who stands here is not known");
    expect(screen.getByTestId("inner-card")).toBeInTheDocument();
  });

  it("a Watched card shows no forces strip at all — nothing to hedge", () => {
    render(
      <Fog intel="Watched" intelAge={0}>
        <div data-testid="inner-card">card</div>
      </Fog>
    );
    expect(screen.queryByTestId("fog-forces-strip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fog-stamp")).not.toBeInTheDocument();
  });
});

describe("Fog and ownership never share a channel", () => {
  it("this module never reads or sets a border style — only wash/stamp/forces — leaving ownership's own dashed-border control case untouched", () => {
    const source = String(fogTreatmentFor);
    expect(source).not.toMatch(/border.*style|style.*border/i);
  });
});
