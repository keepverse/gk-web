import type { Pending } from "@/contract/pending";
import type { ObjectPromptView } from "@/contract/types";
import { objectKindLabel, objectVerbLabel } from "@/stages/delve/labels";

function fallbackText(prompt: Pending<ObjectPromptView>): string {
  return prompt.state === "pending" ? prompt.reason : "Pick a room first.";
}

export type ObjectPromptPanelProps = {
  /**
   * A presentation-level wrapper, the same move `TalkPanel`/`SupplyPanel` make and for the identical
   * reason: every field of `ObjectPromptView` is real (`RoomObjectBuilder.For`'s own output — the
   * type's own doc comment), so there is no field-level `Pending` to lean on the way `EventPanel` uses
   * `EventView`'s own fields — "is there even a room object here" has to be modelled at this boundary
   * instead. `DelvePanelHost.tsx`'s own `objectPromptForRoom` supplies `absent()` when no room is
   * selected, `pending` otherwise (see that function's own doc comment for the named simplification:
   * this stage has no real per-room-kind signal for "does this room actually have a `RoomObject`" the
   * way it does for Talk's `kind === "wild"` or Event's `eventId != null`, so any selected room reads
   * as "might have one, not shown yet" rather than guessing a kind-based rule no source names).
   */
  prompt: Pending<ObjectPromptView>;
};

/**
 * Band-2 Object prompt panel (D5.7, spec-delve-stage.md §7: "one panel per `RoomObject`, its offered
 * verbs, each disabled verb carrying its reason"). `ObjectPromptView`'s own doc comment names why the
 * second half of that acceptance ("each disabled verb carrying its reason") is not yet satisfiable from
 * real data: `verbs` is offered-only, with no per-verb enabled/disabled+reason shape anywhere
 * (`VerbOutcome`/`VerbResolver.Resolve` compute that per-attempt, not as a precomputed batch one
 * adapter call can build) — so every offered verb renders as a plain, inert tag here, never a button
 * disabled with a made-up reason: nothing is actually refused (§10's own rule is about a *predictable*
 * refusal; this is "not yet computed," not "refused"), and rendering an enabled-looking button with no
 * real action wired (no room-object-verb route exists in `lib/bus/` — confirmed by reading
 * `lib/bus/delve.ts` in full) would be worse than an honest tag.
 *
 * `sectorId` is never rendered (an engine content id, joining this prompt to its room — read, not
 * shown, the same discipline `EventPanel`'s own `eventId` gets).
 */
export function ObjectPromptPanel({ prompt }: ObjectPromptPanelProps) {
  return (
    <div data-testid="delve-panel-object" className="flex flex-col gap-2 text-2xs">
      {prompt.state === "known" ? (
        <>
          <p className="text-text" data-testid="delve-object-kind">
            {objectKindLabel(prompt.value.kind)}
          </p>
          <ul className="flex flex-wrap gap-1" data-testid="delve-object-verbs">
            {prompt.value.verbs.map((verb, i) => (
              <li
                key={`${verb}-${i}`}
                data-testid={`delve-object-verb-${verb}`}
                className="rounded-pill border border-border-control px-2 py-0.5"
              >
                {objectVerbLabel(verb)}
              </li>
            ))}
          </ul>
          {prompt.value.oneShot ? (
            <p className="text-muted" data-testid="delve-object-one-shot">
              Once only.
            </p>
          ) : null}
        </>
      ) : (
        <p className="italic text-muted" data-testid="delve-object-fallback">
          {fallbackText(prompt)}
        </p>
      )}
    </div>
  );
}
