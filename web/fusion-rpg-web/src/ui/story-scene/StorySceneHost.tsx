import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react";
import { DialogShell } from "@/shell/DialogShell";
import { useAcknowledgeOnboardingStory } from "@/lib/bus";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureStorySceneRegistered } from "@/ui/gui-lego/registerStoryScene";
/* ensureStorySceneRegistered() is called in the body below (not in an effect): registration is
   synchronous and idempotent, mirroring ConditionTab, so the first render already has its recipe. */
import type { StoryCueId } from "@/features/story-scene/sceneScript";
import { ACTOR_IDS, ACTORS } from "@/features/story-scene/actorCast";
import {
  RIFT_PROLOGUE_CHROME,
  RIFT_PROLOGUE_PROGRESS,
  STORY_SCENE_CHROME,
  STORY_SCENE_PIECE_LABELS,
  sceneContentResolver
} from "@/features/story-scene/messages";
import {
  foldStorySceneVm,
  type StorySceneLabelStrings,
  type StorySceneVmInput
} from "@/features/story-scene/foldStorySceneVm";
import { createStorySceneSurfaceBus } from "@/features/gui-lego/storySceneBus";
import type { SceneScript } from "@/features/story-scene/sceneScript";

/**
 * The reusable host: all the non-presentational wiring a scene needs, owned once, so scene 2 is
 * data + a trigger rather than a copied dialog.
 *
 * It owns beat index, the advance guard, the acknowledgement mutation, error recovery, cue
 * emission, and the fold→mount wiring. It renders **no** scene markup of its own — every pixel is
 * a piece. Eligibility and triggering stay with the caller (`open`); presentation stays with the
 * pieces; arcs and what-plays-next are out of scope.
 *
 * Extracted from `features/onboarding/RiftPrologueDialog.tsx` without changing observable
 * behaviour: same story id/version/outcomes, same retry + bypass, same cue-once-per-beat, same
 * double-click guard. The six local state concerns collapsed to three that remain here
 * (beat index, ack, continue destination); the rest moved into data (fold) and pieces.
 */

export type StorySceneHostProps = {
  /** The scene's data. Scene 2 = a new value here, never a host edit. */
  script: SceneScript;
  /** Whether the scene is showing. The trigger/eligibility decision is the caller's. */
  open: boolean;
  /** Player the acknowledgement is written for. */
  playerId: number;
  /** Close without continuing (dismissed). */
  onClose: () => void;
  /** Existing destination; used by successful and degraded completion alike. */
  onContinue?: () => void;
  /** Optional presentation seam — semantic cue. Absent is safe. */
  onCue?: (cueId: StoryCueId) => void;
  /**
   * Instance identity for the dialog shell (test hooks, e2e scoping). The host is shared by every
   * scene, so the value comes from the caller — the wrapper IS the instance. Absent ⇒ the shell's
   * own default; scene 2 passes its own without a host edit.
   */
  testId?: string;
};

export function StorySceneHost({
  script,
  open,
  playerId,
  onClose,
  onContinue,
  onCue,
  testId
}: StorySceneHostProps) {
  ensureStorySceneRegistered();

  const { i18n } = useLingui();
  const [beatIndex, setBeatIndex] = useState(0);
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const advanceGuardRef = useRef(false);
  const emittedBeatRef = useRef<number | null>(null);
  const [ackError, setAckError] = useState(false);
  const acknowledge = useAcknowledgeOnboardingStory(playerId);
  const typedBus = useMemo(() => createStorySceneSurfaceBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);
  const revisionRef = useRef(0);
  // The **active locale** is a render input, not a constant: System → Preferences can switch it at
  // runtime (`SystemLayer.tsx:117-118` calls `setLocale`), and both memos below resolve through that
  // locale. Keying them on the `i18n` singleton alone left the whole scene — chrome and content — on
  // the language it was first mounted with, because a singleton identity never changes. Read it here
  // once so the dependency is the value that actually moves.
  const locale = i18n.locale;

  // Chrome strings resolve here, once, from the T9 catalog — the fold places them, pieces render
  // them verbatim, and nothing anywhere hardcodes English. Progress keeps ICU interpolation so a
  // translator's word order survives.
  const labels: StorySceneLabelStrings = useMemo(
    () => ({
      next: i18n._(STORY_SCENE_CHROME.next),
      final: i18n._(STORY_SCENE_CHROME.final),
      skip: i18n._(STORY_SCENE_CHROME.skip),
      pending: i18n._(STORY_SCENE_CHROME.pending),
      retry: i18n._(STORY_SCENE_CHROME.retry),
      bypass: i18n._(STORY_SCENE_CHROME.bypass),
      ackFailed: i18n._(STORY_SCENE_CHROME.ackFailed),
      progress: (position: number, total: number) =>
        // This build's `i18n._` overloads take values only with a string id, never with a
        // descriptor — resolving through the id keeps the catalog's ICU word order intact.
        i18n._(RIFT_PROLOGUE_PROGRESS.id, { position, total }),
      spriteHint: i18n._(STORY_SCENE_PIECE_LABELS.spriteHint),
      spritePlaceholder: (name: string) =>
        i18n._(STORY_SCENE_PIECE_LABELS.spritePlaceholder.id, { name })
    }),
    [i18n, locale]
  );

  const shellTitle = i18n._(RIFT_PROLOGUE_CHROME.title);
  const shellSubtitle = i18n._(RIFT_PROLOGUE_CHROME.subtitle);

  // Content resolves here too, for the same reason chrome does: the locale lives in this component.
  // Beat lines, teachings and actor names are extracted catalog messages (`messages.ts`), so a
  // translator — or the pseudo locale — has to change them at render, not only in the .po file. The
  // fold places whatever it is handed and never translates (its own note), which is what keeps it
  // pure; before this, the render read the authored English literals and the catalog reached no
  // player.
  const content = useMemo(
    () => sceneContentResolver(script, (id: string) => i18n._(id)),
    [script, i18n, locale]
  );

  // Art per actor/variant, straight from the cast the fold already trusts: today every entry is
  // null (no art authored), so the labelled fallback is the honest state. When art ships, the cast
  // carries the URLs and this mapping needs no edit.
  const art = useMemo(() => {
    const table = {} as Record<string, Record<string, string | null>>;
    for (const actorId of ACTOR_IDS) {
      const variants: Record<string, string | null> = {};
      for (const variant of ACTORS[actorId].variants) {
        variants[variant.id] = variant.spriteUrl;
      }
      table[actorId] = variants;
    }
    return table as StorySceneVmInput["art"];
  }, []);

  const continueToDestination = useCallback(() => {
    onClose();
    onContinue?.();
  }, [onClose, onContinue]);

  const finish = useCallback(
    async (outcome: "completed" | "skipped") => {
      if (busyRef.current || finishedRef.current) return;
      busyRef.current = true;
      setAckError(false);
      try {
        await acknowledge.mutateAsync({
          storyId: script.sceneId,
          version: script.version,
          outcome
        });
        finishedRef.current = true;
        continueToDestination();
      } catch {
        // Keep the scene usable: the player can retry the durable acknowledgement or bypass it
        // to the existing destination. The server remains the authority either way.
        setAckError(true);
      } finally {
        busyRef.current = false;
      }
    },
    // acknowledge.mutateAsync is stable across renders; script identity is the caller's contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [script, playerId, continueToDestination]
  );

  const advance = useCallback(() => {
    if (busyRef.current || finishedRef.current || advanceGuardRef.current) return;
    advanceGuardRef.current = true;
    if (beatIndex < script.beats.length - 1) setBeatIndex((value) => value + 1);
    else void finish("completed");
  }, [beatIndex, finish, script.beats.length]);

  const skip = useCallback(() => {
    void finish("skipped");
  }, [finish]);

  const retry = useCallback(() => {
    void finish(beatIndex >= script.beats.length - 1 ? "completed" : "skipped");
  }, [beatIndex, finish, script.beats.length]);

  const bypass = useCallback(() => {
    continueToDestination();
  }, [continueToDestination]);

  useEffect(() => {
    const offs = [
      typedBus.on("story-scene.advance", () => advance()),
      typedBus.on("story-scene.skip", () => skip()),
      typedBus.on("story-scene.ack.retry", () => retry()),
      typedBus.on("story-scene.ack.bypass", () => bypass())
    ];
    return () => offs.forEach((off) => off());
  }, [typedBus, advance, skip, retry, bypass]);

  // Beat position is session-only: reopening restarts at beat 1, never persisted.
  useEffect(() => {
    if (open) {
      setBeatIndex(0);
      setAckError(false);
      busyRef.current = false;
      finishedRef.current = false;
      advanceGuardRef.current = false;
      emittedBeatRef.current = null;
    }
  }, [open ]);

  // Release the advance guard only after React has committed the new beat. This makes a
  // same-tick double dispatch one transition, while still allowing the next rendered button
  // to work. Cross-tick double-clicks are collapsed by the per-beat remount below instead:
  // the second press lands on the previous beat's unmounted node.
  useEffect(() => {
    advanceGuardRef.current = false;
  }, [beatIndex]);

  // Cue emission, once per beat index, never per render.
  const beat = script.beats[beatIndex];
  useEffect(() => {
    if (!open || !beat || emittedBeatRef.current === beatIndex) return;
    emittedBeatRef.current = beatIndex;
    if (beat.cueId !== undefined) onCue?.(beat.cueId);
  }, [beat, beatIndex, onCue, open]);

  // Q5 parity with the shipped surfaces: bump when the inputs change so pieces animate on stamp.
  const revision = useMemo(() => {
    revisionRef.current += 1;
    return revisionRef.current;
  }, [script, beatIndex, ackError, labels, shellTitle, shellSubtitle, art]);

  const vm = useMemo(
    () =>
      foldStorySceneVm({
        script,
        beatIndex,
        ack: { pending: acknowledge.isPending, error: ackError },
        art,
        content,
        revision,
        labels,
        shellTitle,
        shellSubtitle
      }),
    [script, beatIndex, acknowledge.isPending, ackError, art, content, revision, labels, shellTitle, shellSubtitle]
  );
  const recipe = getRecipe("story-scene");
  const plan = useMemo(
    () => (recipe ? bindSurface(recipe, vm, { preferOverlay: false }) : null),
    [recipe, vm]
  );
  if (!plan) return <p className="rd">Story scene recipe not registered.</p>;

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) void finish("skipped");
      }}
      onEscapeKeyDown={() => void finish("skipped")}
      title={shellTitle}
      subtitle={shellSubtitle}
      size="scene"
      {...(testId !== undefined ? { testId } : {})}
    >
      {/*
        Per-beat remount: keying the mounted recipe on the beat index means the advance control
        a pointer is resting on is unmounted by the first click's transition, so the second
        click of a double-click lands on a detached node (swallowed by the framework) and yields
        exactly one transition. This is deterministic where timing guards are not — deliberate
        clicks always re-query the live node, so they are unaffected, while a double's second
        press always targets the previous beat's node regardless of inter-click gap. Focus is
        repaired by the stage piece's own mount autofocus (`sceneStage.tsx`), which refires on
        every remount and lands on the new beat's window — the same target as on open.
      */}
      <RecipeMount key={beatIndex} plan={plan} bus={bus} />
    </DialogShell>
  );
}
