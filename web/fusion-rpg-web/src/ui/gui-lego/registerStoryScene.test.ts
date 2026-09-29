import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import storySceneRecipe from "@/ui/gui-lego/recipes/story-scene.json";
import { ensureStorySceneRegistered } from "@/ui/gui-lego/registerStoryScene";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import {
  STORY_SCENE_SURFACE_EVENTS,
  createStorySceneSurfaceBus
} from "@/features/gui-lego/storySceneBus";

type SlotFill = {
  piece?: string;
  bind?: string;
  $bindArray?: string;
  slots?: Record<string, SlotFill>;
};

/**
 * T21 `recipe-wire`: the `story-scene` recipe (both sides), idempotent registration, and the closed
 * four-event bus. No lifecycle overlays — the shared `phase-*` pieces render engine text, which must
 * never reach a player surface.
 */
describe("recipe-wire — design SSOT and runtime copy agree", () => {
  it("both files parse to the same document", () => {
    // Read from disk like the CSS-convention test does: no test imports JSON from docs/ (there is
    // no precedent for it), and a bundler-resolved import would prove less than a byte read.
    const design = JSON.parse(
      readFileSync(
        join(__dirname, "..", "..", "..", "..", "..", "docs", "design", "gui-lego", "recipes", "story-scene.json"),
        "utf8"
      )
    );
    expect(design).toEqual(storySceneRecipe);
  });
});

describe("recipe-wire — root binds vm and every slot child declares a bind", () => {
  // An unbound child receives the whole parent payload (bindSurface getByPath returns the root for
  // a missing path) — a silent mis-bind. This walks the recipe the way the mount does.
  function checkBound(node: SlotFill, path: string): void {
    for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
      expect(
        typeof fill.bind === "string" || typeof fill.$bindArray === "string",
        `${path}/${slotName} declares no bind`
      ).toBe(true);
      if (fill.slots) checkBound({ ...fill, slots: fill.slots } as SlotFill, `${path}/${slotName}`);
    }
  }

  it("root binds vm", () => {
    const root = (storySceneRecipe as unknown as { root: SlotFill }).root;
    expect(root.bind).toBe("vm");
  });

  it("every slot child declares a bind", () => {
    const root = (storySceneRecipe as unknown as { root: SlotFill }).root;
    checkBound(root, "root");
  });

  it("actors uses parent-relative $bindArray, not a vm path", () => {
    const actors = (storySceneRecipe as unknown as { root: { slots: Record<string, SlotFill> } })
      .root.slots["actors"];
    expect(actors.$bindArray).toBe("actors");
  });

  it("has no lifecycleOverlays key", () => {
    expect("lifecycleOverlays" in (storySceneRecipe as unknown as Record<string, unknown>)).toBe(
      false
    );
  });
});

describe("recipe-wire — registration is idempotent", () => {
  it("registers the recipe retrievable by surfaceId, twice without duplication", () => {
    ensureStorySceneRegistered();
    expect(getRecipe("story-scene")?.surfaceId).toBe("story-scene");
    ensureStorySceneRegistered();
    expect(getRecipe("story-scene")?.surfaceId).toBe("story-scene");
  });
});

describe("recipe-wire — closed four-event bus", () => {
  it("declares exactly the four events", () => {
    expect([...STORY_SCENE_SURFACE_EVENTS].sort()).toEqual(
      ["story-scene.advance", "story-scene.skip", "story-scene.ack.retry", "story-scene.ack.bypass"].sort()
    );
  });

  it("delivers emitted events to subscribers and unsubscribes", () => {
    const bus = createStorySceneSurfaceBus();
    const seen: Array<[string, unknown]> = [];
    const off = bus.on("story-scene.advance", (payload) => void seen.push(["advance", payload]));
    bus.emit("story-scene.advance", {});
    expect(seen).toHaveLength(1);
    off();
    bus.emit("story-scene.advance", {});
    expect(seen).toHaveLength(1);
  });
});
