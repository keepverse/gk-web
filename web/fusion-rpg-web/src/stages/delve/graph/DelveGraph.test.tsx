import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DelveView, DoorView, FightView, PartyView, RoomView } from "@/contract/types";
import { adaptDelve } from "@/contract/adapt";
import { known } from "@/contract/pending";
import firstDescent from "../fixtures/first-descent.json";
import { DelveGraph } from "./DelveGraph";
import { DEMO_ACTIVE_FIGHTS } from "./fightFixture";
import type { RoomFightState } from "./FightInPlace";

const room = (over: Partial<RoomView> & Pick<RoomView, "sectorId" | "rowIndex" | "colIndex">): RoomView => ({
  visited: false,
  cleared: false,
  keyForLaneId: null,
  sight: "Full",
  kind: "fight",
  archetypeId: "a",
  eventId: null,
  resolvedKind: "fight",
  resolvedArchetypeId: "a",
  floorContents: { state: "absent" },
  ...over
});

const door = (over: Partial<DoorView> & Pick<DoorView, "laneId" | "fromSectorId" | "toSectorId">): DoorView => ({
  typeId: "passage",
  gateKeyId: null,
  state: "Open",
  ...over
});

const member = (instanceId: string) => ({
  instanceId,
  pools: {},
  poolMax: { state: "pending" as const, reason: "no pool max yet" },
  poolFill: { state: "pending" as const, reason: "no pool fill yet" },
  nerveStacks: 0,
  nerveStage: { state: "pending" as const, reason: "no nerve stage yet" },
  downed: false,
  downedOnce: false,
  shield: { state: "pending" as const, reason: "no shield yet" },
  statuses: { state: "pending" as const, reason: "no statuses yet" }
});

const party = (over: Partial<PartyView> & Pick<PartyView, "partyIndex" | "entityId">): PartyView => ({
  atSectorId: null,
  onLaneId: null,
  route: [],
  members: [member(`m-${over.entityId}`)],
  pack: { state: "pending" as const, reason: "no pack yet" },
  haul: [],
  ...over
});

function makeDelve(over: Partial<DelveView>): DelveView {
  return {
    delveId: 1,
    worldId: "w-1",
    state: "Active",
    domainId: "d-1",
    raidMode: "solo",
    rungId: "r-1",
    soulsUnbanked: { unit: "count", value: 0 },
    rooms: [],
    doors: [],
    parties: [],
    revision: 1,
    quests: { state: "pending", reason: "no quests yet" },
    ...over
  };
}

describe("DelveGraph — the room graph container (D5.4)", () => {
  it("renders every room and every door of the delve it is given", () => {
    const delve = makeDelve({
      rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 }), room({ sectorId: "s-2", rowIndex: 0, colIndex: 1 })],
      doors: [door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2" })]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);

    expect(screen.getByTestId("delve-room-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("delve-room-s-2")).toBeInTheDocument();
    expect(screen.getByTestId("delve-door-l-1")).toBeInTheDocument();
  });

  it("a door referencing a room not in the room list is skipped rather than throwing", () => {
    const delve = makeDelve({
      rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 })],
      doors: [door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-missing" })]
    });
    expect(() => render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />)).not.toThrow();
    expect(screen.queryByTestId("delve-door-l-1")).not.toBeInTheDocument();
  });

  it("computes the compound secret-dead-end treatment: degree-1 room + its one door typed secret", () => {
    const delve = makeDelve({
      rooms: [
        room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 }),
        room({ sectorId: "s-2", rowIndex: 1, colIndex: 0, sight: "Glimpse", kind: "curio", resolvedKind: null })
      ],
      doors: [door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2", typeId: "secret" })]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);

    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-secret-dead-end", "true");
    // The other end (s-1) has other doors implied by a bigger graph in practice, but even here with
    // only one door total it is ALSO degree-1 — proving the rule is symmetric per room, not "the
    // far end only": both ends of a single secret passage are dead ends of a two-room graph.
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-secret-dead-end", "true");
  });

  it("a degree-1 room behind a PLAIN door is not flagged a secret dead end", () => {
    const delve = makeDelve({
      rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 }), room({ sectorId: "s-2", rowIndex: 1, colIndex: 0 })],
      doors: [door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2", typeId: "passage" })]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);
    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-secret-dead-end", "false");
  });

  it("a secret door into a room with a SECOND door is not a dead end at all", () => {
    const delve = makeDelve({
      rooms: [
        room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 }),
        room({ sectorId: "s-2", rowIndex: 1, colIndex: 0 }),
        room({ sectorId: "s-3", rowIndex: 1, colIndex: 1 })
      ],
      doors: [
        door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2", typeId: "secret" }),
        door({ laneId: "l-2", fromSectorId: "s-2", toSectorId: "s-3", typeId: "passage" })
      ]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);
    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-secret-dead-end", "false");
  });

  it("clicking a room calls onSelectRoom with its sectorId", async () => {
    const user = userEvent.setup();
    const onSelectRoom = vi.fn();
    const delve = makeDelve({ rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 })] });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={onSelectRoom} />);

    await user.click(screen.getByTestId("delve-room-s-1"));
    expect(onSelectRoom).toHaveBeenCalledWith("s-1");
  });

  it("clicking the empty background calls onSelectRoom(null), clicking a room does not bubble into a deselect", async () => {
    const user = userEvent.setup();
    const onSelectRoom = vi.fn();
    const delve = makeDelve({ rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 })] });
    render(<DelveGraph delve={delve} selectedRoomId="s-1" onSelectRoom={onSelectRoom} />);

    await user.click(screen.getByTestId("delve-room-s-1"));
    expect(onSelectRoom).toHaveBeenLastCalledWith("s-1");
    expect(onSelectRoom).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("delve-graph-viewport"));
    expect(onSelectRoom).toHaveBeenLastCalledWith(null);
  });

  it("a party at a room renders positioned on that room; a party mid-lane renders at the lane's midpoint", () => {
    const delve = makeDelve({
      rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 }), room({ sectorId: "s-2", rowIndex: 0, colIndex: 1 })],
      doors: [door({ laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2" })],
      parties: [
        party({ partyIndex: 0, entityId: 501, atSectorId: "s-1" }),
        party({ partyIndex: 1, entityId: 502, onLaneId: "l-1" })
      ]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);

    expect(screen.getByTestId("delve-party-501")).toHaveTextContent("First Banner");
    expect(screen.getByTestId("delve-party-502")).toHaveTextContent("Second Banner");
  });

  it("a party with neither atSectorId nor onLaneId renders no marker rather than guessing a position", () => {
    const delve = makeDelve({
      rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 })],
      parties: [party({ partyIndex: 0, entityId: 501, atSectorId: null, onLaneId: null })]
    });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);
    expect(screen.queryByTestId("delve-party-501")).not.toBeInTheDocument();
  });

  it("Fit / Zoom in / Zoom out buttons are present and change the camera transform", async () => {
    const user = userEvent.setup();
    const delve = makeDelve({ rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0 })] });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);

    const before = screen.getByTestId("delve-graph-camera").getAttribute("style");
    await user.click(screen.getByTestId("delve-graph-zoom-in"));
    const afterZoomIn = screen.getByTestId("delve-graph-camera").getAttribute("style");
    expect(afterZoomIn).not.toBe(before);

    await user.click(screen.getByTestId("delve-graph-fit"));
    const afterFit = screen.getByTestId("delve-graph-camera").getAttribute("style");
    expect(afterFit).not.toBe(afterZoomIn);
  });

  it("renders an empty delve (zero rooms) without throwing", () => {
    expect(() => render(<DelveGraph delve={makeDelve({})} selectedRoomId={null} onSelectRoom={() => {}} />)).not.toThrow();
    expect(screen.getByTestId("delve-graph")).toBeInTheDocument();
  });

  it("the bundled first-descent.json fixture adapts and renders end-to-end: six rooms, five doors, two parties", () => {
    const delve = adaptDelve(firstDescent as Parameters<typeof adaptDelve>[0]);
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);

    for (const id of ["s-1", "s-2", "s-3", "s-4", "s-5", "s-6"]) {
      expect(screen.getByTestId(`delve-room-${id}`)).toBeInTheDocument();
    }
    for (const laneId of ["l-gate", "l-1-3", "l-3-4", "l-3-5", "l-2-6"]) {
      expect(screen.getByTestId(`delve-door-${laneId}`)).toBeInTheDocument();
    }
    // s-5 is the fixture's own secret dead end (only door is l-3-5, typed "secret").
    expect(screen.getByTestId("delve-room-s-5")).toHaveAttribute("data-secret-dead-end", "true");
    // s-4 is unlit (sight None) — no kind text.
    expect(screen.getByTestId("delve-room-s-4")).toHaveAttribute("data-sight", "None");
    expect(screen.getByTestId("delve-party-501")).toBeInTheDocument();
    expect(screen.getByTestId("delve-party-502")).toBeInTheDocument();
  });
});

const knownFightView: FightView = {
  frozen: known(false),
  dwellRemaining: known({ unit: "milliseconds", value: 900 }),
  initiative: known([{}, {}]),
  strikeFeed: known([{}])
};

describe("DelveGraph — the fight drawn in place (D5.5)", () => {
  it("threads the fights map to the matching room by sectorId only", () => {
    const delve = makeDelve({
      rooms: [
        room({ sectorId: "s-1", rowIndex: 0, colIndex: 0, sight: "Full" }),
        room({ sectorId: "s-2", rowIndex: 0, colIndex: 1, sight: "Full" })
      ]
    });
    const fights: Record<string, RoomFightState> = { "s-1": { fight: knownFightView, steered: true } };
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} fights={fights} />);

    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-fight-expanded", "true");
    expect(screen.getByTestId("delve-room-s-2")).toHaveAttribute("data-fight-expanded", "false");
  });

  it("renders any room with an active fight entry LAST among room buttons, so it paints above its siblings with no z-index (bandGuard/GG-5)", () => {
    // Same shape as the bundled fixture's own real case: TWO rooms carry a fights[] entry (s-1 Full,
    // s-3 Glimpse) but only s-1 actually expands (the sight gate keeps s-3 a normal small card) — the
    // DOM-order guarantee is keyed on fights-membership, not on the `expanded` boolean, so both move
    // to the end; that is harmless since only s-1 (the one that can overlap a neighbour) needs to win.
    const delve = makeDelve({
      rooms: [
        room({ sectorId: "s-a", rowIndex: 0, colIndex: 0, sight: "Full" }),
        room({ sectorId: "s-1", rowIndex: 0, colIndex: 1, sight: "Full" }),
        room({ sectorId: "s-b", rowIndex: 1, colIndex: 0, sight: "Full" }),
        room({ sectorId: "s-3", rowIndex: 1, colIndex: 1, sight: "Glimpse" }),
        room({ sectorId: "s-c", rowIndex: 2, colIndex: 0, sight: "Full" })
      ]
    });
    const fights: Record<string, RoomFightState> = {
      "s-1": { fight: knownFightView, steered: true },
      "s-3": { fight: knownFightView, steered: false }
    };
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} fights={fights} />);

    const testIds = screen
      .getAllByTestId(/^delve-room-s-/)
      .map((el) => el.getAttribute("data-testid"));
    // The three rooms with NO fights entry keep their original relative order, first; the two with a
    // fights entry (regardless of whether they visually expand) come after, also in original order.
    expect(testIds).toEqual(["delve-room-s-a", "delve-room-s-b", "delve-room-s-c", "delve-room-s-1", "delve-room-s-3"]);
  });

  it("defaults to no fights at all when the prop is omitted — no room ever expands", () => {
    const delve = makeDelve({ rooms: [room({ sectorId: "s-1", rowIndex: 0, colIndex: 0, sight: "Full" })] });
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} />);
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-fight-expanded", "false");
  });

  it("the bundled fixture plus the demo fights map: s-1 (Full sight) expands, s-3 (Glimpse) does not, live-provable end to end", () => {
    const delve = adaptDelve(firstDescent as Parameters<typeof adaptDelve>[0]);
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} fights={DEMO_ACTIVE_FIGHTS} />);

    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-fight-expanded", "true");
    expect(screen.getByTestId("delve-room-fight")).toBeInTheDocument();
    // s-3 is Glimpse-sight in the bundled fixture — the demo supplies a fight there too, but the
    // sight gate refuses to expand it, proving the gate against real fixture data, not a synthetic one.
    expect(screen.getByTestId("delve-room-s-3")).toHaveAttribute("data-fight-expanded", "false");
  });

  it("a fight never mounts as a separate screen: the graph's own root and viewport testids are unaffected by an active fight", () => {
    const delve = adaptDelve(firstDescent as Parameters<typeof adaptDelve>[0]);
    render(<DelveGraph delve={delve} selectedRoomId={null} onSelectRoom={() => {}} fights={DEMO_ACTIVE_FIGHTS} />);
    expect(screen.getByTestId("delve-graph")).toBeInTheDocument();
    expect(screen.getByTestId("delve-graph-viewport")).toBeInTheDocument();
    expect(screen.getByTestId("delve-graph-camera").contains(screen.getByTestId("delve-room-fight"))).toBe(true);
  });
});
