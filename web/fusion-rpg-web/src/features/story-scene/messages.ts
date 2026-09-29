import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import { RIFT_PROLOGUE_SCRIPT, type SceneScript } from "./sceneScript";
import { ACTOR_IDS, type ActorId } from "./actorCast";
import type { StorySceneContent } from "./foldStorySceneVm";

/**
 * Story-scene localization: the message ids, and every player-facing story string.
 *
 * Owner decision S4 is "i18n throughout, English default" — the same posture as the rest of the UI.
 *
 * ## The constraint this module is shaped by (verified, not assumed)
 *
 * `@lingui/macro` compiles `msg` at build time and **requires the message text to be a
 * compile-time literal**. `msg({ message: someRuntimeString })` is a hard error
 * (`@lingui/macro: Unsupported macro usage`). A probe confirmed it: the template form, the object
 * form with a literal, and ICU interpolation all compile; the object form with a *variable* does not.
 *
 * So the spec's "resolve the script's strings through a message id at runtime" shape **cannot be
 * built as written** — there is no runtime-string path into the catalog. The shape that works, and
 * the one used here, is the spec's other listed option: **each beat carries a literal message
 * descriptor with an explicit stable id**.
 *
 * ## How this keeps one source of copy
 *
 * The authored script (`sceneScript.ts`) remains the single source for the *English wording*, and
 * the descriptors here are literal copies of it, bound by an explicit id. Duplication between a
 * script and its catalog is inherent to a compile-time extraction model — the catalog must contain
 * literals or nothing is extractable. What makes it safe is that it cannot drift:
 * `messages.test.ts` asserts every descriptor's text equals the corresponding script string, so an
 * edit to one without the other fails the suite. That is the same guarantee the spec's
 * "missing message id fails a test" clause was reaching for, enforced from the other direction.
 *
 * Ids are **stable and positional** (`scene.rift-prologue.beat2.line`), never the English sentence,
 * so changing the wording does not orphan an existing translation.
 */

/** Chrome for the story shell. Rendered by the host, not by a piece. */
export const STORY_SCENE_CHROME = {
  next: msg({ id: "story-scene.chrome.next", message: "Next" }),
  final: msg({ id: "story-scene.chrome.final", message: "Anchor the lawn" }),
  skip: msg({ id: "story-scene.chrome.skip", message: "Skip intro" }),
  retry: msg({ id: "story-scene.chrome.retry", message: "Retry" }),
  bypass: msg({ id: "story-scene.chrome.bypass", message: "Continue to lawn" }),
  pending: msg({ id: "story-scene.chrome.pending", message: "Saving…" }),
  ackFailed: msg({
    id: "story-scene.chrome.ackFailed",
    message: "We couldn't save that just now — try again next time, or carry on to the lawn."
  })
} as const;

/** The prologue's shell title and subtitle, rendered by the host. */
export const RIFT_PROLOGUE_CHROME = {
  title: msg({ id: "scene.rift-prologue.title", message: "The Rift is opening" }),
  subtitle: msg({
    id: "scene.rift-prologue.subtitle",
    message: "A short warning before your first lawn"
  })
} as const;

/**
 * Chrome a **piece** renders, resolved by the host and carried on the payload.
 *
 * These are not authored content (which lives in the script) and not shell labels (which the host
 * renders itself). They are the strings a piece would otherwise have to hard-code — which is the
 * defect S4 names: a piece that renders a literal is wrong regardless of the locale
 * (`spec-piece-contract.md:82`, `spec-localization.md` success criterion 2).
 *
 * Found the hard way: `actor-sprite` shipped `art not yet authored` as JSX text and
 * `` `${displayName} — art not yet available` `` as its accessible label, and `advance-control`
 * shipped a `"Working…"` title fallback that contradicted its own doc comment ("absent by default —
 * the scene host never needed one, and an untitled button stays untitled"). All three were English
 * under every locale, and none was caught until the pseudo-locale render existed, because none of
 * them is a beat line.
 */
export const STORY_SCENE_PIECE_LABELS = {
  spriteHint: msg({ id: "story-scene.sprite.hint", message: "art not yet authored" }),
  spritePlaceholder: msg({
    id: "story-scene.sprite.placeholder",
    message: "{name} — art not yet available"
  })
} as const;

/** Message id for a beat's line or teaching sentence. Stable across wording changes. */
export function beatMessageId(
  sceneId: SceneScript["sceneId"],
  beatIndex: number,
  field: "line" | "teaching"
): string {
  return `scene.${sceneId}.beat${beatIndex + 1}.${field}`;
}

/** Message id for an actor's player-facing name. */
export function actorNameMessageId(actorId: ActorId): string {
  return `actor.${actorId}.name`;
}

/** Message id for the beat-position label. */
export function progressMessageId(sceneId: SceneScript["sceneId"]): string {
  return `scene.${sceneId}.progress`;
}

/**
 * The four Rift beats, as literal descriptors bound to their positional ids.
 *
 * Kept in the script's beat order and asserted against it by `messages.test.ts`; a beat added to the
 * script without a descriptor here fails that test rather than rendering an untranslated string.
 */
export const RIFT_PROLOGUE_BEAT_MESSAGES: readonly {
  id: string;
  line: MessageDescriptor;
  teaching?: MessageDescriptor;
}[] = [
  {
    id: beatMessageId("rift-prologue", 0, "line"),
    line: msg({
      id: "scene.rift-prologue.beat1.line",
      message: "Uh-oh. That lawn is doing the wrong kind of wobbly."
    }),
    teaching: msg({
      id: "scene.rift-prologue.beat1.teaching",
      message: "Start from something familiar—and worth protecting."
    })
  },
  {
    id: beatMessageId("rift-prologue", 1, "line"),
    line: msg({ id: "scene.rift-prologue.beat2.line", message: "Temporal signal unstable." }),
    teaching: msg({
      id: "scene.rift-prologue.beat2.teaching",
      message: "The fracture is new, and something inside it is changing."
    })
  },
  {
    id: beatMessageId("rift-prologue", 2, "line"),
    line: msg({
      id: "scene.rift-prologue.beat3.line",
      message: "UNSTABLE SECTOR. QUARANTINE PENDING."
    }),
    teaching: msg({
      id: "scene.rift-prologue.beat3.teaching",
      message: "Containment can save a world—or cut it away."
    })
  },
  {
    id: beatMessageId("rift-prologue", 3, "line"),
    line: msg({
      id: "scene.rift-prologue.beat4.line",
      message: "Then we fix it before they close the gate. Plants first. Questions later."
    }),
    teaching: msg({
      id: "scene.rift-prologue.beat4.teaching",
      message: "Anchor the lawn now. The wider Rift waits beyond your first victory."
    })
  }
];

/** The beat-position label, interpolated so a translator's word order is preserved. */
export const RIFT_PROLOGUE_PROGRESS = msg({
  id: "scene.rift-prologue.progress",
  message: "Beat {position} of {total}"
});

/** Every actor-name message, keyed by its stable id. */
export function messagesForCast(): Record<string, MessageDescriptor> {
  const messages: Record<string, MessageDescriptor> = {};
  for (const actorId of ACTOR_IDS) {
    // Each name is a TOKEN, never a name: the registry owns the display strings (§6.5b), and the
    // consumer renders this descriptor with `leadNameValues()`. The macro still gets its required
    // compile-time literal, and the id is unchanged, so no translation is orphaned by a rename.
    messages[actorNameMessageId(actorId)] = actorId === "dave"
      ? msg({ id: "actor.dave.name", message: "{lead_summoner}" })
      : msg({ id: "actor.penny.name", message: "{lead_companion}" });
  }
  return messages;
}

/**
 * Every player-facing message a script needs, keyed by its stable id.
 *
 * Walks the script's own beats so the mapping is positional; a beat the descriptor table does not
 * cover throws rather than resolving to a dead id.
 */
export function messagesForScript(script: SceneScript): Record<string, MessageDescriptor> {
  if (script.sceneId !== RIFT_PROLOGUE_SCRIPT.sceneId) {
    // Only the prologue has descriptors today. A second scene needs its own literal table — that is
    // a content change, not a lookup, precisely because the macro needs literals.
    throw new Error(`story-scene: no message catalog for "${script.sceneId}"`);
  }
  const messages: Record<string, MessageDescriptor> = {
    [progressMessageId(script.sceneId)]: RIFT_PROLOGUE_PROGRESS
  };
  script.beats.forEach((_, index) => {
    const entry = RIFT_PROLOGUE_BEAT_MESSAGES[index];
    if (!entry) {
      throw new Error(
        `story-scene: "${script.sceneId}" beat ${index + 1} has no message descriptor`
      );
    }
    messages[entry.id] = entry.line;
    if (entry.teaching) messages[beatMessageId(script.sceneId, index, "teaching")] = entry.teaching;
  });
  return messages;
}

/** Every story-scene message: chrome, the prologue's script, and the cast. */
export function storySceneMessages(): Record<string, MessageDescriptor> {
  return {
    ...STORY_SCENE_CHROME,
    ...STORY_SCENE_PIECE_LABELS,
    ...RIFT_PROLOGUE_CHROME,
    ...messagesForScript(RIFT_PROLOGUE_SCRIPT),
    ...messagesForCast()
  };
}

/**
 * Resolve a scene's authored **content** through the catalog for the locale the host activated.
 *
 * The host is the only place that has a locale, so it resolves content exactly the way it already
 * resolves chrome, and hands the result to the fold (`foldStorySceneVm`'s `content` input).
 *
 * This exists because the descriptors above were extracted for translators but **read by no
 * production code**: the render used the script's and the cast's own English literals, so a
 * translation — or the pseudo locale — changed the chrome and left every line, teaching, actor name
 * and sprite label in English. That is the failure the program's own acceptance test names (owner
 * S4: "the pseudo-locale render is the acceptance test", checkpoint F), and
 * `StorySceneHost.pseudo.test.tsx` is the assertion that reds without this function.
 *
 * A scene with no descriptor table (the host's synthetic second scene) resolves to `{}` rather than
 * throwing, so its authored strings still render — `messagesForScript` may throw because it is only
 * ever called for a script it has a table for, but content resolution runs for every scene.
 *
 * A `resolve` that hands back the id unchanged (lingui's missing-translation fallback) counts as
 * missing for the same reason: printing `scene.rift-prologue.beat1.line` as player copy is worse
 * than printing the authored English, and it is unreachable today because `en` is always loaded.
 */
export function sceneContentResolver(
  script: SceneScript,
  resolve: (id: string) => string
): StorySceneContent {
  const translated = (id: string): string | undefined => {
    const value = resolve(id);
    return value.length > 0 && value !== id ? value : undefined;
  };

  const content: StorySceneContent = {};
  if (script.sceneId === RIFT_PROLOGUE_SCRIPT.sceneId) {
    content.lines = script.beats.map((_, index) =>
      translated(beatMessageId(script.sceneId, index, "line"))
    );
    content.teachings = script.beats.map((_, index) =>
      RIFT_PROLOGUE_BEAT_MESSAGES[index]?.teaching === undefined
        ? undefined
        : translated(beatMessageId(script.sceneId, index, "teaching"))
    );
  }

  // Actor names are cast-wide, not scene-local: the same player-facing name labels the portrait,
  // the sprite label and the name tag on every scene that actor appears in.
  const actorNames: Partial<Record<ActorId, string>> = {};
  for (const actorId of ACTOR_IDS) {
    const name = translated(actorNameMessageId(actorId));
    if (name !== undefined) actorNames[actorId] = name;
  }
  content.actorNames = actorNames;

  return content;
}
