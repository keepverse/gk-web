import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import { RoutePreview, type RouteHop } from "./RoutePreview";

const count = (value: number) => ({ unit: "count" as const, value });

describe("RoutePreview — the route is drawn, never recomputed (world-stage W68)", () => {
  it("renders one row per hop, in route order", () => {
    const hops: RouteHop[] = [
      { laneId: "l-home-ember", cost: pendingWithReason("cost not requested"), turn: pendingWithReason("timing not projected yet") },
      { laneId: "l-ember-frost", cost: pendingWithReason("cost not requested"), turn: pendingWithReason("timing not projected yet") }
    ];
    render(<RoutePreview hops={hops} currentTurn={5} />);

    const list = screen.getByTestId("route-preview");
    expect([...list.children].map((el) => el.getAttribute("data-testid"))).toEqual([
      "route-hop-l-home-ember",
      "route-hop-l-ember-frost"
    ]);
  });
});

describe("RoutePreview — the turn split is never computed here, always Pending until the engine projects it (world-stage W68)", () => {
  it("with no projected timing, the split renders its Pending reason and no guessed number", () => {
    const hops: RouteHop[] = [
      { laneId: "l-home-ember", cost: known(count(560)), turn: pendingWithReason("timing not projected yet") }
    ];
    render(<RoutePreview hops={hops} currentTurn={0} />);

    expect(screen.getByTestId("route-hop-turn-l-home-ember")).toHaveTextContent("timing not projected yet");
    expect(screen.getByTestId("route-hop-l-home-ember")).toHaveAttribute("data-style", "unknown-timing");
  });

  it("a known turn equal to the current turn renders 'this turn' styling and T in text", () => {
    const hops: RouteHop[] = [{ laneId: "l-home-ember", cost: known(count(560)), turn: known(3) }];
    render(<RoutePreview hops={hops} currentTurn={3} />);

    expect(screen.getByTestId("route-hop-l-home-ember")).toHaveAttribute("data-style", "this-turn");
    expect(screen.getByTestId("route-hop-turn-l-home-ember")).toHaveTextContent("T");
  });

  it("a known turn one ahead renders 'next turn' styling and T+1 in text — never colour/style alone", () => {
    const hops: RouteHop[] = [{ laneId: "l-home-ember", cost: known(count(560)), turn: known(4) }];
    render(<RoutePreview hops={hops} currentTurn={3} />);

    const hop = screen.getByTestId("route-hop-l-home-ember");
    expect(hop).toHaveAttribute("data-style", "next-turn");
    expect(screen.getByTestId("route-hop-turn-l-home-ember")).toHaveTextContent("T+1");
  });

  it("a known turn further out renders 'later' styling and the real T+N in text", () => {
    const hops: RouteHop[] = [{ laneId: "l-home-ember", cost: known(count(560)), turn: known(6) }];
    render(<RoutePreview hops={hops} currentTurn={3} />);

    expect(screen.getByTestId("route-hop-l-home-ember")).toHaveAttribute("data-style", "later");
    expect(screen.getByTestId("route-hop-turn-l-home-ember")).toHaveTextContent("T+3");
  });
});

describe("RoutePreview — fog over-prices and stays over-priced; cost renders exactly as given (world-stage W68)", () => {
  it("a known cost renders exactly the value handed to it, never re-derived or 'corrected'", () => {
    // The value a real fog-honest (belief-based) march-cost projection would send for an
    // unscouted ley lane — undiscounted, per LaneCost.cs:108-116. This component's only job is to
    // show it, not to know whether a discount should apply.
    const hops: RouteHop[] = [{ laneId: "l-dh-df1", cost: known(count(720)), turn: pendingWithReason("timing not projected yet") }];
    render(<RoutePreview hops={hops} currentTurn={0} />);
    expect(screen.getByTestId("route-hop-cost-l-dh-df1")).toHaveTextContent("720");
  });

  it("a Pending cost renders its own reason, never a guessed number", () => {
    const hops: RouteHop[] = [{ laneId: "l-home-ember", cost: pendingWithReason("cost not requested"), turn: known(0) }];
    render(<RoutePreview hops={hops} currentTurn={0} />);
    expect(screen.getByTestId("route-hop-cost-l-home-ember")).toHaveTextContent("cost not requested");
  });
});
