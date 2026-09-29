import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import type { DelveView, FightView, RoomView } from "@/contract/types";
import { DelveHud } from "./DelveHud";

function room(overrides: Partial<RoomView> = {}): RoomView {
  return {
    sectorId: "s-1",
    rowIndex: 0,
    colIndex: 0,
    visited: true,
    cleared: false,
    keyForLaneId: null,
    sight: "Full",
    kind: "fight",
    archetypeId: "arch-1",
    eventId: null,
    resolvedKind: "fight",
    resolvedArchetypeId: "arch-1",
    floorContents: pendingWithReason("test"),
    ...overrides
  };
}

function delve(overrides: Partial<DelveView> = {}): DelveView {
  return {
    delveId: 8812,
    worldId: "first-light",
    state: "Active",
    domainId: "the-fen",
    raidMode: "pair",
    rungId: "r-3",
    soulsUnbanked: { unit: "count", value: 140 },
    rooms: [room({ sectorId: "s-1" }), room({ sectorId: "s-2", kind: "cache", resolvedKind: "cache" })],
    doors: [],
    parties: [
      {
        partyIndex: 0,
        entityId: 501,
        atSectorId: "s-1",
        onLaneId: null,
        route: ["s-1"],
        members: [
          {
            instanceId: "m-1",
            pools: { hp: { unit: "count", value: 80 } },
            poolMax: pendingWithReason("test"),
            poolFill: pendingWithReason("test"),
            nerveStacks: 0,
            nerveStage: pendingWithReason("test"),
            downed: false,
            downedOnce: false,
            shield: pendingWithReason("test"),
            statuses: pendingWithReason("test")
          }
        ],
        pack: pendingWithReason("test"),
        haul: []
      }
    ],
    revision: 1,
    quests: pendingWithReason("Quest progress isn't shown yet"),
    ...overrides
  };
}

describe("DelveHud (D5.6, spec-delve-stage.md §7 — the HUD frame)", () => {
  it("every reserved anchor exists — reserved, not omitted", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud-anchor-top-strip")).toBeInTheDocument();
    expect(screen.getByTestId("delve-hud-anchor-right-edge")).toBeInTheDocument();
    expect(screen.getByTestId("delve-hud-anchor-bottom-left")).toBeInTheDocument();
    expect(screen.getByTestId("delve-hud-anchor-bottom-right")).toBeInTheDocument();
  });

  it("every anchor carries band-hud (GG-5)", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud-anchor-top-strip")).toHaveClass("band-hud");
    expect(screen.getByTestId("delve-hud-anchor-right-edge")).toHaveClass("band-hud");
    expect(screen.getByTestId("delve-hud-anchor-bottom-left")).toHaveClass("band-hud");
    expect(screen.getByTestId("delve-hud-anchor-bottom-right")).toHaveClass("band-hud");
  });

  it("the initiative rail anchor is the one conditional occupant — absent with no fight, present once one is passed", () => {
    const { rerender } = render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.queryByTestId("delve-hud-anchor-initiative-rail")).not.toBeInTheDocument();

    const fight: FightView = {
      dwellRemaining: pendingWithReason("test"),
      initiative: pendingWithReason("test"),
      strikeFeed: pendingWithReason("test"),
      frozen: pendingWithReason("test")
    };
    rerender(
      <DelveHud delve={delve()} selectedRoomId={null} fight={fight}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud-anchor-initiative-rail")).toBeInTheDocument();
    expect(screen.getByTestId("delve-hud-anchor-initiative-rail")).toHaveClass("band-hud");
  });

  it("the room graph fills its own stage layer, independent of the anchors around it", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        {"the room graph itself"}
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud-stage-layer")).toHaveTextContent("the room graph itself");
  });

  it("the frame never grows the page — overflow-hidden, not overflow-auto", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("delve-hud").className).not.toMatch(/overflow-auto/);
  });

  it("unclaimed souls: renders delve.soulsUnbanked through formatMagnitude in the top strip", () => {
    render(
      <DelveHud delve={delve({ soulsUnbanked: { unit: "count", value: 140 } })} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-hud-souls-value")).toHaveTextContent("140");
  });

  it("connection state: defaults to 'offline' — the one honest value while D5.11 is still blocked", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-connection-state")).toHaveAttribute("data-status", "offline");
  });

  it("connection state: a caller-supplied status overrides the default", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null} connectionState="live">
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-connection-state")).toHaveAttribute("data-status", "live");
  });

  it("room readout: selectedRoomId is looked up against delve.rooms and the right room's own kind renders", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId="s-2">
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-room-readout-kind")).toHaveTextContent("Cache");
  });

  it("room readout: an id with no matching room reads as 'no room selected', never a crash", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId="s-does-not-exist">
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-room-readout-empty")).toBeInTheDocument();
  });

  it("party rail: renders the real party banner name, wired straight from delve.parties", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByText("First Banner")).toBeInTheDocument();
  });

  it("quest tracker: wired straight from delve.quests, including its real Pending state", () => {
    render(
      <DelveHud delve={delve({ quests: known([]) })} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    expect(screen.getByTestId("delve-quest-tracker-empty")).toBeInTheDocument();
  });

  it("the top strip clears the right-edge column by the SAME literal width — regression test for a real, live-found bug: both anchors are position:absolute with no z-index beyond the shared band-hud token, so DOM order alone decides paint order, and an uncoordinated top-strip once let the right-edge column silently paint over (and hide) the souls figure. jsdom computes no real layout, so this asserts the coupling at the style level instead — the one thing that can actually drift", () => {
    render(
      <DelveHud delve={delve()} selectedRoomId={null}>
        graph
      </DelveHud>
    );
    const topStrip = screen.getByTestId("delve-hud-anchor-top-strip");
    const rightEdge = screen.getByTestId("delve-hud-anchor-right-edge");
    const rightEdgeWidth = parseFloat(rightEdge.style.width);
    const topStripPaddingRight = parseFloat(topStrip.style.paddingRight);
    expect(rightEdgeWidth).toBeGreaterThan(0);
    expect(topStripPaddingRight).toBeGreaterThanOrEqual(rightEdgeWidth);
  });
});
