import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SectorView, UpkeepBreakdownView } from "@/contract/types";
import { pendingWithReason } from "@/contract/pending";
import { SectorRow } from "./SectorRow";

const R = (name: string) => pendingWithReason<never>(`no ${name} tracked in this test`);
const upkeepBreakdown: UpkeepBreakdownView = {
  base: { unit: "loamUnits", value: 10 },
  garrison: { unit: "loamUnits", value: 5 },
  development: { unit: "loamUnits", value: 0 },
  danger: { unit: "loamUnits", value: 1 },
  intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 },
  handicapMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
};

function sector(overrides: Partial<SectorView> = {}): SectorView {
  return {
    sectorId: "s-1",
    typeId: "stable",
    climate: null,
    ownerFactionId: "dave",
    intel: "Watched",
    intelAge: 0,
    phase: "Held",
    dangerBand: { unit: "count", value: 1 },
    developmentLevel: { unit: "count", value: 0 },
    stability: { unit: "perMilleRatio", op: "flat", value: 700 },
    pressure: { unit: "perMilleRatio", op: "flat", value: 0 },
    fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
    habitable: true,
    layoutX: 0,
    layoutY: 0,
    loam: {
      production: { unit: "loamUnits", value: 50 },
      upkeep: { unit: "loamUnits", value: 16 },
      net: { unit: "loamUnits", value: 34 },
      stock: { unit: "loamUnits", value: 100 },
      capacity: R("capacity"),
      upkeepBreakdown
    },
    component: { componentId: "c-1", production: { unit: "loamUnits", value: 50 }, upkeep: { unit: "loamUnits", value: 16 }, net: { unit: "loamUnits", value: 34 } } as SectorView["component"],
    willReleaseNextTurn: false,
    lifelineCost: R("lifeline cost"),
    lifeline: R("lifeline"),
    wardenBindingId: R("warden binding"),
    neglectedTurns: R("neglected turns"),
    ...overrides
  };
}

describe("SectorRow — net flow, fade risk, will-release, no fifth fact (world-stage W92)", () => {
  it("renders net flow through LoamFigure and stability through PerMilleFigure", () => {
    render(<SectorRow sector={sector()} fading={false} />);
    expect(screen.getByTestId("loam-figure-flow")).toHaveTextContent("+34");
    expect(screen.getByTestId("permille-figure-hold")).toBeInTheDocument();
  });

  it("fading is text and a glyph, not colour, and absent when anchored", () => {
    const { rerender } = render(<SectorRow sector={sector()} fading />);
    expect(screen.getByTestId("sector-row-fading")).toHaveTextContent("fading");

    rerender(<SectorRow sector={sector()} fading={false} />);
    expect(screen.queryByTestId("sector-row-fading")).not.toBeInTheDocument();
  });

  it("will-release renders only when the sector actually will", () => {
    const { rerender } = render(<SectorRow sector={sector({ willReleaseNextTurn: true })} fading={false} />);
    expect(screen.getByTestId("sector-row-will-release")).toHaveTextContent("will be released next turn");

    rerender(<SectorRow sector={sector({ willReleaseNextTurn: false })} fading={false} />);
    expect(screen.queryByTestId("sector-row-will-release")).not.toBeInTheDocument();
  });
});
