import { createSurfaceBus } from "./createSurfaceBus";

/**
 * The story-scene surface bus — exactly four events, closed.
 *
 * Pieces emit; the host acts. No piece fetches and no piece calls the acknowledgement mutation
 * directly — that would split the terminal path the fold unified. Expanding this union is an
 * ask-first map/ideal change, the same rule the condition surface carries.
 */
export type StorySceneSurfaceEvent =
  | "story-scene.advance"
  | "story-scene.skip"
  | "story-scene.ack.retry"
  | "story-scene.ack.bypass";

export const STORY_SCENE_SURFACE_EVENTS: readonly StorySceneSurfaceEvent[] = [
  "story-scene.advance",
  "story-scene.skip",
  "story-scene.ack.retry",
  "story-scene.ack.bypass"
];

export function createStorySceneSurfaceBus() {
  return createSurfaceBus<StorySceneSurfaceEvent>();
}
