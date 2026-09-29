import type { ReactNode } from "react";
import type { DelveView, FightView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { ConnectionStateBadge } from "./ConnectionStateBadge";
import type { DelveConnectionStatus } from "./connectionState";
import { InitiativeRail } from "./InitiativeRail";
import { PartyRail } from "./PartyRail";
import { QuestTracker } from "./QuestTracker";
import { RoomReadout } from "./RoomReadout";

/**
 * The one dimension the top strip and the right-edge column must agree on — found live, not assumed
 * safe. A first pass gave both anchors independent Tailwind widths (`justify-between` on the top
 * strip, `w-[240px]` on the right edge); both are `position: absolute` with no `z-index` beyond the
 * shared `.band-hud` token, so DOM order alone decides paint order, and the right-edge column (later
 * in the tree) painted directly over the souls figure — present and correct in the DOM
 * (`getBoundingClientRect` proved the two rects fully overlapping) but invisible on screen, the exact
 * "DOM right, nothing painted" shape `D5.4`'s own live-check record already warns this class of bug
 * takes. Fixed by giving the top strip real right padding equal to the column's own width, from one
 * shared literal, so the two can never drift back out of sync silently.
 */
const RIGHT_EDGE_WIDTH_PX = 240;

export type DelveHudProps = {
  /** The whole projection (D5.2/D5.3, `GET /api/delve/{delveId}`). Every sub-component below reads a
   * slice of this real shape — no parallel data model. */
  delve: DelveView;
  /** `delveSelection.ts`'s own `selectedRoomId` (D5.4) — read, not owned; this component looks the id
   * up in `delve.rooms` itself so `DelveStage.tsx` only has to pass the id, not the resolved room. */
  selectedRoomId: string | null;
  /**
   * Plain, simple status — see `connectionState.ts`'s own doc comment for why this is not
   * `Pending`-shaped and not read from a live source here. Defaults to `"offline"`, today's one honest
   * value: no live session has ever existed for a delve in this codebase (D5.11/D2.16, both correctly
   * still blocked — `tasks/party-dungeon-todo.md`).
   */
  connectionState?: DelveConnectionStatus;
  /** `FightView`, optional — see `InitiativeRail.tsx`'s own doc comment. No caller in this codebase
   * can supply a real one yet; `DelveStage.tsx` passes `undefined` today, honestly. */
  fight?: FightView;
  /** The room graph (D5.4/D5.5), filling whatever space the anchors below leave — the same
   * `children`-as-map-layer shape `stages/world/hud/WorldHud.tsx` already established. */
  children: ReactNode;
};

/**
 * The band-1 HUD frame for the delve stage (D5.6, spec-delve-stage.md §7's own HUD row: "Party strip
 * (parties by name), six pool meters and nerve stage per member, haul and unclaimed souls, quest
 * tracker, room readout, the initiative rail during a fight, connection state"). Mirrors
 * `stages/world/hud/WorldHud.tsx`'s own, already-shipped anchor-frame shape exactly: reserved,
 * always-present containers for the persistent occupants, `.band-hud` on every anchor (GG-5,
 * `shell/bandGuard.ts`), `pointer-events-none` on each anchor wrapper with `pointer-events-auto` only
 * on the real content, so the room graph underneath stays fully interactive everywhere the HUD itself
 * has nothing drawn. The one difference from `WorldHud`: this frame has **two** conditionally-absent
 * occupants, not one — `initiativeRail` (only "during a fight", §7's own qualifier) behaves exactly
 * like `WorldHud`'s own documented `leftEdge` ("the one conditional occupant... omit entirely... so a
 * reader can tell 'nothing here yet' from 'this anchor does not exist'"); `roomReadout` stays an
 * always-present container instead, because §7's own prose does not qualify it as conditional the way
 * it qualifies the rail — it renders its own honest "No room selected" state rather than disappearing.
 *
 * `top-left rail` is not one of this frame's anchors either, for the identical reason `WorldHud`'s own
 * doc comment gives: it is the shell's own `Rail.tsx`, unchanged, docked outside every stage's own HUD
 * (spec §7's own row: "The rail (`shell/Rail.tsx`) is unchanged and identical here, as on every stage").
 */
export function DelveHud({
  delve,
  selectedRoomId,
  connectionState = "offline",
  fight,
  children
}: DelveHudProps) {
  const selectedRoom = delve.rooms.find((r) => r.sectorId === selectedRoomId) ?? null;

  return (
    <div data-testid="delve-hud" className="relative h-full w-full overflow-hidden">
      <div data-testid="delve-hud-stage-layer" className="absolute inset-0">
        {children}
      </div>

      <div
        data-testid="delve-hud-anchor-top-strip"
        className="band-hud pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-2"
        style={{ paddingRight: RIGHT_EDGE_WIDTH_PX + 8 }}
      >
        <div className="pointer-events-auto">
          <ConnectionStateBadge status={connectionState} />
        </div>
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-pill border border-border-control bg-panel px-2 py-1 text-xs text-sun"
          data-testid="delve-hud-souls"
        >
          <span aria-hidden="true">✦</span>
          <span data-testid="delve-hud-souls-value">{formatMagnitude(delve.soulsUnbanked)}</span>
          <span className="text-muted">unclaimed</span>
        </div>
      </div>

      {fight != null ? (
        <div
          data-testid="delve-hud-anchor-initiative-rail"
          className="band-hud pointer-events-none absolute inset-x-0 top-12 flex justify-center p-2"
        >
          <div className="pointer-events-auto">
            <InitiativeRail fight={fight} />
          </div>
        </div>
      ) : null}

      <div
        data-testid="delve-hud-anchor-right-edge"
        className="band-hud pointer-events-none absolute inset-y-0 right-0 overflow-y-auto overflow-x-hidden p-2"
        style={{ width: RIGHT_EDGE_WIDTH_PX }}
      >
        <div className="pointer-events-auto">
          <PartyRail parties={delve.parties} />
        </div>
      </div>

      <div
        data-testid="delve-hud-anchor-bottom-left"
        className="band-hud pointer-events-none absolute bottom-0 left-0 w-[220px] p-2"
      >
        <div className="pointer-events-auto">
          <QuestTracker quests={delve.quests} />
        </div>
      </div>

      <div
        data-testid="delve-hud-anchor-bottom-right"
        className="band-hud pointer-events-none absolute bottom-0 right-0 w-[240px] p-2"
      >
        <div className="pointer-events-auto">
          <RoomReadout room={selectedRoom} parties={delve.parties} />
        </div>
      </div>
    </div>
  );
}
