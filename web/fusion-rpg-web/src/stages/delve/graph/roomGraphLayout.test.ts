import { describe, expect, it } from "vitest";
import type { DoorView, RoomView } from "@/contract/types";
import { ROOM_CELL_H, ROOM_CELL_W, doorsForRoom, graphBounds, isDeadEnd, roomById, roomCentre } from "./roomGraphLayout";

const door = (laneId: string, from: string, to: string): DoorView => ({
  laneId,
  fromSectorId: from,
  toSectorId: to,
  typeId: "passage",
  gateKeyId: null,
  state: "Open"
});

const room = (sectorId: string, rowIndex: number, colIndex: number): RoomView => ({
  sectorId,
  rowIndex,
  colIndex,
  visited: false,
  cleared: false,
  keyForLaneId: null,
  sight: "Full",
  kind: "fight",
  archetypeId: "a",
  eventId: null,
  resolvedKind: "fight",
  resolvedArchetypeId: "a",
  floorContents: { state: "absent" }
});

describe("roomCentre", () => {
  it("is the middle of the room's own grid cell", () => {
    expect(roomCentre({ rowIndex: 0, colIndex: 0 })).toEqual({ x: ROOM_CELL_W / 2, y: ROOM_CELL_H / 2 });
    expect(roomCentre({ rowIndex: 2, colIndex: 3 })).toEqual({
      x: 3 * ROOM_CELL_W + ROOM_CELL_W / 2,
      y: 2 * ROOM_CELL_H + ROOM_CELL_H / 2
    });
  });
});

describe("graphBounds", () => {
  it("wraps every room's cell with a half-cell pad on every side", () => {
    const bounds = graphBounds([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 1, colIndex: 2 }
    ]);
    expect(bounds).toEqual({
      minX: -ROOM_CELL_W / 2,
      minY: -ROOM_CELL_H / 2,
      width: 3 * ROOM_CELL_W,
      height: 2 * ROOM_CELL_H
    });
  });

  it("never divides by zero for an empty room list — a single-cell box instead", () => {
    const bounds = graphBounds([]);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });
});

describe("doorsForRoom / isDeadEnd — the graph-structure half of a secret dead end", () => {
  const doors: DoorView[] = [door("l-1", "s-1", "s-2"), door("l-2", "s-2", "s-3")];

  it("finds every door touching a room from either end", () => {
    expect(doorsForRoom("s-2", doors).map((d) => d.laneId).sort()).toEqual(["l-1", "l-2"]);
    expect(doorsForRoom("s-1", doors).map((d) => d.laneId)).toEqual(["l-1"]);
  });

  it("a room with exactly one door is a dead end", () => {
    expect(isDeadEnd("s-1", doors)).toBe(true);
    expect(isDeadEnd("s-3", doors)).toBe(true);
  });

  it("a room with two or more doors is not a dead end", () => {
    expect(isDeadEnd("s-2", doors)).toBe(false);
  });

  it("a room with zero doors is not treated as a dead end — a different, worse bug, not this module's to hide", () => {
    expect(isDeadEnd("s-unconnected", doors)).toBe(false);
  });
});

describe("roomById", () => {
  it("finds a room by sectorId", () => {
    const rooms = [room("s-1", 0, 0), room("s-2", 0, 1)];
    expect(roomById("s-2", rooms)?.sectorId).toBe("s-2");
    expect(roomById("s-missing", rooms)).toBeUndefined();
  });
});
