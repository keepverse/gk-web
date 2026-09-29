import tuning from "../../../../../data/tuning/story-scene-ui.v1.json";

/**
 * The story-scene script contract and the Rift prologue's data.
 *
 * Beat content lives here as **authored narrative**, deliberately not as a `const` inside a
 * component: scene 2 must be data plus a trigger, not a second dialog. The copy's SSOT is
 * `docs/ideas/onboarding-gnome-teaser.md`'s beat table, and `sceneScript.test.ts` pins the parity.
 *
 * Typed ids (`ActorId`, `StoryCueId`) make a typo a compile error rather than a silent wrong
 * label at mount — which is the class of bug the old `speaker: string` invited.
 *
 * Localization note (owner S4): this keeps its authored English, and the fold resolves each string
 * through a stable message id (`scene.<sceneId>.beat<n>.line` / `.teaching`). Keeping the script as
 * a readable script is what makes the byte-identical copy parity below enforceable.
 */

/** Stable actor id, resolved through the actor-cast registry (`actorCast.ts`). */
export type ActorId = "penny" | "dave";

/** Semantic cue id for the FE cue layer. Closed set — a typo is a compile error. */
export type StoryCueId =
  | "rift.portal.open"
  | "rift.portal.surge"
  | "rift.quarantine.seal"
  | "rift.quarantine.fade";

/** Stable scene id, used for the story ledger and for message-id resolution. Never rendered. */
export type SceneId = "rift-prologue";

/** One spoken or narrated beat. Authored content — not a generated tree, not a tunable. */
export type SceneBeat = {
  /** Resolved through the actor-cast registry. **Absent means narration** (no name tag). */
  speakerId?: ActorId;
  /** Optional named variant of that actor's portrait (e.g. a mood). Absent ⇒ the cast default. */
  variant?: string;
  /** The line the player reads. One short sentence; this is the scene's own text. */
  line: string;
  /** One optional teaching sentence. Absent ⇒ no teaching line rendered. */
  teaching?: string;
  /** Semantic cue id for the FE cue layer. Absent ⇒ no cue this beat. */
  cueId?: StoryCueId;
};

export type SceneScript = {
  sceneId: SceneId;
  /** Content version, bumped when beats change. Mirrors the story-ledger version field. */
  version: number;
  beats: readonly SceneBeat[];
};

/**
 * The per-scene beat cap, read from the tuning file rather than written as a constant here.
 *
 * It is a **bound on authored content**, not a population reading: a scene needing more than the cap
 * should be two scenes (the genre answer — Ren'Py sequences scenes; it does not cap lines
 * arbitrarily). Reading it from `story-scene-ui.v1.json` is what lets a designer change the dial
 * without touching this module, and `sceneScript.test.ts` asserts the two agree.
 */
export function maxBeatsPerScene(): number {
  return tuning.scene.maxBeatsPerScene;
}

/**
 * Validate a script at the boundary.
 *
 * This is a **structural pre-condition, not a clamp**: a malformed script throws and names the
 * problem, rather than being silently trimmed to fit. An absolute structural bound is exempt from
 * the no-clamp rule precisely because it is a structural limit and says so here.
 */
export function assertSceneScript(script: SceneScript): SceneScript {
  const cap = maxBeatsPerScene();
  if (script.beats.length === 0) {
    throw new Error(
      `story-scene: "${script.sceneId}" has no beats — a scene needs at least one beat`
    );
  }
  if (script.beats.length > cap) {
    throw new Error(
      `story-scene: "${script.sceneId}" has ${script.beats.length} beats, over the cap of ${cap} ` +
        `(maxBeatsPerScene in data/tuning/story-scene-ui.v1.json) — split it into two scenes`
    );
  }
  for (const [index, beat] of script.beats.entries()) {
    if (!beat.line || beat.line.trim().length === 0) {
      throw new Error(
        `story-scene: "${script.sceneId}" beat ${index + 1} has no line — every beat needs one`
      );
    }
  }
  return script;
}

/**
 * The Rift prologue — the four beats, migrated **verbatim** from the component.
 *
 * Beat 3 is **narration** (no `speakerId`). It used to carry the synthetic speaker `"Gnome signal"`,
 * which would have rendered a name tag for a machine; narration is a line with no speaker, so the
 * field is absent. This is a rendering correction, not a copy edit — the line text is untouched.
 *
 * The dead `seal` flag is **dropped rather than migrated**: it drove `data-sealed`, which nothing
 * read, and the quarantine mood is already carried by `cueId === "rift.quarantine.seal"`, which
 * `rift.css` styles.
 */
export const RIFT_PROLOGUE_SCRIPT: SceneScript = assertSceneScript({
  sceneId: "rift-prologue",
  version: 1,
  beats: [
    {
      speakerId: "dave",
      line: "Uh-oh. That lawn is doing the wrong kind of wobbly.",
      teaching: "Start from something familiar—and worth protecting.",
      cueId: "rift.portal.open"
    },
    {
      speakerId: "penny",
      line: "Temporal signal unstable.",
      teaching: "The fracture is new, and something inside it is changing.",
      cueId: "rift.portal.surge"
    },
    {
      line: "UNSTABLE SECTOR. QUARANTINE PENDING.",
      teaching: "Containment can save a world—or cut it away.",
      cueId: "rift.quarantine.seal"
    },
    {
      speakerId: "dave",
      line: "Then we fix it before they close the gate. Plants first. Questions later.",
      teaching: "Anchor the lawn now. The wider Rift waits beyond your first victory.",
      cueId: "rift.quarantine.fade"
    }
  ]
});
