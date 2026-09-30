import { describe, expect, it } from "vitest";
import tuning from "@gk-core/data/tuning/story-scene-ui.v1.json";
import {
  STORY_SCENE_ACTOR_COLLAPSE_PX,
  STORY_SCENE_ART_ASPECT,
  STORY_SCENE_PLACEHOLDER_SIZE_PX,
  STORY_SCENE_TOUCH_TARGET_MIN_PX
} from "./storySceneTokens";

/**
 * `scene-tunables` guards the split between the three presentation-number homes: feel/pacing in
 * `gk-core/data/tuning/story-scene-ui.v1.json`, structural geometry in `storySceneTokens.ts`, paint in a
 * theme pack. These assertions pin the split's *contract*, not any particular value — a designer
 * editing the tuning file must not have to touch this test.
 */
describe("story-scene tuning — feel lives in data", () => {
  it("ships the four declared keys and nothing unexpected", () => {
    expect(Object.keys(tuning.scene).sort()).toEqual(
      ["autoAdvanceMs", "beatTransitionMs", "lineRevealPerCharMs", "maxBeatsPerScene"].sort()
    );
  });

  it("disables auto-advance by default, because it steals reading time", () => {
    expect(tuning.scene.autoAdvanceMs).toBeNull();
  });

  it("defaults the line reveal to instant, so a typewriter is opt-in", () => {
    expect(tuning.scene.lineRevealPerCharMs).toBe(0);
  });

  it("carries a positive beat transition and beat cap", () => {
    expect(tuning.scene.beatTransitionMs).toBeGreaterThan(0);
    expect(tuning.scene.maxBeatsPerScene).toBeGreaterThan(0);
  });

  it("declares the tuning file publishable, not hand-edited", () => {
    // publish.py discovers a domain by filename and writes the next version; without the
    // _meta.rebalance note a later pass would hand-edit the JSON instead.
    expect(tuning._meta.rebalance).toContain("publish.py");
    expect(tuning._meta.owner).toContain("story-scene");
  });

  it("keeps a beat cap that is a bound on authored content, not the shipped script's length", () => {
    // The cap must be able to hold any authored scene; asserting it equals a particular
    // script's beat count would be the forbidden "pin a derived population" pattern.
    expect(tuning.scene.maxBeatsPerScene).toBeGreaterThanOrEqual(2);
  });
});

describe("story-scene tokens — structural geometry is code, not data", () => {
  it("exposes the four structural values", () => {
    expect(STORY_SCENE_ART_ASPECT).toBeGreaterThan(0);
    expect(STORY_SCENE_ACTOR_COLLAPSE_PX).toBeGreaterThan(0);
    expect(STORY_SCENE_PLACEHOLDER_SIZE_PX).toBeGreaterThan(0);
    expect(STORY_SCENE_TOUCH_TARGET_MIN_PX).toBeGreaterThan(0);
  });

  it("keeps the touch target at or above the accessibility floor", () => {
    // Structural floor: it may be raised, never tuned below (WCAG 2.5.8).
    expect(STORY_SCENE_TOUCH_TARGET_MIN_PX).toBeGreaterThanOrEqual(44);
  });

  it("places the collapse breakpoint below the desktop layout and above the narrow one", () => {
    expect(STORY_SCENE_ACTOR_COLLAPSE_PX).toBeGreaterThan(320);
    expect(STORY_SCENE_ACTOR_COLLAPSE_PX).toBeLessThan(1280);
  });

  it("does not restate a feel value in code", () => {
    // The structural module must not duplicate a tuning key — that is the drift this split
    // exists to prevent (a rebalance would then need a code change too).
    const codeValues = [
      STORY_SCENE_ART_ASPECT,
      STORY_SCENE_ACTOR_COLLAPSE_PX,
      STORY_SCENE_PLACEHOLDER_SIZE_PX,
      STORY_SCENE_TOUCH_TARGET_MIN_PX
    ];
    for (const feel of [tuning.scene.beatTransitionMs, tuning.scene.maxBeatsPerScene]) {
      expect(codeValues).not.toContain(feel);
    }
  });
});
