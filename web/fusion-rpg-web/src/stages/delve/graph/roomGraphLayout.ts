import type { DoorView, RoomView } from "@/contract/types";

/**
 * Pure room-graph geometry (D5.4). `RoomView.rowIndex`/`colIndex` are already the server's own grid
 * placement (`DelveRoomFact.Row`/`Col`, `Core/Delve/Roll/DelveGraph.cs:57` — canonical `(row, col)`
 * order, `DelveGraph`'s own doc comment) — there is no client-side layout ALGORITHM here, only unit
 * conversion, the same division of labour `worldViewModel.ts`'s own module comment describes for the
 * (there, authored-by-hand) sector grid: *"Sectors are placed, never auto-laid-out."*
 *
 * FE presentation constants (cell size, gaps) — not game balance, so they stay a plain module-local
 * const file rather than `gk-core/data/tuning/` (`spec-board-render.md`'s own "Tunables" section draws this
 * exact line: "cell pixel size, camera limits, animation durations... are **not** game balance").
 */
export const ROOM_CELL_W = 220;
export const ROOM_CELL_H = 160;

export type Point = { x: number; y: number };

/** The pixel centre of one room's cell. */
export function roomCentre(room: Pick<RoomView, "rowIndex" | "colIndex">): Point {
  return {
    x: room.colIndex * ROOM_CELL_W + ROOM_CELL_W / 2,
    y: room.rowIndex * ROOM_CELL_H + ROOM_CELL_H / 2
  };
}

export type GraphBounds = { minX: number; minY: number; width: number; height: number };

/** The bounding box of every room's cell, padded by half a cell so a room at the edge is never flush
 * against the viewport — the input to `cameraState.ts`'s `fit`. An empty room list bounds a single
 * origin cell rather than a degenerate zero-size box, so `fit` always has something to divide by. */
export function graphBounds(rooms: readonly Pick<RoomView, "rowIndex" | "colIndex">[]): GraphBounds {
  if (rooms.length === 0) {
    return { minX: -ROOM_CELL_W / 2, minY: -ROOM_CELL_H / 2, width: ROOM_CELL_W, height: ROOM_CELL_H };
  }
  const rows = rooms.map((r) => r.rowIndex);
  const cols = rooms.map((r) => r.colIndex);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  return {
    minX: minCol * ROOM_CELL_W - ROOM_CELL_W / 2,
    minY: minRow * ROOM_CELL_H - ROOM_CELL_H / 2,
    width: (maxCol - minCol + 1) * ROOM_CELL_W,
    height: (maxRow - minRow + 1) * ROOM_CELL_H
  };
}

/** Every door touching one room, from either end — doors are never sight-gated (`DoorView`'s own
 * "position and LANES only" clause), so this reads the full door list unconditionally, never `rooms`. */
export function doorsForRoom(sectorId: string, doors: readonly DoorView[]): DoorView[] {
  return doors.filter((d) => d.fromSectorId === sectorId || d.toSectorId === sectorId);
}

/**
 * A room reached by exactly one door — the graph-structure half of "secret dead end" (spec §4/§7).
 * Pure degree-1 count, computed client-side from the always-public door list; combine with
 * `doorKind.ts`'s `doorTreatmentFor(...).secret` on that one door to get the full compound treatment
 * `DelveGraph.tsx` renders. A room with zero doors (never legal — `ObjectPreflight.Run`'s own
 * "every gated door has a key or break path" metric implies full connectivity) is not treated as a
 * dead end by this function; it would be a different, worse bug this module has no business hiding.
 */
export function isDeadEnd(sectorId: string, doors: readonly DoorView[]): boolean {
  return doorsForRoom(sectorId, doors).length === 1;
}

/** Look up a room by sector id — every door-drawing call site needs both endpoints' positions. */
export function roomById(sectorId: string, rooms: readonly RoomView[]): RoomView | undefined {
  return rooms.find((r) => r.sectorId === sectorId);
}
