import type { Pending } from "@/contract/pending";
import type { EventView } from "@/contract/types";

function fallbackText(field: Pending<unknown>): string {
  return field.state === "pending" ? field.reason : "There's nothing happening here.";
}

export type EventPanelProps = {
  /**
   * Unlike Talk/ObjectPrompt/Supply, `EventView`'s own six fields are *already* individually `Pending`
   * at the contract level (`contract/types.ts`'s own doc comment: "No adapter exists for this type" —
   * `EventResolution`/`EventDeck` do not exist anywhere in `.cs` source) — so this panel takes a plain
   * `EventView`, never a second, presentation-level `Pending<EventView>` wrapper. `DelvePanelHost.tsx`'s
   * own `eventForRoom` decides each field's state per-room: `absent()` when the selected room's real
   * `eventId` is `null` (genuinely no event here), `pending` when it is not (an event is real here, but
   * nothing composes its detail yet).
   */
  event: EventView;
};

/**
 * Band-2 Event panel (D5.7, spec-delve-stage.md §7: "choices, warnings, the banner"). Room-scoped by
 * `RoomView.eventId` — the one real signal a room carries for "does this room have an event at all"
 * (every field of `EventView` itself is `Pending`, so the id presence/absence has to come from the
 * room, not this type). `eventId` itself is never rendered (an engine content id — the same "never
 * print a raw id" discipline `sectorId`/`archetypeId` already get elsewhere in this stage).
 *
 * `banner` is deliberately not rendered here: §7's own row says it "arrives through the `ui.present`
 * sink," a different, band-4-adjacent surface (`spec-event-deck.md:176`) — not this panel's own body.
 */
export function EventPanel({ event }: EventPanelProps) {
  return (
    <div data-testid="delve-panel-event" className="flex flex-col gap-1 text-2xs">
      <p className="italic text-muted" data-testid="delve-event-kind">
        {fallbackText(event.kind)}
      </p>
      <p className="italic text-muted" data-testid="delve-event-choices">
        {fallbackText(event.choices)}
      </p>
      <p className="italic text-muted" data-testid="delve-event-warnings">
        {fallbackText(event.warnings)}
      </p>
    </div>
  );
}
