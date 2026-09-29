import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DelveView, RoomView } from "@/contract/types";
import { cn } from "@/lib/cn";
import { INITIAL_CAMERA, cameraReducer } from "./cameraState";
import { DoorEdge } from "./DoorEdge";
import { doorTreatmentFor } from "./doorKind";
import type { RoomFightState } from "./FightInPlace";
import { PartyMarker } from "./PartyMarker";
import { RoomNode } from "./RoomNode";
import { doorsForRoom, graphBounds, roomCentre, type Point } from "./roomGraphLayout";

export type DelveGraphProps = {
  delve: DelveView;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  /**
   * Active fights, keyed by `sectorId` (D5.5). Defaults to empty: no live source exists yet
   * (D2.16's own still-blocked `DelveBattleEndpoints.cs`/`RpgHub` surface; D5.11's own still-unbuilt
   * session client — both read in full before writing this prop, neither re-litigated here), so in
   * production this is always `{}` and no room ever expands. Populated only by a caller's own
   * fixture/demo data today — `graph/fightFixture.ts`'s own doc comment names this precisely.
   */
  fights?: Record<string, RoomFightState>;
  className?: string;
};

const ZOOM_STEP = 1.2;
/** Below this many pixels of pointer travel, a pointerdown→pointerup is a click (select/deselect),
 * not a pan — the same small-slop-tolerance idea every drag-vs-click UI needs; not a game number. */
const DRAG_CLICK_THRESHOLD_PX = 4;

/**
 * The room graph — the delve stage itself (D5.4, spec-delve-stage.md §4/§7). Rooms, doors, party
 * markers and the three sight treatments, composed from `RoomNode`/`DoorEdge`/`PartyMarker` plus this
 * module's own camera (pan via pointer drag, zoom/fit via buttons — deliberately matching
 * `WorldStage.tsx`'s own interaction surface, `:399-430`, rather than adding wheel-zoom that stage
 * does not have either).
 *
 * **A plain CSS transform, not a canvas/graph library.** `docs/design/tech-stack.md` T3/T5 locks
 * `@xyflow/react` for "genuine node/tree surfaces" and explicitly retracts the old repo-wide removal —
 * but `stages/world/xyflowGuard.test.ts` still enforces exactly that repo-wide removal today, unedited
 * by the 2026-09-07 amendment (its own doc comment says why: written for the world stage specifically,
 * never narrowed after delve started needing a different answer). Flipping a live, enforced guard is
 * an architecture-lock change this task does not have standing to make unilaterally
 * (`AGENTS.md`: "Architecture changes that lock behavior need decisions.md first") — named here and in
 * `tasks/party-dungeon-todo.md`'s own D5.4 entry, not silently worked around. A full Phaser island is
 * separately out of reach: GG-38 (amended) scopes Phaser canvases to "lawn/world only," and
 * `spec-board-render.md` prices the *shared* board layer at "world-stage scale... budget this as its
 * own module." A plain, tested, accessible DOM+SVG tree — the exact split `stages/world/render/`
 * already models (pure channel functions, dumb components) but never wired to a live render tree — is
 * the one option actually open to this task, so that is what this component is.
 */
export function DelveGraph({ delve, selectedRoomId, onSelectRoom, fights = {}, className }: DelveGraphProps) {
  const [camera, dispatch] = useReducer(cameraReducer, INITIAL_CAMERA);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const hasFitRef = useRef(false);
  const dragRef = useRef<{ lastX: number; lastY: number; moved: number } | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo(() => graphBounds(delve.rooms), [delve.rooms]);

  // Fit exactly once, the first time a real viewport size and at least one room both exist — a
  // player's own subsequent pan/zoom then survives every refetch (spec §14: "camera... survive"),
  // not just a panel open/close. Never refires on a later revision bump.
  useEffect(() => {
    if (hasFitRef.current) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    if (delve.rooms.length === 0) return;
    hasFitRef.current = true;
    dispatch({ type: "fit", bounds, viewport });
  }, [viewport, bounds, delve.rooms.length]);

  const roomsById = useMemo(() => new Map(delve.rooms.map((r) => [r.sectorId, r] as const)), [delve.rooms]);

  // Every room is `position: absolute` with no explicit z-index (bandGuard/GG-5 forbids a raw
  // `z-*` class outside the seven `.band-*` tiers, and "one game-canvas card among its siblings"
  // is not one of those seven — it stays inside `.band-stage`). So an expanded, fight-in-place
  // room (D5.5) can only paint above its neighbors via DOM order: later siblings in the SAME
  // stacking context paint over earlier ones for free. A stable sort that moves any room with an
  // active fight to the end is the whole mechanism — no z-index needed, nothing else about a
  // room's own position/behaviour changes.
  const orderedRooms = useMemo(
    () => [...delve.rooms].sort((a, b) => Number(a.sectorId in fights) - Number(b.sectorId in fights)),
    [delve.rooms, fights]
  );

  const secretDeadEndFor = useMemo(() => {
    const flags = new Map<string, boolean>();
    for (const room of delve.rooms) {
      const touching = doorsForRoom(room.sectorId, delve.doors);
      const secretDeadEnd = touching.length === 1 && doorTreatmentFor(touching[0]!).secret;
      flags.set(room.sectorId, secretDeadEnd);
    }
    return flags;
  }, [delve.rooms, delve.doors]);

  function positionForParty(party: DelveView["parties"][number]): Point | null {
    if (party.atSectorId != null) {
      const room = roomsById.get(party.atSectorId);
      return room ? roomCentre(room) : null;
    }
    if (party.onLaneId != null) {
      const door = delve.doors.find((d) => d.laneId === party.onLaneId);
      if (!door) return null;
      const from = roomsById.get(door.fromSectorId);
      const to = roomsById.get(door.toSectorId);
      if (!from || !to) return null;
      const a = roomCentre(from);
      const b = roomCentre(to);
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    // Neither is set — no real delve wires party entities into WorldState yet (PartyView's own doc
    // comment). Nothing honest to draw, so this party has no marker rather than a guessed one at the
    // origin.
    return null;
  }

  function zoomAtCentre(factor: number) {
    dispatch({ type: "zoom-by", factor, anchor: { x: viewport.width / 2, y: viewport.height / 2 } });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { lastX: e.clientX, lastY: e.clientY, moved: 0 };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 0) dispatch({ type: "pan", dx, dy });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleBackgroundClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (dragRef.current && dragRef.current.moved > DRAG_CLICK_THRESHOLD_PX) return;
    onSelectRoom(null);
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-soil", className)} data-testid="delve-graph">
      <div
        ref={viewportRef}
        data-testid="delve-graph-viewport"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleBackgroundClick}
      >
        <div
          data-testid="delve-graph-camera"
          className="absolute left-0 top-0"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: "0 0" }}
        >
          {/* A zero-size `<svg>` viewport suppresses rendering of everything inside it in Chromium,
              `overflow: visible` notwithstanding — found live, this session, via the actual browser
              check (the door lines were invisible; the DOM nodes were correct, `getBBox()` returned
              an empty box). Sized from the same `bounds` the camera's own `fit` action already
              computes, so this grows with the graph instead of a guessed ceiling. */}
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={Math.max(1, bounds.minX + bounds.width)}
            height={Math.max(1, bounds.minY + bounds.height)}
          >
            <defs>
              <marker id="delve-door-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" className="fill-muted" />
              </marker>
            </defs>
            {delve.doors.map((door) => {
              const from = roomsById.get(door.fromSectorId);
              const to = roomsById.get(door.toSectorId);
              if (!from || !to) return null;
              return <DoorEdge key={door.laneId} door={door} from={roomCentre(from)} to={roomCentre(to)} />;
            })}
          </svg>

          {orderedRooms.map((room: RoomView) => (
            <RoomNode
              key={room.sectorId}
              room={room}
              selected={room.sectorId === selectedRoomId}
              secretDeadEnd={secretDeadEndFor.get(room.sectorId) ?? false}
              fight={fights[room.sectorId] ?? null}
              onSelect={() => onSelectRoom(room.sectorId)}
            />
          ))}

          {delve.parties.map((party) => {
            const position = positionForParty(party);
            return position ? <PartyMarker key={party.entityId} party={party} position={position} /> : null;
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-1">
        <button
          type="button"
          data-testid="delve-graph-fit"
          className="pointer-events-auto rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
          onClick={() => dispatch({ type: "fit", bounds, viewport })}
        >
          Fit
        </button>
        <button
          type="button"
          data-testid="delve-graph-zoom-in"
          aria-label="Zoom in"
          className="pointer-events-auto rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
          onClick={() => zoomAtCentre(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          data-testid="delve-graph-zoom-out"
          aria-label="Zoom out"
          className="pointer-events-auto rounded border border-border bg-panel px-2 py-1 text-sm text-ink"
          onClick={() => zoomAtCentre(1 / ZOOM_STEP)}
        >
          −
        </button>
      </div>
    </div>
  );
}
