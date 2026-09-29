import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PartyView } from "@/contract/types";
import { PartyMarker } from "./PartyMarker";

const party = (partyIndex: number, entityId: number, memberCount: number): PartyView => ({
  partyIndex,
  entityId,
  atSectorId: "s-1",
  onLaneId: null,
  route: [],
  members: Array.from({ length: memberCount }, (_, i) => ({
    instanceId: `m-${i}`,
    pools: {},
    poolMax: { state: "pending", reason: "x" },
    poolFill: { state: "pending", reason: "x" },
    nerveStacks: 0,
    nerveStage: { state: "pending", reason: "x" },
    downed: false,
    downedOnce: false,
    shield: { state: "pending", reason: "x" },
    statuses: { state: "pending", reason: "x" }
  })),
  pack: { state: "pending", reason: "x" },
  haul: []
});

describe("PartyMarker — never renders a bare partyIndex (spec-delve-stage.md §8)", () => {
  it("renders the Banner name, not the raw index", () => {
    render(<PartyMarker party={party(0, 501, 2)} position={{ x: 10, y: 20 }} />);
    expect(screen.getByTestId("delve-party-label")).toHaveTextContent("First Banner");
    expect(screen.getByTestId("delve-party-label")).not.toHaveTextContent("0");
  });

  it("positions itself at the given point", () => {
    render(<PartyMarker party={party(1, 502, 1)} position={{ x: 42, y: 84 }} />);
    const node = screen.getByTestId("delve-party-502");
    expect(node).toHaveStyle({ left: "42px", top: "84px" });
  });

  it("carries an accessible name naming the banner and member count", () => {
    render(<PartyMarker party={party(2, 503, 3)} position={{ x: 0, y: 0 }} />);
    expect(screen.getByTestId("delve-party-503")).toHaveAccessibleName("Third Banner — 3 members");
  });
});
