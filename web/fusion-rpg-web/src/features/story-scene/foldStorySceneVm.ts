import type { Phase, PiecePayload, ThemeRef } from "@/features/gui-lego/types";
import { ACTOR_IDS, DEFAULT_ACTOR_VARIANT, actorDefinition, type ActorId } from "./actorCast";
import { type SceneBeat, type SceneScript, type StoryCueId } from "./sceneScript";
import { sceneMoodRefForCue } from "./sceneMood";

/**
 * The story-scene fold: one **pure** function from scene state + script to the surface view-model.
 *
 * It joins the script, resolves the cast, computes speaking state, formats labels, and owns the
 * omit rules. A surface is `recipe + fold + bus` — this is the fold.
 *
 * ## Where the words come from (read this before "fixing" it)
 *
 * Player-facing **content** strings (lines, teachings, display names) pass through verbatim from the
 * authored script and cast. They are authored English with stable message ids in `messages.ts`; the
 * fold does not translate, and must not invent copy. Player-facing **chrome** strings (Next, Skip,
 * "Beat 2 of 4") arrive already resolved through `labels`, which the host builds from `useLingui` +
 * the T9 catalog — because `@lingui/macro` needs compile-time literals and cannot resolve a
 * runtime string, the fold cannot own translation. So: content passes through, chrome arrives
 * resolved, and the fold owns **placement and formatting** (which label goes where, position/total
 * shape) — that split is what "labels are fold-authored" means, and it keeps the fold pure
 * (same inputs ⇒ same outputs, no fetch, no clock, no random).
 *
 * ## Variant continuity
 *
 * An actor's variant is the last variant named **for that actor** at or before the current beat,
 * else `"default"`. The fold derives it from the script on every call — it holds no memory, so
 * there is nothing to go stale — and a speaker change can never reset the other actor's variant.
 * (Genre failure mode: re-showing an image by tag silently drops its attributes.)
 *
 * ## Omit mechanics are `undefined`, never a flag
 *
 * The mount layer omits what is absent, so the fold **omits the field**: no `nameTag` key on a
 * narration beat's window payload, no `progress` key on a one-beat script. An emitted-but-empty
 * payload would mount an empty piece; an absent field mounts nothing.
 *
 * ## `terminal`
 *
 * One shape for how a scene ends from here. Skip is always available with outcome `"skipped"`, so a
 * non-last beat — where advance merely continues — reports `{ action: "skip", outcome: "skipped" }`.
 * On the last beat the primary ending is advance → `"completed"`. `null` only when the script has no
 * beats, in which case there is nothing to end (and the window fields below are unreachable — an
 * empty script is a data defect the host must not mount, consistent with `actorDefinition` and
 * `messagesForScript` throwing on unknown actors/scenes).
 *
 * ## `revision` without the string literal
 *
 * Every payload carries the input revision (mirroring `foldConditionSurfaceVm`'s stamp), but the
 * word never appears as a string literal: each object is *constructed* with the shorthand, never
 * compared or traversed by key. The guard bans engine vocabulary in string literals and JSX text;
 * an identifier in a shorthand is neither. (The shipped folds tripped it with
 * `if (key === "revision")`; this fold has no such line by construction.)
 */

export type StorySceneLabelStrings = {
  next: string;
  final: string;
  skip: string;
  pending: string;
  retry: string;
  bypass: string;
  ackFailed: string;
  progress: (position: number, total: number) => string;
  /** Sprite placeholder hint line — piece-rendered chrome, host-resolved (never a literal). */
  spriteHint: string;
  /** Sprite placeholder accessible label, ICU-interpolated with the (already resolved) name. */
  spritePlaceholder: (name: string) => string;
};

/**
 * Host-resolved **content** strings for one scene, by position (beats) and by actor id.
 *
 * Content cannot be translated in the fold: `@lingui/macro` needs compile-time literals, so a
 * runtime string has no path into the catalog (see `messages.ts`'s own note). The host is the one
 * place that has the locale, so it resolves content the same way it resolves chrome, and the fold
 * keeps placing it. Absent entries fall back to the authored script/cast string — that is what
 * keeps a script without a catalog (the host's synthetic second scene) rendering rather than
 * throwing, and it is why this is optional rather than required.
 */
export type StorySceneContent = {
  /** Resolved window line, per beat index. A hole falls back to the script's authored line. */
  lines?: readonly (string | undefined)[];
  /** Resolved teaching sentence, per beat index. A hole falls back to the script's own. */
  teachings?: readonly (string | undefined)[];
  /** Resolved actor display name. A missing actor falls back to the cast's authored name. */
  actorNames?: Partial<Record<ActorId, string>>;
};

export type StorySceneVmInput = {
  script: SceneScript;
  /** Host-resolved content (line/teaching/actor names). The fold places it; it never translates. */
  content?: StorySceneContent;
  /** 0-based current beat. Session-only; never persisted. Out of range is a data defect. */
  beatIndex: number;
  /** Server-owned acknowledgement state, owned by the host. */
  ack: { pending: boolean; error: boolean };
  /** Resolved art per actor/variant. `null` ⇒ labelled fallback (never a 404 string). */
  art: Record<ActorId, Record<string, string | null>>;
  /** Bumped by the host when any input changed; stamped onto every payload. */
  revision?: number;
  /** Host-resolved chrome strings (see above). The fold places them; it never translates. */
  labels: StorySceneLabelStrings;
  /** Host-owned shell text (rule 11 of the spec): the scene-stage must not render these. */
  shellTitle: string;
  shellSubtitle?: string;
};

export type StorySceneTerminal = {
  action: "advance" | "skip";
  outcome: "completed" | "skipped";
} | null;

export type StorySceneVm = {
  phase: "ready";
  revision: number;
  shellTitle: string;
  shellSubtitle?: string;
  sceneId: string;
  cueId: StoryCueId | null;
  themeRef: ThemeRef;
  actors: PiecePayload[];
  window: PiecePayload & {
    line: string;
    teaching?: string;
    narration: boolean;
    nameTag?: PiecePayload;
  };
  progress?: PiecePayload;
  advance: PiecePayload;
  terminal: StorySceneTerminal;
};

/** Last variant named for this actor at or before this beat; the cast default otherwise. */
function variantFor(script: SceneScript, actorId: ActorId, beatIndex: number): string {
  let variant = DEFAULT_ACTOR_VARIANT;
  const end = Math.min(beatIndex, script.beats.length - 1);
  for (let i = 0; i <= end; i += 1) {
    const beat = script.beats[i];
    if (beat.speakerId === actorId && typeof beat.variant === "string" && beat.variant.length > 0) {
      variant = beat.variant;
    }
  }
  return variant;
}

function spriteUrlFor(
  art: StorySceneVmInput["art"],
  actorId: ActorId,
  variant: string
): string | null {
  const byVariant = art[actorId];
  if (!byVariant) return null;
  const exact = byVariant[variant];
  if (typeof exact === "string" && exact.length > 0) return exact;
  const fallback = byVariant[DEFAULT_ACTOR_VARIANT];
  if (typeof fallback === "string" && fallback.length > 0) return fallback;
  return null;
}

export function foldStorySceneVm(input: StorySceneVmInput): StorySceneVm {
  const { script, beatIndex, ack, art, content, labels, shellTitle, shellSubtitle } = input;
  if (!Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex >= script.beats.length) {
    throw new RangeError(
      `story-scene: beatIndex ${String(beatIndex)} out of range for "${script.sceneId}" (${String(
        script.beats.length
      )} beats)`
    );
  }
  const revision = input.revision ?? 0;
  const beat: SceneBeat = script.beats[beatIndex];
  const isLastBeat = beatIndex === script.beats.length - 1;
  const line = content?.lines?.[beatIndex] ?? beat.line;
  const teaching = content?.teachings?.[beatIndex] ?? beat.teaching;
  const actorNames = content?.actorNames ?? {};

  const actors: PiecePayload[] = ACTOR_IDS.map((actorId) => {
    const definition = actorDefinition(actorId);
    const displayName = actorNames[actorId] ?? definition.displayName;
    const variant = variantFor(script, actorId, beatIndex);
    const url = spriteUrlFor(art, actorId, variant);
    // The sprite's own chrome travels with the sprite: a piece renders payload text verbatim and
    // holds no literal, so the hint line and the accessible label are resolved by the host like
    // every other label (see `STORY_SCENE_PIECE_LABELS`). The label is interpolated with the same
    // resolved name the visible text uses, so the two cannot disagree.
    // The portrait's sprite arrives as a nested `body` object on the item itself, so the recipe's
    // per-item `body` slot (bound parent-relative) resolves it without a second lookup. The sprite
    // payload is complete: instanceId, identity, variant, url, phase and theme travel together, so
    // the mount never assembles a sprite from fragments.
    // Typed as the closed Phase (not inferred string): the same value feeds the portrait's
    // own `phase` below, and the envelope requires a Phase member.
    const bodyPhase: Phase = url === null ? "empty" : "ready";
    const body = {
      instanceId: `scene:actor:${actorId}:sprite`,
      phase: bodyPhase,
      revision,
      actorId,
      displayName,
      initial: definition.initial,
      variantId: variant,
      spriteUrl: url,
      hintLabel: labels.spriteHint,
      spriteLabel: labels.spritePlaceholder(displayName),
      themeRef: definition.themeRef
    };
    return {
      piece: "actor-portrait",
      instanceId: `scene:actor:${actorId}`,
      phase: body.phase,
      revision,
      actorId,
      displayName,
      initial: definition.initial,
      variantId: variant,
      spriteUrl: url,
      speaking: beat.speakerId === actorId,
      themeRef: definition.themeRef,
      body
    };
  });

  const windowPayload: StorySceneVm["window"] = {
    piece: "dialogue-window",
    instanceId: "scene:window",
    phase: "ready",
    revision,
    line,
    ...(teaching !== undefined ? { teaching } : {}),
    narration: beat.speakerId === undefined,
    // G5: the name tag lives ON the window payload — a top-level bind would resolve against the
    // wrong parent and silently omit the tag on every spoken beat. Absent (not empty) on narration.
    ...(beat.speakerId !== undefined
      ? {
          nameTag: {
            piece: "name-tag",
            instanceId: "scene:name-tag",
            phase: "ready",
            revision,
            displayName: actorNames[beat.speakerId] ?? actorDefinition(beat.speakerId).displayName,
            themeRef: actorDefinition(beat.speakerId).themeRef
          }
        }
      : {})
  };

  const total = script.beats.length;
  // The progress piece reads index/total/showPips (not just the label): `total <= 1` renders
  // nothing, so omitting those fields would silently blank the progress on every multi-beat scene.
  const progressPayload: PiecePayload | undefined =
    total <= 1
      ? undefined
      : {
          piece: "scene-progress",
          instanceId: "scene:progress",
          phase: "ready",
          revision,
          index: beatIndex,
          total,
          label: labels.progress(beatIndex + 1, total)
        };

  return {
    phase: "ready",
    revision,
    shellTitle,
    ...(shellSubtitle !== undefined ? { shellSubtitle } : {}),
    sceneId: script.sceneId,
    cueId: beat.cueId ?? null,
    themeRef: sceneMoodRefForCue(beat.cueId) ?? { kind: "neutral", id: "neutral" },
    actors,
    window: windowPayload,
    ...(progressPayload !== undefined ? { progress: progressPayload } : {}),
    advance: {
      piece: "advance-control",
      instanceId: "scene:advance",
      phase: "ready",
      revision,
      pending: ack.pending,
      error: ack.error,
      isLastBeat,
      nextLabel: labels.next,
      finalLabel: labels.final,
      skipLabel: labels.skip,
      pendingLabel: labels.pending,
      retryLabel: labels.retry,
      bypassLabel: labels.bypass,
      ackFailedLabel: labels.ackFailed
    },
    terminal: isLastBeat
      ? { action: "advance", outcome: "completed" }
      : { action: "skip", outcome: "skipped" }
  };
}
