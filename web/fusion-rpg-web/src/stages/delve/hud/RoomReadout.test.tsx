import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, pendingWithReason } from "@/contract/pending";
import type { PartyView, RoomView } from "@/contract/types";
import { RoomReadout } from "./RoomReadout";

function room(overrides: Partial<RoomView> = {}): RoomView {
  return {
    sectorId: "s-1",
    rowIndex: 0,
    colIndex: 0,
    visited: false,
    cleared: false,
    keyForLaneId: null,
    sight: "Full",
    kind: "fight",
    archetypeId: "arch-1",
    eventId: null,
    resolvedKind: "fight",
    resolvedArchetypeId: "arch-1",
    floorContents: absent(),
    ...overrides
  };
}

function party(partyIndex: number, entityId: number, atSectorId: string | null): PartyView {
  return {
    partyIndex,
    entityId,
    atSectorId,
    onLaneId: null,
    route: [],
    members: [],
    pack: pendingWithReason("test"),
    haul: []
  };
}

describe("RoomReadout (D5.6, spec-delve-stage.md §7 — the room readout)", () => {
  it("no room selected: an honest empty state, not a blank card", () => {
    render(<RoomReadout room={null} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout")).toHaveAttribute("data-room-selected", "false");
    expect(screen.getByTestId("delve-room-readout-empty")).toHaveTextContent("No room selected");
  });

  it("a sight-gated room (kind: null) reads 'Undiscovered room' — the exact same fallback graph/RoomNode.tsx's own aria-label uses", () => {
    render(<RoomReadout room={room({ kind: null, resolvedKind: null, sight: "None" })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-kind")).toHaveTextContent("Undiscovered room");
  });

  it("a glimpsed room (kind known, resolvedKind still null) renders through roomKindLabel — the same resolvedKind ?? kind composition RoomNode.tsx uses", () => {
    render(<RoomReadout room={room({ kind: "trap", resolvedKind: null, sight: "Glimpse" })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-kind")).toHaveTextContent("Trap");
  });

  it("a fully-seen room prefers resolvedKind over kind", () => {
    render(<RoomReadout room={room({ kind: "unknown", resolvedKind: "boss", sight: "Full" })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-kind")).toHaveTextContent("The lair");
  });

  it("status: not visited / visited-not-cleared / cleared are three distinct, real states", () => {
    const { rerender } = render(<RoomReadout room={room({ visited: false, cleared: false })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-status")).toHaveTextContent("Not yet visited");

    rerender(<RoomReadout room={room({ visited: true, cleared: false })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-status")).toHaveTextContent("Visited, not cleared");

    rerender(<RoomReadout room={room({ visited: true, cleared: true })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-status")).toHaveTextContent("Cleared");
  });

  it("a key-bearing room shows the key indicator; a room with none does not", () => {
    const { rerender } = render(<RoomReadout room={room({ keyForLaneId: "l-gate" })} parties={[]} />);
    expect(screen.getByTestId("delve-room-readout-key")).toBeInTheDocument();

    rerender(<RoomReadout room={room({ keyForLaneId: null })} parties={[]} />);
    expect(screen.queryByTestId("delve-room-readout-key")).not.toBeInTheDocument();
  });

  it("floorContents pending renders its own real reason; absent renders nothing extra", () => {
    const { rerender } = render(
      <RoomReadout room={room({ floorContents: pendingWithReason("What's on the floor here isn't shown yet") })} parties={[]} />
    );
    expect(screen.getByTestId("delve-room-readout-floor-pending")).toHaveTextContent(
      "What's on the floor here isn't shown yet"
    );

    rerender(<RoomReadout room={room({ floorContents: absent() })} parties={[]} />);
    expect(screen.queryByTestId("delve-room-readout-floor-pending")).not.toBeInTheDocument();
  });

  it("occupants: a party standing in this room is named by its real banner, never its index", () => {
    const parties = [party(0, 501, "s-1"), party(1, 502, "s-9")];
    render(<RoomReadout room={room({ sectorId: "s-1" })} parties={parties} />);
    const occupantsEl = screen.getByTestId("delve-room-readout-occupants");
    expect(occupantsEl).toHaveTextContent("First Banner");
    expect(occupantsEl).not.toHaveTextContent("Second Banner");
  });

  it("no occupants: no occupants line at all", () => {
    render(<RoomReadout room={room({ sectorId: "s-1" })} parties={[party(0, 501, "s-9")]} />);
    expect(screen.queryByTestId("delve-room-readout-occupants")).not.toBeInTheDocument();
  });
});
