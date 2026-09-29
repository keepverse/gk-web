import type { DelveView, RoomView } from "@/contract/types";
import { partyBannerLabel, roomKindLabel } from "@/stages/delve/labels";

/**
 * Matches `graph/RoomNode.tsx`'s own aria-label fallback text exactly (`"Undiscovered room"`) — read,
 * not imported: this task's own brief says to stay out of `graph/` entirely (D5.5 owns it,
 * concurrently), so the six-character string is duplicated here on purpose rather than sharing an
 * import with a directory this task does not touch. Both spots agree today; if either ever drifts,
 * that is a real, visible product inconsistency for whoever next edits either file, not a silent one.
 */
const UNDISCOVERED_ROOM = "Undiscovered room";

export type RoomReadoutProps = {
  /** The selected room (looked up by `DelveHud` from `delveSelection.ts`'s own `selectedRoomId`), or
   * `null` when nothing is selected — the room graph's own starting state. */
  room: RoomView | null;
  parties: DelveView["parties"];
};

/**
 * D5.6, spec-delve-stage.md §7's HUD row ("the room readout"). Reads only fields `RoomView`'s own doc
 * comment names as never sight-gated (`visited`/`cleared`/`keyForLaneId`) plus the same
 * `roomKindLabel(resolvedKind ?? kind)` composition `RoomNode.tsx` already uses for the sight-gated
 * kind — so a room reads identically here and on the graph card for the same sight tier, without this
 * file importing anything from `graph/`. Sight itself (`RoomView.sight`) is deliberately never
 * rendered as text — spec §8's own row: "Not words: a drawn treatment" — the graph already owns that
 * treatment; this readout only reports what it implies (a name, or "Undiscovered room").
 */
export function RoomReadout({ room, parties }: RoomReadoutProps) {
  if (room == null) {
    return (
      <div
        className="rounded border border-border bg-panel p-2 text-2xs text-muted"
        data-testid="delve-room-readout"
        data-room-selected="false"
      >
        <p className="italic" data-testid="delve-room-readout-empty">
          No room selected
        </p>
      </div>
    );
  }

  const label = roomKindLabel(room.resolvedKind ?? room.kind) ?? UNDISCOVERED_ROOM;
  const occupants = parties.filter((p) => p.atSectorId === room.sectorId);

  return (
    <div
      className="rounded border border-border bg-panel p-2 text-2xs"
      data-testid="delve-room-readout"
      data-room-selected="true"
    >
      <p className="text-sm font-medium text-text" data-testid="delve-room-readout-kind">
        {label}
      </p>
      <p className="text-muted" data-testid="delve-room-readout-status">
        {room.cleared ? "Cleared" : room.visited ? "Visited, not cleared" : "Not yet visited"}
      </p>
      {room.keyForLaneId != null ? (
        <p className="text-muted" data-testid="delve-room-readout-key">
          Holds a key
        </p>
      ) : null}
      {room.floorContents.state === "pending" ? (
        <p className="italic text-muted" data-testid="delve-room-readout-floor-pending">
          {room.floorContents.reason}
        </p>
      ) : null}
      {occupants.length > 0 ? (
        <p className="text-muted" data-testid="delve-room-readout-occupants">
          {occupants.map((p) => partyBannerLabel(p.partyIndex)).join(", ")} here
        </p>
      ) : null}
    </div>
  );
}
