import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SectorView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { IdentityHeader } from "./IdentityHeader";
import { GroundBlock } from "./GroundBlock";

const count = (value: number) => ({ unit: "count" as const, value });
const loam = (value: number) => ({ unit: "loamUnits" as const, value });
const perMille = (value: number) => ({ unit: "perMilleRatio" as const, op: "flat" as const, value });

/**
 * The exact case `WorldEndpoints.cs:269-277` guarantees and `spec-world-inspector.md`'s own code
 * style names: an unseen sector serialises byte-identical to a real, poor, zero-danger one except
 * for `intel` — so this fixture is one shape with `intel` (and `intelAge`) the only thing that ever
 * changes across the four cases below.
 */
function zeroedSector(intel: SectorView["intel"], intelAge = 0): SectorView {
  return {
    sectorId: "test-sector",
    typeId: "",
    climate: null,
    ownerFactionId: null,
    intel,
    intelAge,
    // A real wire enum's own zero value (`SectorPhase`'s first member) — never a bare empty string,
    // which `translatePhase`'s loud lookup correctly refuses to guess at.
    phase: "Unknown",
    dangerBand: count(0),
    developmentLevel: count(0),
    stability: perMille(0),
    pressure: perMille(0),
    fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
    habitable: false,
    layoutX: 0,
    layoutY: 0,
    loam: {
      production: loam(0),
      upkeep: loam(0),
      net: loam(0),
      stock: loam(0),
      capacity: pendingWithReason("capacity not yet exposed by the server"),
      upkeepBreakdown: {
        base: loam(0),
        garrison: loam(0),
        development: loam(0),
        danger: loam(0),
        intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 },
        handicapMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
      }
    },
    component: { componentId: null, production: loam(0), upkeep: loam(0), net: loam(0), stock: loam(0) },
    willReleaseNextTurn: false,
    lifelineCost: pendingWithReason("lifelines opt-in"),
    lifeline: pendingWithReason("lifelines opt-in"),
    wardenBindingId: known(null),
    neglectedTurns: pendingWithReason("not surveyed")
  };
}

describe("IdentityHeader — four intel states from one zeroed payload (world-stage W58)", () => {
  it("Unknown renders the silhouette, never reading typeId/climate/phase/dangerBand", () => {
    // Deliberately not just zeroed but garbage — proves the Unknown arm never touches these, since
    // reading any of them here (a template literal, a lookup table access) would throw.
    const poisoned = {
      ...zeroedSector("Unknown"),
      typeId: undefined as unknown as string,
      climate: undefined as unknown as string | null,
      phase: undefined as unknown as string,
      dangerBand: undefined as unknown as SectorView["dangerBand"]
    };
    render(<IdentityHeader sector={poisoned} />);
    const header = screen.getByTestId("identity-header");
    expect(header).toHaveAttribute("data-intel", "Unknown");
    expect(header).toHaveTextContent("unexplored");
  });

  it("Watched renders full identity with no age stamp (intelAge is 0)", () => {
    render(<IdentityHeader sector={zeroedSector("Watched", 0)} />);
    const header = screen.getByTestId("identity-header");
    expect(header).toHaveAttribute("data-intel", "Watched");
    expect(header).toHaveTextContent("watched");
    expect(header).not.toHaveTextContent("night");
  });

  it("Scouted renders full identity plus its age in words, never a bare integer", () => {
    render(<IdentityHeader sector={zeroedSector("Scouted", 4)} />);
    expect(screen.getByTestId("identity-intel-row")).toHaveTextContent("scouted — 4 nights old");
  });

  it("Rumored renders full identity plus its age, singular handled", () => {
    render(<IdentityHeader sector={zeroedSector("Rumored", 1)} />);
    expect(screen.getByTestId("identity-intel-row")).toHaveTextContent("rumoured — 1 night old");
  });

  it("the same zeroed payload renders four different intel attributes — the four states are distinguishable", () => {
    const attrs = (["Unknown", "Watched", "Scouted", "Rumored"] as const).map((intel) => {
      const { unmount } = render(<IdentityHeader sector={zeroedSector(intel)} />);
      const attr = screen.getByTestId("identity-header").getAttribute("data-intel");
      unmount();
      return attr;
    });
    expect(new Set(attrs).size).toBe(4);
  });

});

describe("GroundBlock — fracture intensity (world-stage W58)", () => {
  it("renders ×1.40 from a raw 1400 via the absolute op, not a delta", () => {
    render(
      <GroundBlock
        sector={{ ...zeroedSector("Watched"), fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1400 } }}
      />
    );
    expect(screen.getByTestId("ground-block")).toHaveTextContent("×1.40");
  });
});

describe("GroundBlock — terrain is visible once seen at all (world-stage W58)", () => {
  it("Unknown renders nothing", () => {
    const { container } = render(<GroundBlock sector={zeroedSector("Unknown")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Watched, Scouted and Rumored all render the same ground facts — terrain is not fog-gated further once scouted", () => {
    for (const intel of ["Watched", "Scouted", "Rumored"] as const) {
      const { unmount } = render(<GroundBlock sector={zeroedSector(intel)} />);
      expect(screen.getByTestId("ground-block")).toHaveAttribute("data-intel", intel);
      unmount();
    }
  });

  it("pressure renders a real reading, not the Pending line this task found stale (W63)", () => {
    render(<GroundBlock sector={{ ...zeroedSector("Watched"), pressure: perMille(340) }} />);
    expect(screen.getByTestId("ground-pressure")).toHaveTextContent("34%");
  });
});
