import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreatureRoster, useOnboarding, usePlayers, useRelics, useRuns, useSoulBalance, useSpeciesIndex, useUniqueActors } from "@/lib/bus";
import { useContracts } from "@/lib/bus/contracts";
import { conditionOf } from "@/features/creatures/contractView";
import { displayName } from "@/features/creatures/rosterSplit";
import { adaptActor, PLAYER_PENDING } from "@/contract/adapt";
import { pendingWithReason } from "@/contract/pending";
import { RIFT_PROLOGUE_TRIGGER, isSceneEligible } from "@/features/story-scene/sceneTrigger";
import { registerGlobalVerb } from "@/shell/keymap";
import { ChunkFallback } from "@/shell/ChunkFallback";
import { StageHost, useStageMountGuard } from "@/shell/stageHost";
import { Rail } from "@/shell/Rail";
import { deriveRailEntries, type RailEntry, type RailUnlockInputs } from "@/shell/railState";
import { useExpeditionReturnWatcher } from "@/layers/expeditions/expeditionReturnWatcher";
import { currentBindings, KEYBINDINGS_CHANGED_EVENT, type BindableActionId } from "@/layers/system/keybindings";
import type { ActorRungState } from "@/ui/actor";
import { FocusCard } from "./FocusCard";
import { SanctumHome } from "./SanctumHome";
import { SanctumHud } from "./SanctumHud";
import { OnboardingReveal } from "./OnboardingReveal";
import { RiftPrologueDialog } from "@/features/onboarding/RiftPrologueDialog";

// GG-38's `layer-collection` / `layer-world` / `layer-reference` chunks (tech-stack.md §6): each
// layer's real weight (a wrapped page, in most cases) loads once it's opened for the first time,
// not on every Sanctum visit — see `mountedLayers` below for the "opened once, stays mounted"
// gating that gives lazy() something to defer in the first place.
const CreaturesLayer = lazy(() =>
  import("@/layers/creatures/CreaturesLayer").then((m) => ({ default: m.CreaturesLayer }))
);
const RelicsLayer = lazy(() => import("@/layers/relics/RelicsLayer").then((m) => ({ default: m.RelicsLayer })));
const FusionLayer = lazy(() => import("@/layers/fusion/FusionLayer").then((m) => ({ default: m.FusionLayer })));
const ExpeditionsLayer = lazy(() =>
  import("@/layers/expeditions/ExpeditionsLayer").then((m) => ({ default: m.ExpeditionsLayer }))
);
const PactsLayer = lazy(() => import("@/layers/pacts/PactsLayer").then((m) => ({ default: m.PactsLayer })));
const AlmanacLayer = lazy(() => import("@/layers/almanac/AlmanacLayer").then((m) => ({ default: m.AlmanacLayer })));
const ChronicleLayer = lazy(() =>
  import("@/layers/chronicle/ChronicleLayer").then((m) => ({ default: m.ChronicleLayer }))
);
const CommandersLayer = lazy(() =>
  import("@/layers/commanders/CommandersLayer").then((m) => ({ default: m.CommandersLayer }))
);
// D5.8 — the descent door's own picker (spec-delve-stage.md §4: "the descent door is a Sanctum
// affordance … opening the picker as a band-2 layer with no rail row and no key"). Deliberately NOT
// one of the seven `RailLayerId` chunks above: it has no rail icon and no rebindable key, so it is
// lazy-loaded and mounted the same way every other layer here is, but opened through its own
// independent piece of state (`delvePickerOpen` below), never through `openLayer`/`openLayerById`.
const DelvePickerLayer = lazy(() =>
  import("@/layers/delve/DelvePickerLayer").then((m) => ({ default: m.DelvePickerLayer }))
);

/** T20 (GG-20): every rail entry is a rebindable action, so this reads the live table instead of
 * a hardcoded key literal — `useKeybindingsVersion` below forces a re-read after any rebind. */
function useKeybindingsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
  }, []);
  return version;
}

/**
 * The home stage (band 0) — information-architecture.md §2.1. Everything a
 * session with no run in progress lives on, and where every run returns.
 * Open layers live in the URL (`?panel=&sel=`, GG-8) so a deep link restores
 * the stage first, then the layer over it, cold.
 */
export function SanctumStage() {
  useStageMountGuard("sanctum");
  const navigate = useNavigate();
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 1;

  const actorsQuery = useUniqueActors(playerId);
  const runsQuery = useRuns();
  const contractsQuery = useContracts(playerId);
  const soulsQuery = useSoulBalance(playerId);
  const onboardingQuery = useOnboarding(playerId);

  const [searchParams, setSearchParams] = useSearchParams();
  const openLayer = searchParams.get("panel") as Exclude<RailEntry["id"], "sanctum"> | null;
  const selectedId = searchParams.get("sel");
  const riftStory = onboardingQuery.data?.stories.find((story) => story.storyId === "rift-prologue" && story.version === 1);
  // The same eligibility the inline expression below used to compute, read through the named
  // `scene-trigger` seam so a second scene has a home for its trigger (owner decision N3). The
  // server remains the authority: `isSceneEligible` only ever narrows its `eligible` flag.
  const riftEligible = isSceneEligible(
    RIFT_PROLOGUE_TRIGGER,
    onboardingQuery.data?.stories ?? [],
    { noLayerOpen: openLayer === null }
  );
  const [riftOpen, setRiftOpen] = useState(false);
  useEffect(() => {
    if (riftEligible) setRiftOpen(true);
  }, [riftEligible]);

  // A layer mounts (and its chunk fetches) the first time it's opened — via a click or a cold
  // deep-link — and then stays mounted across a later close, matching every layer's existing
  // "open toggles visibility, not existence" contract (PanelShell's own push/pop only fires while
  // `open` is true). Without this, `React.lazy` alone would still fetch all seven chunks on the
  // very first Sanctum render, since every layer below is unconditionally rendered with `open`
  // simply false — the mount itself, not just the code-splitting, has to be deferred.
  const [mountedLayers, setMountedLayers] = useState<Set<string>>(() => (openLayer ? new Set([openLayer]) : new Set()));
  useEffect(() => {
    if (openLayer && !mountedLayers.has(openLayer)) {
      setMountedLayers((prev) => new Set(prev).add(openLayer));
    }
  }, [openLayer, mountedLayers]);

  function openLayerById(id: Exclude<RailEntry["id"], "sanctum">) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("panel", id);
      return next;
    });
  }
  // Same `?system=1` flag `SystemHost.tsx` (T20) already reads globally — no new plumbing needed,
  // just the HUD's own long-disabled Menu button finally pointing at the layer that now exists.
  function openSystem() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("system", "1");
      return next;
    });
  }
  function closeLayer() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("panel");
      next.delete("sel");
      return next;
    });
  }
  function selectCreature(instanceId: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (instanceId) next.set("sel", instanceId);
      else next.delete("sel");
      return next;
    });
  }
  function selectCommander(commanderId: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (commanderId) next.set("sel", commanderId);
      else next.delete("sel");
      return next;
    });
  }

  // D5.8 — the descent door's own open state. A separate query param from `panel` (not a
  // `RailEntry["id"]`, never opened via `openLayerById`) so it never grows the rail or claims a
  // rebindable key — but still rides the URL (GG-8), matching every other layer's own "deep link
  // restores the stage first, then the layer" contract this component's own doc comment states above.
  const delvePickerOpen = searchParams.get("delve-picker") === "1";
  function openDelvePicker() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("delve-picker", "1");
      return next;
    });
  }
  function closeDelvePicker() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("delve-picker");
      return next;
    });
  }
  const [delvePickerMounted, setDelvePickerMounted] = useState(() => delvePickerOpen);
  useEffect(() => {
    if (delvePickerOpen && !delvePickerMounted) setDelvePickerMounted(true);
  }, [delvePickerOpen, delvePickerMounted]);

  const keybindingsVersion = useKeybindingsVersion();
  const layerKeys = currentBindings();

  const actors = actorsQuery.data?.items ?? [];
  const relicsQuery = useRelics();
  const creatureRosterQuery = useCreatureRoster(playerId);
  const speciesById = useSpeciesIndex();
  const { returnedCount } = useExpeditionReturnWatcher(playerId);

  // T26's priority banner needs the same "which pact is overdue, and what's its real name"
  // resolution `PactsLayer.tsx` already does — reused here rather than re-derived differently.
  const bySpecimenId = new Map((creatureRosterQuery.data?.items ?? []).map((s) => [s.profile.instanceId, s]));
  const overdueContractRow = (contractsQuery.data?.contracts ?? []).find((c) => conditionOf(c) === "insubordinate");
  const overdueContract = overdueContractRow
    ? (() => {
        const specimen = bySpecimenId.get(overdueContractRow.instanceId);
        const species = specimen ? speciesById.get(specimen.profile.speciesId) : undefined;
        return {
          instanceId: overdueContractRow.instanceId,
          name: specimen ? displayName(specimen, species?.name) : overdueContractRow.instanceId
        };
      })()
    : undefined;
  const railInputs: RailUnlockInputs = {
    currentStageId: "sanctum",
    hasCompletedARun: (runsQuery.data?.length ?? 0) > 0,
    hasAnyCreature: (creatureRosterQuery.data?.items.length ?? 0) > 0,
    hasAnyContract: (contractsQuery.data?.contracts.length ?? 0) > 0,
    hasAnyRelic: (relicsQuery.data?.items.length ?? 0) > 0,
    hasAnyBoundCreature: (contractsQuery.data?.contracts.some((c) => c.bound) ?? false),
    returnedExpeditionCount: returnedCount,
    unreadResultCount: 0 // no "unread results" concept exists server-side yet
  };
  const railEntries = deriveRailEntries(railInputs);

  // One global verb per unlocked layer (information-architecture.md §5); pressing an open
  // layer's key closes it. Re-registers if the unlock set changes (e.g. a layer just unlocked).
  useEffect(() => {
    const unregisters = railEntries
      .filter((e): e is RailEntry & { id: Exclude<RailEntry["id"], "sanctum"> } => e.id !== "sanctum" && e.state !== "locked")
      .map((entry) =>
        registerGlobalVerb(layerKeys[entry.id as BindableActionId], `sanctum-rail-${entry.id}`, () => {
          if (openLayer === entry.id) closeLayer();
          else openLayerById(entry.id);
        })
      );
    return () => unregisters.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railEntries.map((e) => e.state).join(","), openLayer, keybindingsVersion]);

  const firstActorState: ActorRungState | null =
    actors.length > 0 ? { kind: "ready", data: adaptActor(actors[0]!) } : null;

  return (
    <StageHost>
      <SanctumHud
        playerName={players.data?.items.find((p) => p.id === playerId)?.name ?? "Summoner"}
        soulsBalance={soulsQuery.data?.balance ?? 0}
        summonerLevel={pendingWithReason(PLAYER_PENDING.summonerLevel)}
        unreadResultCount={railInputs.unreadResultCount}
        onOpenSystem={openSystem}
      />
      <div className="flex items-start" data-testid="sanctum-frame">
        <Rail entries={railEntries} onSelect={(id) => id !== "sanctum" && openLayerById(id)} />

        <div className="mx-auto w-full min-w-0 max-w-[1100px] flex-1 p-5" data-testid="sanctum-body">
          <OnboardingReveal playerId={playerId} onOpenCommanders={() => openLayerById("commanders")} />
          <FocusCard
            actorCount={actors.length}
            firstActor={firstActorState}
            showFirstUserGuide={riftStory?.state === "acknowledged"}
            overdueContract={overdueContract}
            returnedExpeditionCount={returnedCount}
            onOpenCreatures={() => openLayerById("creatures")}
            onOpenPacts={() => openLayerById("pacts")}
            onOpenExpeditions={() => openLayerById("expeditions")}
          />
          {actors.length > 0 ? (
            <SanctumHome
              playerId={playerId}
              actorStates={actors.map((a): ActorRungState => ({ kind: "ready", data: adaptActor(a) }))}
              onOpenCreatures={() => openLayerById("creatures")}
              onOpenCommanders={() => openLayerById("commanders")}
              returnedExpeditionCount={returnedCount}
              onOpenExpeditions={() => openLayerById("expeditions")}
              onOpenDelvePicker={openDelvePicker}
            />
          ) : null}
        </div>
      </div>

      <RiftPrologueDialog
        open={riftOpen}
        playerId={playerId}
        onClose={() => setRiftOpen(false)}
        onContinueToLawn={() => navigate("/lawn")}
      />

      {mountedLayers.has("creatures") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-creatures" />}>
          <CreaturesLayer
            open={openLayer === "creatures"}
            onOpenChange={(open) => !open && closeLayer()}
            playerId={playerId}
            selectedId={openLayer === "creatures" ? selectedId : null}
            onSelect={selectCreature}
          />
        </Suspense>
      ) : null}

      {mountedLayers.has("commanders") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-commanders" />}>
          <CommandersLayer
            open={openLayer === "commanders"}
            onOpenChange={(open) => !open && closeLayer()}
            playerId={playerId}
            selectedId={openLayer === "commanders" ? selectedId : null}
            onSelect={selectCommander}
          />
        </Suspense>
      ) : null}

      {mountedLayers.has("relics") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-relics" />}>
          <RelicsLayer open={openLayer === "relics"} onOpenChange={(open) => !open && closeLayer()} playerId={playerId} />
        </Suspense>
      ) : null}

      {mountedLayers.has("fusion") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-fusion" />}>
          <FusionLayer open={openLayer === "fusion"} onOpenChange={(open) => !open && closeLayer()} />
        </Suspense>
      ) : null}

      {mountedLayers.has("expeditions") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-expeditions" />}>
          <ExpeditionsLayer open={openLayer === "expeditions"} onOpenChange={(open) => !open && closeLayer()} />
        </Suspense>
      ) : null}

      {mountedLayers.has("pacts") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-pacts" />}>
          <PactsLayer open={openLayer === "pacts"} onOpenChange={(open) => !open && closeLayer()} />
        </Suspense>
      ) : null}

      {mountedLayers.has("almanac") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-almanac" />}>
          <AlmanacLayer open={openLayer === "almanac"} onOpenChange={(open) => !open && closeLayer()} />
        </Suspense>
      ) : null}

      {mountedLayers.has("chronicle") ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-chronicle" />}>
          <ChronicleLayer open={openLayer === "chronicle"} onOpenChange={(open) => !open && closeLayer()} />
        </Suspense>
      ) : null}

      {delvePickerMounted ? (
        <Suspense fallback={<ChunkFallback testId="chunk-fallback-delve-picker" />}>
          <DelvePickerLayer
            open={delvePickerOpen}
            onOpenChange={(open) => !open && closeDelvePicker()}
            playerId={playerId}
          />
        </Suspense>
      ) : null}
    </StageHost>
  );
}
