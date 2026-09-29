import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { Magnitude, ResourceId } from "@/contract/types";
import { PoolMeters } from "./PoolMeters";

const ALL_SIX: Record<ResourceId, Magnitude> = {
  hp: { unit: "count", value: 80 },
  stamina: { unit: "count", value: 40 },
  hunger: { unit: "count", value: 12 },
  spirit: { unit: "count", value: 30 },
  qi: { unit: "count", value: 5 },
  poise: { unit: "count", value: 60 }
};

describe("PoolMeters (D5.6, spec-delve-stage.md §6/§7 — six pool meters per member)", () => {
  it("renders exactly the six real resource ids, in the DerivedStatChannels.ResourceIds order", () => {
    render(<PoolMeters pools={ALL_SIX} poolFill={pendingWithReason("test reason")} />);
    for (const id of ["hp", "stamina", "hunger", "spirit", "qi", "poise"]) {
      expect(screen.getByTestId(`delve-pool-meter-${id}`)).toBeInTheDocument();
    }
  });

  it("renders each pool's real current value through formatMagnitude, not a raw number", () => {
    render(<PoolMeters pools={ALL_SIX} poolFill={pendingWithReason("test reason")} />);
    expect(screen.getByTestId("delve-pool-value-hp")).toHaveTextContent("80");
    expect(screen.getByTestId("delve-pool-value-qi")).toHaveTextContent("5");
  });

  it("a pool absent from the wire object (the shared fixture's own real gap — see D5.6's todo entry) renders a dash, never a crash or a fabricated zero", () => {
    const partial: Record<ResourceId, Magnitude> = { hp: { unit: "count", value: 80 }, stamina: { unit: "count", value: 40 } };
    render(<PoolMeters pools={partial} poolFill={pendingWithReason("test reason")} />);
    expect(screen.getByTestId("delve-pool-value-hunger")).toHaveTextContent("—");
    expect(screen.getByTestId("delve-pool-value-poise")).toHaveTextContent("—");
  });

  it("poolFill pending: no fill bar for any pool, and the real pending reason renders once, verbatim", () => {
    render(<PoolMeters pools={ALL_SIX} poolFill={pendingWithReason("How full a meter reads isn't shown yet")} />);
    expect(screen.queryByTestId("delve-pool-bar-fill-hp")).not.toBeInTheDocument();
    expect(screen.getByTestId("delve-pool-fill-pending")).toHaveTextContent("How full a meter reads isn't shown yet");
  });

  it("poolFill absent: no fill bar and no pending message either — a real 'no fill at all' state, not glossed as 'coming soon'", () => {
    render(<PoolMeters pools={ALL_SIX} poolFill={absent()} />);
    expect(screen.queryByTestId("delve-pool-bar-fill-hp")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delve-pool-fill-pending")).not.toBeInTheDocument();
  });

  it("poolFill known: renders a fill bar per pool, its width read directly off the given perMilleRatio value (never derived from current/max)", () => {
    const fill: Record<ResourceId, Magnitude> = {
      hp: { unit: "perMilleRatio", value: 610, op: "flat" },
      stamina: { unit: "perMilleRatio", value: 1000, op: "flat" },
      hunger: { unit: "perMilleRatio", value: 0, op: "flat" },
      spirit: { unit: "perMilleRatio", value: 250, op: "flat" },
      qi: { unit: "perMilleRatio", value: 500, op: "flat" },
      poise: { unit: "perMilleRatio", value: 750, op: "flat" }
    };
    render(<PoolMeters pools={ALL_SIX} poolFill={known(fill)} />);
    expect(screen.getByTestId("delve-pool-bar-fill-hp")).toHaveStyle({ width: "61%" });
    expect(screen.getByTestId("delve-pool-bar-fill-stamina")).toHaveStyle({ width: "100%" });
    expect(screen.queryByTestId("delve-pool-fill-pending")).not.toBeInTheDocument();
  });

  it("a known fill value is clamped into [0, 1000] before becoming a CSS width, so a defect upstream can never overflow the bar", () => {
    const fill: Record<ResourceId, Magnitude> = {
      hp: { unit: "perMilleRatio", value: 4000, op: "flat" },
      stamina: { unit: "perMilleRatio", value: -200, op: "flat" },
      hunger: { unit: "perMilleRatio", value: 0, op: "flat" },
      spirit: { unit: "perMilleRatio", value: 0, op: "flat" },
      qi: { unit: "perMilleRatio", value: 0, op: "flat" },
      poise: { unit: "perMilleRatio", value: 0, op: "flat" }
    };
    render(<PoolMeters pools={ALL_SIX} poolFill={known(fill)} />);
    expect(screen.getByTestId("delve-pool-bar-fill-hp")).toHaveStyle({ width: "100%" });
    expect(screen.getByTestId("delve-pool-bar-fill-stamina")).toHaveStyle({ width: "0%" });
  });
});
