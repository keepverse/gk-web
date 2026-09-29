import { useEffect, useState } from "react";
import type { FightView } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";
import { cn } from "@/lib/cn";

/**
 * One room's active fight, precomputed by the caller (D5.5, spec-delve-stage.md §7: "the room node
 * expands in place; enemies, ranks and the strike feed animate there" — `decisions.md:114`: "a fight
 * is drawn on it"). Kept out of `RoomNode`/`DelveGraph` themselves so both stay a pure function of the
 * real contract type plus one boolean — the identical "precomputed by the caller" posture
 * `RoomNode.tsx`'s own `secretDeadEnd` prop already documents.
 */
export type RoomFightState = {
  /** The real `FightView` (D5.3, `contract/types.ts`) — every field `Pending` until a live producer
   * exists (D2.16's own still-unbuilt `DelveBattleEndpoints.cs`/`RpgHub` surface; D5.11's own
   * still-unbuilt session client). Rendered honestly here: `known` shows the real figure, `pending`
   * shows its own real reason — the same idiom `LoamFigure.tsx` already established for a
   * `Pending<Magnitude>`, applied to every field on this type instead of just one. */
  fight: FightView;
  /**
   * Whether this room's fight is the viewer's own currently-steered party (spec §9: "an un-steered
   * party gets a read-only feed on its room node, no chooser"). **Named gap, not guessed**: `PartyView`
   * carries no such field on the wire today — confirmed by reading `contract/types.ts` in full, and
   * independently by grep (`steered`/`autopilot` appear nowhere under `src/`). This is a
   * presentation-only flag the caller must supply until a real session concept exists to derive it
   * from — D5.11's own scope, not this component's.
   */
  steered: boolean;
};

export type FightInPlaceProps = {
  fight: FightView;
  steered: boolean;
};

function fallbackNote(p: Pending<unknown>): string {
  // `absent` has no real producer that would ever choose it for one of these four fields today (every
  // field was declared `Pending` specifically *because* no producer exists yet, not because a value
  // is legitimately inapplicable) — handled anyway so an unexpected `absent` renders honestly rather
  // than crashing.
  return p.state === "pending" ? p.reason : "Nothing to show.";
}

/** One strike-feed row. Enters via a real, dependency-free mount transition (no invented per-entry
 * content — see the module doc comment) — `requestAnimationFrame` defers the class flip past first
 * paint so the browser actually animates the change instead of coalescing it into the initial layout.
 * The transition's own *presence* is confirmed live (a jsdom render has no layout/paint to observe);
 * `FightInPlace.test.tsx` confirms the row exists and is inert, not its motion. */
function FeedEntry({ index }: { index: number }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      data-testid="delve-fight-strike-feed-entry"
      data-index={index}
      aria-hidden="true"
      className={cn(
        // `bg-ink/50` — real live bug, self-caught by this task's own required browser check: the
        // `ink` token's CSS custom property is not defined in the alpha-composable form Tailwind's
        // opacity-modifier syntax needs (unlike `bad`, which already supports `bg-bad/10` elsewhere in
        // this tree, `ui/Badge.tsx`), so `bg-ink/50` computed to `rgba(0, 0, 0, 0)` — fully transparent
        // — confirmed via `getComputedStyle` against the live page, not guessed from the class name.
        // `bg-text` is solid (no alpha modifier needed) and already proven visible elsewhere in this
        // exact file tree (`RoomNode.tsx`'s own `text-text`).
        "h-1.5 w-full rounded-full bg-text/60 transition-all duration-[180ms] ease-out",
        entered ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      )}
    />
  );
}

/**
 * The fight, drawn on the room it is in (D5.5). Rendered by `RoomNode.tsx` *inside* the room's own
 * expanded `<button>` — never a separate screen, never a route change, never mounted outside the room
 * graph's own DOM subtree (spec §7: "Not a separate screen, not a stage change").
 *
 * **Zero interactive elements, always.** Spec §7's own split is explicit: "The **input** surface is a
 * panel; the fight stays on the stage" — the chooser is band-2's Fight panel (D5.7), never band-0.
 * `steered` changes only a passive visual accent here (`data-steered`), never a control —
 * `FightInPlace.test.tsx` sweeps both values and asserts zero `button`/`a[href]`/`input`/`select`/
 * `textarea` descendants either way, which is what makes "an un-steered party's room shows a read-only
 * feed with no chooser" true of the steered case too, not merely asserted for the automated one.
 *
 * **`enemies` — named, not built, not guessed at.** No field anywhere — not even a `Pending`
 * placeholder — carries an enemy roster or distinguishes an enemy actor from an ally inside
 * `initiative`/`strikeFeed`. Confirmed by a dedicated search, not assumed: `FightView`'s own doc
 * comment (`contract/types.ts:1258-1267`) states no SignalR message shape or strike-feed DTO exists
 * anywhere; "strike feed" itself appears exactly once in any spec (`spec-delve-stage.md:139`) with no
 * further elaboration, and `spec-delve-battle-profile.md` — the session spec this stage "consumes
 * whole" (§9) — never uses the term at all (grep-confirmed). D5.3's own research pass reached the
 * identical conclusion for the identical reason when it declined to build `adaptFight`: composing a
 * shape here would mean inventing the missing session message this layer cannot decide on its own.
 * This component honours that refusal one layer up — it reads `initiative`/`strikeFeed` by **length
 * only**, never a per-entry shape, so it can animate a real count without asserting a fabricated
 * roster or invented per-hit text.
 *
 * **`initiative` is read as "ranks."** `FightView` has no separate ranks field; `initiative` is the
 * only real, order-implying array it carries, so this component reads it as the closest honest source
 * for "ranks... animate there." A documented judgment call, not a confirmed fact — the same posture
 * `contract/adapt.ts`'s own `adaptTalk` already takes for its `WildVerb`-ordinal choice.
 */
export function FightInPlace({ fight, steered }: FightInPlaceProps) {
  return (
    <div data-testid="delve-room-fight" data-steered={steered} className="mt-1 flex w-full flex-col gap-1.5 text-left">
      {fight.frozen.state === "known" && fight.frozen.value ? (
        <p data-testid="delve-fight-frozen" className="text-[10px] font-semibold text-bad">
          Your band is waiting.
        </p>
      ) : null}

      <p data-testid="delve-fight-dwell" className="text-[10px] text-muted">
        {fight.dwellRemaining.state === "known" ? formatMagnitude(fight.dwellRemaining.value) : fallbackNote(fight.dwellRemaining)}
      </p>

      <div data-testid="delve-fight-ranks" className="flex min-h-[8px] gap-1" aria-hidden="true">
        {fight.initiative.state === "known" ? (
          fight.initiative.value.map((_, i) => (
            <span
              key={i}
              data-testid="delve-fight-rank"
              // Same `ink`-token defect as the strike-feed entries below (see that one's own comment)
              // — `bg-text/80` instead, real and visible.
              className={cn("h-2 w-2 rounded-full bg-text/80", i === 0 && "animate-pulse")}
            />
          ))
        ) : (
          <span className="text-[10px] text-muted">{fallbackNote(fight.initiative)}</span>
        )}
      </div>

      <div data-testid="delve-fight-strike-feed" className="flex flex-col gap-1">
        {fight.strikeFeed.state === "known" ? (
          fight.strikeFeed.value.map((_, i) => <FeedEntry key={i} index={i} />)
        ) : (
          <span className="text-[10px] text-muted">{fallbackNote(fight.strikeFeed)}</span>
        )}
      </div>
    </div>
  );
}
