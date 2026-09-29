/**
 * The live-session connection state (D5.6, spec-delve-stage.md §7's band-1 HUD row: "...the initiative
 * rail during a fight, connection state"). §9's own event table names the real states a live SignalR
 * session moves through — subscribed and live; reconnecting after a drop; **frozen**, after three
 * consecutive dwell timeouts, which the table says must "say so": *"Your band is waiting."* (§9's own
 * literal quoted copy, reused here verbatim, not reworded) — and a resume that "replays the recorded
 * prefix, then goes live" again.
 *
 * **This module is deliberately NOT `Pending<T>`-shaped** — unchanged by D5.11's 2026-09-08 live-push
 * wave, but the REASON is now narrower, not "no producer exists yet." `Pending<T>` models a WIRE
 * SNAPSHOT field with no adapter wired to it yet (`FightView`, `MemberView.nerveStage`,
 * `DelveView.quests`, …) — every one of those types is declared in `contract/types.ts` because a
 * concrete C# producer exists somewhere and the missing piece is a route or a mapping.
 *
 * A real producer for a live delve fight's session state now DOES exist end to end:
 * `DelveBattleSession`'s own hooks (`onDeclared`/`onFrozen`/`onTurnStarted`,
 * `gk-core/src/FusionRpg.Server/DelveBattleSession.cs`) push real SignalR messages
 * (`gk-core/src/FusionRpg.Server/DelveLivePush.cs`'s `DelveLiveEventNames`), `stages/delve/liveSession.ts`
 * subscribes to them, and `session.ts`'s `sessionReducer` folds them into exactly this status. But
 * `DelveConnectionStatus` is the OUTPUT of that live reducer, not a field on any fetched DTO — there is
 * no `GET` snapshot this value could ever be "pending" inside, because it only exists while a live
 * session is actually running, computed by folding a stream of events rather than read from a document.
 * Modelling it as `Pending<ConnectionStateView>` would still misstate the shape — not "the server has
 * this, nobody read it yet" (true once, no longer) but "this is derived client state, not a snapshot
 * field, regardless of whether a producer exists." A plain, local, presentation-only status type stays
 * the honest shape: a real, tested display component fed by `sessionReducer`'s own output, with no
 * contract-layer claim about a REST snapshot field that was never the right frame for it.
 */
export type DelveConnectionStatus = "live" | "reconnecting" | "frozen" | "offline";

/**
 * Every branch here is real player copy, not a placeholder — `"frozen"` reuses spec-delve-stage.md
 * §9's own quoted sentence exactly. `"offline"` is today's actual, honest default (see
 * `DelveHud.tsx`'s own doc comment): no live session has ever been opened, so nothing here is lying by
 * calling itself "Live" when no subscription exists.
 */
export function connectionStatusLabel(status: DelveConnectionStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting…";
    case "frozen":
      return "Your band is waiting.";
    case "offline":
      return "Not connected";
    default: {
      const exhaustive: never = status;
      throw new Error(`connectionStatusLabel: unhandled status ${String(exhaustive)}`);
    }
  }
}
