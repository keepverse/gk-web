import type { FightView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import { connectionStatusLabel } from "./connectionState";

export type InitiativeRailProps = {
  /**
   * `FightView` (spec-delve-stage.md §6/§7's HUD row: "the initiative rail during a fight"). Optional
   * and props-driven on purpose — present only while a fight is actually drawn on the room graph
   * (D5.5's own, concurrent work, band 0). **No adapter builds a `FightView` anywhere in this codebase
   * today** (`contract/types.ts`'s own doc comment: no SignalR message shape, no strike-feed DTO, no
   * live `dwell.inputWindowMs`/`afkTimeoutMs` read anywhere) — this component takes the type the
   * contract already declares and renders whatever `Pending` state each field carries, exactly the
   * "real component, no real producer yet" posture the contract layer already established for the type
   * itself. This is the connection point named in D5.6's own todo entry: whoever wires a real fight
   * session through (D5.5's own room-node expansion, or a later live-session task) passes a real
   * `FightView` into this same prop — nothing here changes to receive it.
   */
  fight?: FightView;
};

/** Renders nothing when no fight is active — the same "omit the anchor entirely" idiom
 * `stages/world/hud/WorldHud.tsx`'s own `leftEdge` already established for a conditional HUD occupant. */
export function InitiativeRail({ fight }: InitiativeRailProps) {
  if (fight == null) return null;

  return (
    <div
      className="flex items-center gap-3 rounded border border-border bg-panel px-3 py-1.5 text-2xs"
      data-testid="delve-initiative-rail"
    >
      {fight.frozen.state === "known" && fight.frozen.value ? (
        // Reuses connectionState.ts's own "frozen" copy rather than a second hardcoded literal —
        // both spots describe the identical event (three timeouts, spec §9), so one string, two
        // callers, matching this file's own "one translation table" discipline elsewhere in the
        // program (spec §8's opening line).
        <span className="font-medium text-bad" data-testid="delve-initiative-frozen">
          {connectionStatusLabel("frozen")}
        </span>
      ) : null}

      {fight.dwellRemaining.state === "known" ? (
        <span data-testid="delve-initiative-dwell">{formatMagnitude(fight.dwellRemaining.value)}</span>
      ) : (
        <span className="italic text-muted" data-testid="delve-initiative-dwell-pending">
          {fight.dwellRemaining.state === "pending" ? fight.dwellRemaining.reason : null}
        </span>
      )}

      {fight.initiative.state === "known" ? (
        // The array element type is `unknown` — no shape exists yet for one initiative slot (see the
        // module doc comment) — so this can only render turn-order SLOTS, never per-slot content.
        // The index is the only identity these elements have; there is nothing else to key on.
        <ol className="flex items-center gap-1" data-testid="delve-initiative-order">
          {fight.initiative.value.map((_, index) => (
            <li
              key={index}
              className="h-2 w-2 rounded-full bg-muted"
              data-testid={`delve-initiative-slot-${index}`}
              aria-hidden="true"
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
