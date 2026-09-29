import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { I18nProvider, useLingui } from "@lingui/react";
import { leadNameValues } from "@/i18n/leadNames";
import { i18n } from "@/i18n";
import { Button } from "@/ui";
import { useClaimOnboarding, useOnboarding } from "@/lib/bus";
import { dialogueWindowFactory } from "@/ui/story-scene/dialogueWindow";
import { nameTagFactory } from "@/ui/story-scene/nameTag";
import { advanceControlFactory, ADVANCE_EVENTS } from "@/ui/story-scene/advanceControl";
import { asSurfaceBusLike, createSurfaceBus } from "@/features/gui-lego/createSurfaceBus";

/**
 * T26 adoption: the reveal is a one-beat scene, so its heading/body/button trio renders through
 * the shared `dialogue-window` + `advance-control` pieces instead of hand-rolled markup — the same
 * pieces play every scene, so a reveal cannot fork a second grammar. What stays hand-rolled is
 * load-bearing, not trio: the loading/error shells (not a beat), the conditional commander-sheet
 * opener (navigation, no piece equivalent), and the retry button (claim-path recovery, not an ack footer).
 * `scene-progress` is deliberately never mounted (one-beat rule — `total <= 1` needs no position).
 *
 * Ownership: data and lifecycle (query, claim mutation, `onOpenCommanders`, loading/error/null
 * paths) are the first-session program's and are unchanged here; the owning spec and its suite
 * are untouched. Only presentation moved.
 *
 * Skip dismisses the block for this mount WITHOUT claiming (presentation-only local state — the
 * checkpoint stays earned-unclaimed server-side and returns on next query, exactly like a skipped
 * scene beat that saves nothing). Hiding skip is forbidden (owner decision 5), and a skip that
 * claimed would be a side effect disguised as dismissal.
 *
 * Copy is lingui `msg` descriptors resolved here and passed to the pieces as plain strings —
 * pieces stay translation-free, the same shape as the scene fold.
 */
const REVEAL_KICKER = msg({ id: "onboarding.reveal.kicker", message: "New milestone" });
const REVEAL_TITLE_DAVE = msg({
  id: "onboarding.reveal.title.dave",
  message:
    "{lead_summoner_article, select, definite {The } other {}}{lead_summoner} joins your side"
});
const REVEAL_TITLE_SPECIES = msg({ id: "onboarding.reveal.title.species", message: "Your empire is learning" });
const REVEAL_TITLE_GEAR = msg({
  id: "onboarding.reveal.title.gear",
  message:
    "{lead_summoner_article, select, definite {The } other {}}{lead_summoner} found a first piece of gear"
});
const REVEAL_TITLE_FALLBACK = msg({ id: "onboarding.reveal.title.fallback", message: "Progress unlocked" });
const REVEAL_BODY_SPECIES = msg({
  id: "onboarding.reveal.body.species",
  message: "Every ordinary creature in this lawn run now benefits from your empire’s species progression."
});
const REVEAL_BODY_DEFAULT = msg({
  id: "onboarding.reveal.body.default",
  message: "This reward is saved automatically and is ready on your commander sheet."
});
const REVEAL_ACK = msg({ id: "onboarding.reveal.ack", message: "Got it" });
const REVEAL_SAVING = msg({ id: "onboarding.reveal.saving", message: "Saving…" });
const REVEAL_SAVING_TITLE = msg({ id: "onboarding.reveal.saving.title", message: "Saving reward…" });
const REVEAL_ACK_TITLE = msg({ id: "onboarding.reveal.ack.title", message: "Acknowledge this reward" });
const REVEAL_SKIP = msg({ id: "onboarding.reveal.skip", message: "Skip" });
const REVEAL_OPEN_SHEET = msg({
  id: "onboarding.reveal.open.sheet",
  message:
    "Open {lead_summoner_article, select, definite {the } other {}}{lead_summoner}’s sheet"
});
const REVEAL_LOADING = msg({ id: "onboarding.reveal.loading", message: "Loading your first rewards…" });
const REVEAL_ERROR = msg({ id: "onboarding.reveal.error", message: "We couldn’t load your first rewards." });
const REVEAL_RETRY = msg({ id: "onboarding.reveal.retry", message: "Retry" });

const REVEAL_TITLES: Record<string, typeof REVEAL_TITLE_DAVE> = {
  "first-win-dave": REVEAL_TITLE_DAVE,
  "level-3-general-species": REVEAL_TITLE_SPECIES,
  "level-4-dave-equipment": REVEAL_TITLE_GEAR
};

type RevealBusEvent = typeof ADVANCE_EVENTS.advance | typeof ADVANCE_EVENTS.skip;

export function OnboardingReveal({ playerId, onOpenCommanders }: { playerId: number; onOpenCommanders: () => void }) {
  // Self-sufficient i18n boundary: the component resolves its own `msg` copy through the shared
  // singleton, so it renders identically inside the app provider and inside provider-less harnesses
  // (the owning suite renders bare). Same instance either way — a nested provider over the app's
  // own changes nothing.
  return (
    <I18nProvider i18n={i18n}>
      <RevealBody playerId={playerId} onOpenCommanders={onOpenCommanders} />
    </I18nProvider>
  );
}

function RevealBody({ playerId, onOpenCommanders }: { playerId: number; onOpenCommanders: () => void }) {
  const { i18n: lingui } = useLingui();
  const query = useOnboarding(playerId);
  const claim = useClaimOnboarding(playerId);
  const bus = useMemo(() => createSurfaceBus<RevealBusEvent>(), []);
  const busLike = useMemo(() => asSurfaceBusLike(bus), [bus]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const current = useMemo(
    () => query.data?.checkpoints.find((row) => row.state === "earned" && !row.claimedUtc),
    [query.data]
  );

  // Pieces emit; the reveal acts. Advance claims (the same mutation as before); skip dismisses
  // locally (see the module note — server state untouched).
  useEffect(() => {
    const offAdvance = bus.on(ADVANCE_EVENTS.advance, () => {
      if (current) void claim.mutateAsync(current.checkpointId);
    });
    const offSkip = bus.on(ADVANCE_EVENTS.skip, () => {
      if (current) setDismissedId(current.checkpointId);
    });
    return () => {
      offAdvance();
      offSkip();
    };
  }, [bus, claim, current]);

  if (query.isLoading) return <div className="mb-4 rounded-md border border-panel bg-panel p-4" data-testid="onboarding-loading">{lingui._(REVEAL_LOADING)}</div>;
  if (query.isError) return <div className="mb-4 rounded-md border border-bad bg-panel p-4" data-testid="onboarding-error"><p>{lingui._(REVEAL_ERROR)}</p><Button size="sm" className="mt-2" onClick={() => void query.refetch()}>{lingui._(REVEAL_RETRY)}</Button></div>;
  if (!current) return null;
  if (dismissedId !== null && dismissedId === current.checkpointId) return null;

  const isDave = current.checkpointId === "first-win-dave" || current.checkpointId === "level-4-dave-equipment";
  // `_(id, values)` is lingui's typed interpolation overload; the descriptor still owns the id, so a
  // renamed id flows through both the catalog and this call.
  const titleDescriptor = REVEAL_TITLES[current.checkpointId] ?? REVEAL_TITLE_FALLBACK;
  const title = lingui._(titleDescriptor.id, leadNameValues());
  const body = lingui._(
    current.checkpointId === "level-3-general-species" ? REVEAL_BODY_SPECIES : REVEAL_BODY_DEFAULT
  );
  return (
    <div className="mb-4 max-w-[46rem] rounded-md border border-ok bg-panel p-4 shadow-lg" data-testid="onboarding-reveal">
      {dialogueWindowFactory({
        payload: {
          piece: "dialogue-window",
          instanceId: "reveal:window",
          phase: "ready",
          line: title,
          teaching: body,
          narration: false
        },
        slots: {
          nameTag: nameTagFactory({
            payload: {
              piece: "name-tag",
              instanceId: "reveal:name-tag",
              phase: "ready",
              displayName: lingui._(REVEAL_KICKER)
            },
            slots: {},
            bus: busLike
          })
        },
        bus: busLike
      })}
      {advanceControlFactory({
        payload: {
          piece: "advance-control",
          instanceId: "reveal:advance",
          phase: "ready",
          isLastBeat: true,
          nextLabel: "",
          finalLabel: lingui._(REVEAL_ACK),
          skipLabel: lingui._(REVEAL_SKIP),
          pendingLabel: lingui._(REVEAL_SAVING),
          pending: claim.isPending,
          primaryTitle: lingui._(REVEAL_ACK_TITLE),
          pendingTitle: lingui._(REVEAL_SAVING_TITLE)
        },
        slots: {},
        bus: busLike
      })}
      {isDave ? <Button size="sm" variant="ghost" onClick={onOpenCommanders}>{lingui._(REVEAL_OPEN_SHEET.id, leadNameValues())}</Button> : null}
    </div>
  );
}
