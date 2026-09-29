import type { Pending } from "@/contract/pending";
import type { TalkView } from "@/contract/types";
import { wildVerbLabel } from "@/stages/delve/labels";

function fallbackText(talk: Pending<TalkView>): string {
  // `absent` covers two real states this component collapses to one honest phrase, on purpose: no room
  // is selected at all, and a selected room that genuinely is not a wild room (`DelvePanelHost.tsx`'s
  // own `talkForRoom` decides which, from the real `RoomView.kind`/`.resolvedKind`) — both are
  // genuinely "nothing here", not "wait for it", so `absent()` is correct for both per `Pending<T>`'s
  // own doc comment, and one phrase fairly describes either.
  return talk.state === "pending" ? talk.reason : "There's no one to talk to here.";
}

export type TalkPanelProps = {
  /**
   * A presentation-level wrapper `DelvePanelHost.tsx` builds, not a contract field —
   * `TalkView.offered` is real but nothing on `RoomView`/`DelveView` ties a `TalkView` instance to a
   * room today (confirmed: no field anywhere carries one), so "is there a talk to have here at all" has
   * no contract-level home the way `PartyView.pack: Pending<PackView>` already gives Pack. Wrapping the
   * whole view here, at the prop boundary, is the same move `ObjectPromptPanel`/`SupplyPanel` make for
   * the identical reason — see either's own doc comment.
   */
  talk: Pending<TalkView>;
};

/**
 * Band-2 Wild talk panel (D5.7, spec-delve-stage.md §7: "verbs, the band as a name, the quote, the
 * offer"). Wild-room-scoped per that same row and `TalkTree.Offered`'s own real output
 * (`TalkView`'s doc comment) — `DelvePanelHost.tsx` only ever supplies a `pending` value when the
 * selected room's own kind is `"wild"`, `absent()` otherwise.
 *
 * Renders `offered` — the one real field this type carries (`TalkView`'s own doc comment:
 * "`TalkTree.Step`/`TalkStep`... does not exist" for every other field) — through `labels.ts`'s own
 * `wildVerbLabel`, never the raw `WildVerb` id. `effectiveBand`/`quote`/`decision` are each
 * individually `Pending` on the type itself and stay unrendered here: no caller in this codebase has
 * ever produced a `known` `TalkView` at all (confirmed by reading `contract/adapt.ts`'s own
 * `adaptTalk` call sites — there are none), so there is nothing to honestly show for them yet, and
 * showing three more copies of the same one pending reason would only repeat this panel's own single
 * top-level fallback for no reader benefit.
 */
export function TalkPanel({ talk }: TalkPanelProps) {
  return (
    <div data-testid="delve-panel-talk" className="flex flex-col gap-2 text-2xs">
      {talk.state === "known" ? (
        <ul className="flex flex-wrap gap-1" data-testid="delve-talk-verbs">
          {talk.value.offered.map((verb, i) => (
            <li
              key={`${verb}-${i}`}
              data-testid={`delve-talk-verb-${verb}`}
              className="rounded-pill border border-border-control px-2 py-0.5"
            >
              {wildVerbLabel(verb)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="italic text-muted" data-testid="delve-talk-fallback">
          {fallbackText(talk)}
        </p>
      )}
    </div>
  );
}
