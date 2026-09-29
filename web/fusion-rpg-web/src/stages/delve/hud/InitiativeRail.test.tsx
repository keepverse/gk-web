import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { FightView } from "@/contract/types";
import { InitiativeRail } from "./InitiativeRail";

function fight(overrides: Partial<FightView> = {}): FightView {
  return {
    dwellRemaining: pendingWithReason("test"),
    initiative: pendingWithReason("test"),
    strikeFeed: pendingWithReason("test"),
    frozen: pendingWithReason("test"),
    ...overrides
  };
}

describe("InitiativeRail (D5.6, spec-delve-stage.md §7 — the initiative rail during a fight)", () => {
  it("no fight active: renders nothing at all — 'present only when a fight is active'", () => {
    const { container } = render(<InitiativeRail fight={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("delve-initiative-rail")).not.toBeInTheDocument();
  });

  it("a fight with every field still Pending renders the rail shell but no fabricated content", () => {
    render(<InitiativeRail fight={fight()} />);
    expect(screen.getByTestId("delve-initiative-rail")).toBeInTheDocument();
    expect(screen.queryByTestId("delve-initiative-frozen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delve-initiative-order")).not.toBeInTheDocument();
  });

  it("dwell known: renders through formatMagnitude as milliseconds/seconds text, never a raw number", () => {
    render(<InitiativeRail fight={fight({ dwellRemaining: known({ unit: "milliseconds", value: 900 }) })} />);
    expect(screen.getByTestId("delve-initiative-dwell")).toHaveTextContent("900 ms");
  });

  it("frozen known+true: shows spec §9's own exact quoted sentence, reused from connectionState.ts (not a second copy of the words)", () => {
    render(<InitiativeRail fight={fight({ frozen: known(true) })} />);
    expect(screen.getByTestId("delve-initiative-frozen")).toHaveTextContent("Your band is waiting.");
  });

  it("frozen known+false: no frozen banner", () => {
    render(<InitiativeRail fight={fight({ frozen: known(false) })} />);
    expect(screen.queryByTestId("delve-initiative-frozen")).not.toBeInTheDocument();
  });

  it("initiative known: renders one slot per entry — content-free, since the array element type is unknown", () => {
    render(<InitiativeRail fight={fight({ initiative: known([{}, {}, {}]) })} />);
    expect(screen.getByTestId("delve-initiative-order").children).toHaveLength(3);
  });

  it("initiative absent: no order list at all, distinct from pending or known-empty", () => {
    render(<InitiativeRail fight={fight({ initiative: absent() })} />);
    expect(screen.queryByTestId("delve-initiative-order")).not.toBeInTheDocument();
  });
});
