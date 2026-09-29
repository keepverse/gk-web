import { pendingWithReason, type Pending } from "@/contract/pending";
import type { FightView } from "@/contract/types";
import { PLAYER_PENDING } from "@/contract/adapt";
import { formatMagnitude } from "@/i18n/magnitude";

/** Same shape as `graph/FightInPlace.tsx`'s own private `fallbackNote` — `absent` has no real producer
 * that would ever choose it here (every field is `pendingWithReason(...)` above), handled anyway so an
 * unexpected `absent` renders honestly rather than failing a type check on a missing `.reason`. */
function fallbackNote(p: Pending<unknown>): string {
  return p.state === "pending" ? p.reason : "Nothing to show.";
}

/**
 * Every field genuinely pending, always — not room-scoped or party-scoped at all, unlike the other
 * three room-scoped panels. `FightView`'s own doc comment: no SignalR message shape for a live delve
 * fight exists anywhere (`RpgHub.cs` carries zero delve/battle-session messages), so there is no
 * `known` branch this panel could ever honestly reach, with any input. §9's own session client (D5.11)
 * and its server half (D2.16) are both still genuinely unbuilt — `graph/FightInPlace.tsx`'s own doc
 * comment already names both, and this panel inherits the identical gap for its own input half.
 *
 * Deliberately does **not** reuse `graph/fightFixture.ts`'s own `DEMO_ACTIVE_FIGHTS` — that data is
 * "D5.5's own internal, room-node-keyed demo shape," and `DelveHud`'s own doc comment already declined
 * to feed it into a *different* real `FightView` consumer (`DelveHud`'s `fight` prop) for exactly this
 * reason: "building against `fights` here would couple this file to in-progress work this task was
 * told not to coordinate with directly." The identical reasoning applies here.
 */
const PENDING_FIGHT: FightView = {
  dwellRemaining: pendingWithReason(PLAYER_PENDING.delveFightControls),
  initiative: pendingWithReason(PLAYER_PENDING.delveFightControls),
  strikeFeed: pendingWithReason(PLAYER_PENDING.delveFightControls),
  frozen: pendingWithReason(PLAYER_PENDING.delveFightControls)
};

/**
 * Band-2 Fight input panel (D5.7, spec-delve-stage.md §7: "the steered party's input surface:
 * initiative detail, action chooser, target picker"). The fight itself stays drawn on the stage
 * (`graph/FightInPlace.tsx`, band 0) — this panel is only ever the input half, per §7's own split:
 * "The **input** surface is a panel; the fight stays on the stage." Closing this panel is never a
 * retreat and never pauses anything (§9's own row) — this component has no close-time side effect of
 * its own; `DelvePanelHost.tsx`'s shared `onClose` already only clears the query param.
 *
 * Mirrors `FightInPlace.tsx`'s own per-field honesty for the one field with a real unit
 * (`dwellRemaining`, `milliseconds`) rather than repeating the same "not shown yet" line for every
 * field — the action-chooser/target-picker half (`initiative` standing in for "the chooser", the only
 * real order-implying field the type carries, the identical reading `FightInPlace.tsx` already
 * documents) gets its own single line instead.
 */
export function FightInputPanel() {
  return (
    <div data-testid="delve-panel-fight" className="flex flex-col gap-1 text-2xs">
      {PENDING_FIGHT.frozen.state === "known" && PENDING_FIGHT.frozen.value ? (
        <p data-testid="delve-fight-input-frozen" className="font-semibold text-bad">
          Your band is waiting.
        </p>
      ) : null}
      <p className="text-muted" data-testid="delve-fight-input-dwell">
        {PENDING_FIGHT.dwellRemaining.state === "known"
          ? formatMagnitude(PENDING_FIGHT.dwellRemaining.value)
          : fallbackNote(PENDING_FIGHT.dwellRemaining)}
      </p>
      <p className="italic text-muted" data-testid="delve-fight-input-chooser">
        {fallbackNote(PENDING_FIGHT.initiative)}
      </p>
    </div>
  );
}
