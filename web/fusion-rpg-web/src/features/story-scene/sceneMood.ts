import type { StoryCueId } from "./sceneScript";
import type { ThemeRef } from "@/features/gui-lego/types";

/**
 * Scene mood: which `scene.*` pack paints a beat.
 *
 * Scene mood is **per-beat**, joined from the script's `cueId`
 * (`docs/architecture/story-scene/spec-theme-packs-scene.md:104`) — a scene pack is selected by the
 * scene's state, not by a component prop. Two beats can share a mood: the portal opening covers the
 * first two beats, the quarantine the last two.
 *
 * ## Why this module exists rather than a lookup inline in the fold
 *
 * The ref is typed `ThemeRef & { kind: "scene" }`, which is what makes the `"scene"` arm of
 * `ThemeKind` **load-bearing**. Without a production consumer of a `scene` ref, the union arm could
 * be deleted with `tsc` still clean — the widen would be decorative. The same defect T10's gate
 * caught for `actor` (where `actorCast.ts` had its own inline structural type) would otherwise
 * remain here.
 *
 * A cue with no mood returns `undefined` rather than defaulting to a nearby mood: guessing would
 * paint a beat with the wrong atmosphere, and the caller already handles an absent ref by falling
 * back to the neutral pack.
 */

/** The moods this program ships. Closed on purpose — a new mood is a new pack plus a map entry. */
export type SceneMood = "rift-portal" | "quarantine";

/** Cue → mood. The two portal beats share a mood, as do the two quarantine beats. */
const MOOD_BY_CUE: Record<StoryCueId, SceneMood> = {
  "rift.portal.open": "rift-portal",
  "rift.portal.surge": "rift-portal",
  "rift.quarantine.seal": "quarantine",
  "rift.quarantine.fade": "quarantine"
};

/**
 * The scene pack ref for a beat's cue, or `undefined` when the beat has no cue.
 *
 * The `ThemeRef & { kind: "scene" }` return type is deliberate: it is the type-level join between
 * this module and the `ThemeKind` union, so removing `"scene"` from the union breaks the build here.
 */
export function sceneMoodRefForCue(cueId: StoryCueId | undefined): ThemeRef & { kind: "scene" } | undefined {
  if (!cueId) return undefined;
  return { kind: "scene", id: MOOD_BY_CUE[cueId] };
}
