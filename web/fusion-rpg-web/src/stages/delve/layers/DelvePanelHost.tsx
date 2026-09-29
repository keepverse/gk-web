import { absent, pendingWithReason, type Pending } from "@/contract/pending";
import { PLAYER_PENDING } from "@/contract/adapt";
import type { DelveView, EventView, ObjectPromptView, RoomView, SupplyView, TalkView } from "@/contract/types";
import { PanelShell } from "@/shell/PanelShell";
import { delvePanelTitle, type DelvePanelId } from "./panelId";
import { PackPanel } from "./PackPanel";
import { TalkPanel } from "./TalkPanel";
import { EventPanel } from "./EventPanel";
import { ObjectPromptPanel } from "./ObjectPromptPanel";
import { SupplyPanel } from "./SupplyPanel";
import { FightInputPanel } from "./FightInputPanel";

/** Wild-room-scoped (spec §7's own Talk row) — real per `RoomView.resolvedKind`/`.kind`, the same
 * sight-gated-then-resolved pair `labels.ts`'s own `roomKindLabel` already reads. `absent()` for "no
 * room to talk in" (no room selected, or a real, selected, non-wild room) — both genuinely have
 * nothing, not "wait for it"; see `TalkPanel.tsx`'s own doc comment for why one phrase covers both. */
function talkForRoom(room: RoomView | null): Pending<TalkView> {
  const kind = room?.resolvedKind ?? room?.kind ?? null;
  return kind === "wild" ? pendingWithReason(PLAYER_PENDING.delveTalkPanel) : absent();
}

/** Event-scoped by the room's own real `eventId` (the one real per-room signal for "is there an event
 * here" — `EventView` itself carries no such field, every one of its own fields is independently
 * `Pending`). `absent()` per field when there is genuinely no event; `pending` when there is one but no
 * producer composes its detail (`EventView`'s own doc comment: no adapter exists for this type at all). */
function eventForRoom(room: RoomView | null): EventView {
  const hasEvent = room?.eventId != null;
  if (!hasEvent) {
    return { eventId: absent(), kind: absent(), choices: absent(), banner: absent(), warnings: absent() };
  }
  return {
    eventId: pendingWithReason(PLAYER_PENDING.delveEventPanel),
    kind: pendingWithReason(PLAYER_PENDING.delveEventPanel),
    choices: pendingWithReason(PLAYER_PENDING.delveEventPanel),
    banner: pendingWithReason(PLAYER_PENDING.delveEventPanel),
    warnings: pendingWithReason(PLAYER_PENDING.delveEventPanel)
  };
}

/**
 * Room-scoped (spec §7's own Object-prompt row: "one panel per `RoomObject`"), but — unlike Talk's
 * `kind === "wild"` or Event's `eventId != null` — no field on `RoomView` names "does this room have a
 * `RoomObject` at all" (confirmed by reading `RoomView` in full: no such flag exists). A named
 * simplification, not a guess at an unstated kind-based rule: any selected room reads as "might have
 * one, not shown yet" rather than this task inventing which room kinds carry a `RoomObject`.
 */
function objectPromptForRoom(room: RoomView | null): Pending<ObjectPromptView> {
  return room != null ? pendingWithReason(PLAYER_PENDING.delveObjectPromptPanel) : absent();
}

/** Room-scoped ("what the party carries that can be used **here**", spec §7) — `SupplyUse.Use` is an
 * act, not a room-kind-gated browse, so the only real room-derived signal is whether a room is even
 * selected to act "here" in. */
function supplyForRoom(room: RoomView | null): Pending<SupplyView> {
  return room != null ? pendingWithReason(PLAYER_PENDING.delveSupplyPanel) : absent();
}

export type DelvePanelHostProps = {
  /** `toDelvePanelId(searchParams.get("panel"))` — already normalized by the caller (`DelveStage.tsx`);
   * `null` covers both "no panel requested" and "an unrecognised `?panel=` value" (`panelId.ts`'s own
   * doc comment), so this component never has to tell the two apart either. */
  panel: DelvePanelId | null;
  /** The whole projection (or its fixture fallback), already in scope at the call site — the same real
   * shape `DelveHud`/`DelveGraph` already read from, no parallel data model. */
  delve: DelveView;
  /** `delveSelection.ts`'s own `selectedRoomId` — looked up against `delve.rooms` here, the same
   * "caller passes the id, this component resolves the room" split `DelveHud.tsx` already uses. */
  selectedRoomId: string | null;
  onClose: () => void;
};

/**
 * The six band-2 panels' own switch and shared `PanelShell` (D5.7, spec-delve-stage.md §4/§7).
 * Replaces `DelveStage.tsx`'s own D5.1 placeholder ("This panel arrives with a later pass.") with the
 * real content per panel id — one `PanelShell`, one title per id (`panelId.ts`'s own
 * `delvePanelTitle`), one sub-component per surface.
 *
 * Room-scoping for the four surfaces that need it (Talk/Event/ObjectPrompt/Supply; Pack reads every
 * party at once, Fight reads none) is decided **here**, once, from the real `RoomView` the selected id
 * resolves to — each panel component itself stays a pure function of the already-resolved
 * `Pending<...>`/view value, matching `DelveHud.tsx`'s own "the HUD resolves the room, sub-components
 * render it" split.
 */
export function DelvePanelHost({ panel, delve, selectedRoomId, onClose }: DelvePanelHostProps) {
  const selectedRoom = delve.rooms.find((r) => r.sectorId === selectedRoomId) ?? null;
  const title = panel != null ? delvePanelTitle(panel) : "Delve panel";

  return (
    <PanelShell
      open={panel != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      testId="delve-stage-panel"
    >
      {panel === "pack" ? <PackPanel parties={delve.parties} /> : null}
      {panel === "talk" ? <TalkPanel talk={talkForRoom(selectedRoom)} /> : null}
      {panel === "event" ? <EventPanel event={eventForRoom(selectedRoom)} /> : null}
      {panel === "object" ? <ObjectPromptPanel prompt={objectPromptForRoom(selectedRoom)} /> : null}
      {panel === "supply" ? <SupplyPanel supply={supplyForRoom(selectedRoom)} /> : null}
      {panel === "fight" ? <FightInputPanel /> : null}
    </PanelShell>
  );
}
