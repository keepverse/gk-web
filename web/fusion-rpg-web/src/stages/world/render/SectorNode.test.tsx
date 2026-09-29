import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Magnitude } from "@/contract/types";
import { SectorNode } from "./SectorNode";
import { channelsFor, HEALTH_VALUES, OWNERSHIP_VALUES } from "./sectorChannels";
import { ALL_SLOT_KINDS } from "./slotSilhouettes";

const loam = (value: number): Magnitude => ({ unit: "loamUnits", value });

describe("SectorNode — the state matrix (world-stage W44)", () => {
  it("Unknown intel renders the different silhouette, not a card at all", () => {
    const channels = channelsFor({ intel: "Unknown", ownership: "open", health: "anchored", stabilityMilli: 0 });
    render(<SectorNode sectorId="s-1" channels={channels} slots={[]} netLoam={null} zoom="detail" />);
    expect(screen.getByTestId("sector-node-s-1")).toHaveAttribute("data-shape", "unknown");
    expect(screen.getByTestId("sector-node-s-1")).toHaveTextContent("unexplored");
  });

  for (const ownership of OWNERSHIP_VALUES) {
    for (const health of HEALTH_VALUES) {
      it(`${ownership} × ${health}: renders ownership always, never throws`, () => {
        const channels = channelsFor({ intel: "Watched", ownership, health, stabilityMilli: 700 });
        render(<SectorNode sectorId="s-1" channels={channels} slots={[]} netLoam={null} zoom="detail" />);
        expect(screen.getByTestId("sector-ownership")).toHaveTextContent(ownership);
      });
    }
  }

  it("all 14 slot kinds render without throwing", () => {
    const channels = channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 });
    const slots = ALL_SLOT_KINDS.map((slotTypeId, i) => ({ slotIndex: i, slotTypeId, marker: null }));

    render(<SectorNode sectorId="s-1" channels={channels} slots={slots} netLoam={null} zoom="detail" />);

    expect(ALL_SLOT_KINDS).toHaveLength(14);
    for (let i = 0; i < ALL_SLOT_KINDS.length; i++) {
      expect(screen.getByTestId(`slot-${i}`)).toBeInTheDocument();
    }
  });

  it("guarded/built/building markers each render their own glyph", () => {
    const channels = channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 });
    const slots = [
      { slotIndex: 0, slotTypeId: "seat", marker: { kind: "guarded" as const } },
      { slotIndex: 1, slotTypeId: "market", marker: { kind: "built" as const } },
      { slotIndex: 2, slotTypeId: "spire", marker: { kind: "building" as const, turnsRemaining: 2 } },
      { slotIndex: 3, slotTypeId: "wildland", marker: null }
    ];

    render(<SectorNode sectorId="s-1" channels={channels} slots={slots} netLoam={null} zoom="detail" />);

    expect(screen.getByTestId("slot-0-marker")).toHaveTextContent("⚔");
    expect(screen.getByTestId("slot-1-marker")).toHaveTextContent("▲");
    expect(screen.getByTestId("slot-2-marker")).toHaveTextContent("⏳2");
    expect(screen.queryByTestId("slot-3-marker")).not.toBeInTheDocument();
  });

  it("the slot row (content) and flags drop first at map zoom — ownership never does", () => {
    const channels = channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 });
    const slots = [{ slotIndex: 0, slotTypeId: "seat", marker: null }];

    render(<SectorNode sectorId="s-1" channels={channels} slots={slots} netLoam={loam(20)} zoom="map" />);

    expect(screen.queryByTestId("sector-slots")).not.toBeInTheDocument();
    expect(screen.getByTestId("sector-ownership")).toBeInTheDocument();
  });

  it("net loam is owner-only — absent when netLoam is null, present through LoamFigure otherwise", () => {
    const channels = channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 1000 });

    const { rerender } = render(<SectorNode sectorId="s-1" channels={channels} slots={[]} netLoam={null} zoom="detail" />);
    expect(screen.queryByTestId("sector-yield")).not.toBeInTheDocument();

    rerender(<SectorNode sectorId="s-1" channels={channels} slots={[]} netLoam={loam(22)} zoom="detail" />);
    expect(screen.getByTestId("sector-yield")).toBeInTheDocument();
    expect(screen.getByTestId("loam-figure-flow")).toBeInTheDocument();
  });

  it("no hex colour literal anywhere in this component's own source", () => {
    const source = readFileSync(join(__dirname, "SectorNode.tsx"), "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("a greyscale render loses no fact — every state is also carried by text/glyph content, never colour alone", () => {
    // barren vs fading, at the same ownership: distinguishable by their own health-pattern glyph
    // content alone, with `data-token` (the one colour-bearing channel) ignored entirely here.
    const barren = channelsFor({ intel: "Watched", ownership: "yours", health: "barren", stabilityMilli: 0 });
    const fading = channelsFor({ intel: "Watched", ownership: "yours", health: "fading", stabilityMilli: 400 });

    const { container: barrenContainer } = render(
      <SectorNode sectorId="s-barren" channels={barren} slots={[]} netLoam={null} zoom="detail" />
    );
    const { container: fadingContainer } = render(
      <SectorNode sectorId="s-fading" channels={fading} slots={[]} netLoam={null} zoom="detail" />
    );

    const barrenPattern = barrenContainer.querySelector("[data-pattern]")?.getAttribute("data-pattern");
    const fadingPattern = fadingContainer.querySelector("[data-pattern]")?.getAttribute("data-pattern");
    expect(barrenPattern).not.toBe(fadingPattern);
  });
});
