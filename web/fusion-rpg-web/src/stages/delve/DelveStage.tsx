import { useEffect, useMemo, useReducer, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { StageHost, useStageMountGuard } from "@/shell/stageHost";
import { claimStageEscape } from "@/shell/keymap";
import { useDelve } from "@/lib/bus/delve";
import { adaptDelve } from "@/contract/adapt";
import { DelveGraph } from "./graph/DelveGraph";
import { DEMO_ACTIVE_FIGHTS } from "./graph/fightFixture";
import { delveSelectionReducer, initialDelveSelection } from "./delveSelection";
import { DelveHud } from "./hud/DelveHud";
import { DelvePanelHost } from "./layers/DelvePanelHost";
import { toDelvePanelId } from "./layers/panelId";
import { ExtractionSummary } from "./summary/ExtractionSummary";
import { DEMO_EXTRACTION } from "./summary/extractionFixture";
import { useDelveReportQueue } from "./summary/reportQueue";
import firstDescent from "./fixtures/first-descent.json";

/**
 * The delve stage — `#/delve/{delveId}` (decisions.md's sixth-stage amendment, approved 2026-09-05;
 * `spec-delve-stage.md` §4). D5.1's own scope was the shell only (mount guard, the `?panel=` URL
 * contract, the Esc target); D5.4 (this pass) replaces the honest placeholder with the real room
 * graph — spec §7's band-0 stage surface: rooms, doors, gates, one-way arrows, secret dead ends,
 * party markers and the three sight treatments, `graph/DelveGraph.tsx`.
 *
 * The query param is named `panel`, not `layer` — spec §4's own literal examples
 * (`#/delve/8812?panel=pack`, `?panel=talk`, `?panel=fight`) use this module's vocabulary for its six
 * band-2 surfaces (pack, wild talk, event, object prompt, supply, fight input), not siege's board
 * "layers".
 *
 * §4 row 4 names the **WorldStage** precedent for Esc: "Esc pops one layer; on an empty stack the
 * stage claims it, and clears room selection." `claimStageEscape` is the exact mechanism
 * `WorldStage.tsx:138` already uses, mirrored via `delveSelection.ts`'s own `select-room` reducer
 * (the "room-selection state" D5.1's own doc comment named as not existing yet) — the claim's close
 * callback is a real dispatch now, not the D5.1 no-op. Unlike WorldStage, the claim stays conditional
 * on no panel being open (see the effect below) — WorldStage never cold-loads with a panel already
 * open from the URL, so it never hits the same-commit push-order race this stage's own `?panel=`
 * round trip does.
 *
 * **Live data, with the same offline fallback `WorldStage.tsx:102` already established:**
 * `useDelve(delveId)` reads `GET /api/delve/{delveId}` (D5.2/D5.3, now actually wired end to end for
 * the first time — no bus hook called it before this task). While that query has no data yet — no
 * server, a delve id the store does not have, or a non-numeric id a test route supplies — the stage
 * renders the bundled `first-descent.json` fixture instead of an empty stage, the identical
 * `live.data ?? (fixture as ...)` shape `WorldStage.tsx` uses for `firstLight`. `HandleStart`'s own
 * doc comment (`DelveEndpoints.cs:16-27`) is why a real, playable delve cannot be created through the
 * normal flow today (`dungeon_domain` is empty, so `POST /start` always refuses at group 1) — the
 * fixture fallback is not a shortcut around that, it is the only way this stage can be exercised
 * end-to-end at all until a real domain lands.
 *
 * **D5.5** adds the fight drawn in place (`graph/FightInPlace.tsx`) — `DelveGraph`'s new `fights` prop
 * is populated from `graph/fightFixture.ts`'s own demo data, gated behind this exact same
 * `live.data == null` fallback: the moment a real delve loads, the demo fight is never even
 * constructed. See that fixture's own doc comment for why this is not a wire fixture.
 *
 * **D5.6** wraps the graph in `hud/DelveHud.tsx` — band 1 (party strip, pool meters, haul, unclaimed
 * souls, quest tracker, room readout, connection state; the initiative rail once a fight prop feeds
 * it). `DelveHud`'s own `fight?: FightView` prop is deliberately left unset here, not fed from D5.5's
 * `fights`/`DEMO_ACTIVE_FIGHTS` above: that is D5.5's own internal, room-node-keyed demo shape (a
 * different, concurrently-still-changing thing), never the stable `FightView` the contract declares —
 * building against `fights` here would couple this file to in-progress work this task was told not to
 * coordinate with directly. `DelveHud` renders correctly with no fight today (the rail simply does not
 * mount) and needs no change the day a real `FightView` is threaded through, from here or anywhere else.
 *
 * **D5.7** replaces the placeholder `PanelShell` body with the real six-panel switch
 * (`layers/DelvePanelHost.tsx`) — Pack, Talk, Event, Object prompt, Supply, Fight input
 * (spec §4/§7/§14). `openPanel`'s raw query-string value is normalized through `layers/panelId.ts`'s
 * own `toDelvePanelId` **once, here**, into `panel: DelvePanelId | null` — `null` for both "no panel
 * requested" and "a `?panel=` value this build doesn't recognise". Every other use of the panel state
 * below (the escape-claim effect, `DelvePanelHost`'s own `open` flag) reads this single normalized
 * value, never the raw string — which is what makes an unrecognised value the same "nothing to show,
 * Esc still claimed by the stage" case as no `?panel=` at all, a deliberately smaller fix than adding a
 * second effect to rewrite the URL for that case (see the escape-claim effect's own comment below for
 * the push-order race a second `?panel=`-triggered effect here would risk re-opening).
 *
 * **D5.9** adds the extraction summary (band 3, `summary/ExtractionSummary.tsx`) and the band-4 report
 * queue (`summary/reportQueue.ts`). **No real trigger exists for either today, named honestly rather
 * than hidden**: `DelveEndpoints.cs` has no `extract`/`retreat` route at all (confirmed by reading it
 * in full), so there is no real "the player decided to leave" event anywhere in this codebase yet to
 * open the summary from. The two `import.meta.env.DEV`-gated controls below (the same idiom
 * `layers/system/SystemLayer.tsx` already uses for a real, shipped dev/QA switch) are consequently the
 * ONLY way to see this pair live before a real Extract/Retreat decision exists — stripped entirely from
 * a production build, never a player-visible affordance, and never wired to `devSummaryOpen` from
 * anywhere else. They exist for exactly one reason: proving in a real browser that the summary actually
 * opens at band 3 and that a report pushed while it is open actually waits, rather than trusting the
 * jsdom suite alone for behavior this codebase has already been burned by trusting blind (`FightInPlace
 * .tsx`'s own self-caught `bg-ink/50` opacity defect).
 */
export function DelveStage() {
  useStageMountGuard("delve");
  const { _ } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const panel = toDelvePanelId(searchParams.get("panel"));
  const { delveId: delveIdParam } = useParams<{ delveId: string }>();
  const numericDelveId = delveIdParam != null ? Number(delveIdParam) : NaN;

  const live = useDelve(Number.isFinite(numericDelveId) ? numericDelveId : null);
  const delve = useMemo(
    () => live.data ?? adaptDelve(firstDescent as Parameters<typeof adaptDelve>[0]),
    [live.data]
  );
  // D5.5: no live fight source exists yet (D2.16/D5.11, both still genuinely blocked, neither
  // re-litigated here) — the demo overlay only ever appears alongside the fixture fallback above,
  // never once real data exists.
  const fights = live.data ? {} : DEMO_ACTIVE_FIGHTS;

  const [selection, dispatchSelection] = useReducer(delveSelectionReducer, initialDelveSelection);
  // D5.9, dev-only preview state — see the module doc comment above for why this exists and why it is
  // the only caller of `setDevSummaryOpen`/`ExtractionSummary` anywhere in this file.
  const [devSummaryOpen, setDevSummaryOpen] = useState(false);

  // Guards a same-commit push-order race: on a cold load with `?panel=` already set (spec-delve-
  // stage.md §4: "Following any cold [load] restores the stage first, then opens the panel"),
  // PanelShell (a child) pushes its own entry in the SAME commit as this effect — and React fires
  // child effects before the parent's own (bottom-up), so an unconditional claim here would land ON
  // TOP of the panel's entry and swallow its Esc instead of letting it close (found live by
  // `DelveStage.test.tsx`'s own round-trip test, red before this guard existed). The stage only needs
  // the empty-stack fallback when nothing else is open, so it simply does not claim while a panel is
  // — the panel's own entry is independently dismissible, and the claim re-arms the instant the
  // panel closes.
  useEffect(() => {
    if (panel != null) return;
    return claimStageEscape("delve-stage", () => dispatchSelection({ type: "select-room", roomId: null }));
  }, [panel]);

  function closePanel() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("panel");
      return next;
    });
  }

  return (
    <StageHost>
      <h1 className="sr-only">{_(msg`Delve`)}</h1>
      <div className="h-full w-full" data-testid="delve-stage-frame">
        <DelveHud delve={delve} selectedRoomId={selection.selectedRoomId}>
          <DelveGraph
            delve={delve}
            selectedRoomId={selection.selectedRoomId}
            onSelectRoom={(roomId) => dispatchSelection({ type: "select-room", roomId })}
            fights={fights}
          />
        </DelveHud>
      </div>
      <DelvePanelHost
        panel={panel}
        delve={delve}
        selectedRoomId={selection.selectedRoomId}
        onClose={closePanel}
      />
      <ExtractionSummary open={devSummaryOpen} onOpenChange={setDevSummaryOpen} extraction={DEMO_EXTRACTION} />
      {import.meta.env.DEV ? (
        <div className="fixed bottom-2 left-2 flex gap-1" data-testid="delve-dev-summary-controls">
          <button
            type="button"
            className="rounded border border-border-control bg-panel px-2 py-1 text-2xs text-muted"
            data-testid="delve-dev-open-summary"
            onClick={() => setDevSummaryOpen(true)}
          >
            Preview extraction summary (dev)
          </button>
          <button
            type="button"
            className="rounded border border-border-control bg-panel px-2 py-1 text-2xs text-muted"
            data-testid="delve-dev-push-reports"
            onClick={() => {
              // Proves the "wait behind, then collapse past reveal.maxQueued" rule live: four pushes
              // while the summary is open collapse into one combined toast on close (reportQueue.ts).
              const queue = useDelveReportQueue.getState();
              queue.push({ kind: "drop", title: "Dev: found a relic" });
              queue.push({ kind: "levelUp", title: "Dev: leveled up" });
              queue.push({ kind: "join", title: "Dev: a wild creature joined" });
              queue.push({ kind: "firstClear", title: "Dev: first clear" });
            }}
          >
            Push 4 demo band-4 reports (dev)
          </button>
        </div>
      ) : null}
    </StageHost>
  );
}
