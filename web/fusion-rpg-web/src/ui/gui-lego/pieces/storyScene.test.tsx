import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { clearPieceRegistryForTests, getPiece, listPieces, registerPiece } from "@/features/gui-lego/pieceRegistry";
import { createSurfaceBus } from "@/features/gui-lego/createSurfaceBus";
import type { RecipeDocument } from "@/features/gui-lego/types";
import { RecipeMount, themeStyle, vfxClass } from "../RecipeMount";
import {
  STORY_SCENE_SHARED_SLOTS,
  STORY_SCENE_SLOT_MAP,
  registerStoryScenePieces,
  resetStoryScenePiecesRegistrationFlagForTests,
  storySceneFactories
} from "./storyScene";

/**
 * The story-scene piece contract (`docs/architecture/story-scene/spec-piece-contract.md`).
 *
 * §1 is the load-bearing rule, and it is subtle enough to be worth a test of its own:
 * `RecipeMount.renderNode` applies the pack's CSS variables and vfx class **only on the
 * factory-free path** (`RecipeMount.tsx:43-44`). A registered factory returns early
 * (`:35-41`) and therefore renders **unthemed** unless it applies the theme itself. Without this
 * rule every story-scene piece would silently ignore its pack: the packs would resolve, and the
 * paint would never reach the DOM.
 */
describe("piece contract — a factory must apply its own theme", () => {
  beforeEach(() => clearPieceRegistryForTests());
  afterEach(() => clearPieceRegistryForTests());

  const themedPayload = {
    piece: "themed-chip",
    instanceId: "chip:1",
    phase: "ready" as const,
    themeResolved: {
      css: { "--piece-accent": "#6fb7d4" },
      vfx: { select: "vfx.actor.penny" }
    }
  };

  it("applies pack paint for a factory-free piece (the mount's own fallback path)", () => {
    const recipe: RecipeDocument = {
      surfaceId: "fx-theme-fallback",
      root: { piece: "unregistered", instanceId: "r", bind: "vm" }
    };
    const plan = bindSurface(recipe, { ...themedPayload, piece: "unregistered" });
    const { container } = render(<RecipeMount plan={plan} bus={createSurfaceBus()} />);
    const root = container.querySelector("[data-piece='unregistered']") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#6fb7d4");
    expect(root.className).toContain("vfx-actor-penny");
  });

  it("gives a registered factory NO theme unless the factory applies it", () => {
    // Deliberately bare factory: proves the mount does not theme the factory path, which is
    // exactly why the contract tells every factory to apply the helpers itself.
    registerPiece({
      pieceId: "bare-factory",
      slots: [],
      factory: ({ payload }) => <div className="bare" data-instance={payload.instanceId} />
    });
    const recipe: RecipeDocument = {
      surfaceId: "fx-theme-bare",
      root: { piece: "bare-factory", instanceId: "r", bind: "vm" }
    };
    const plan = bindSurface(recipe, { ...themedPayload, piece: "bare-factory" });
    const { container } = render(<RecipeMount plan={plan} bus={createSurfaceBus()} />);
    const root = container.querySelector(".bare") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("");
    expect(root.className).not.toContain("vfx-actor-penny");
  });

  it("receives the theme when the factory applies the helpers, which is the contract", () => {
    registerPiece({
      pieceId: "themed-factory",
      slots: [],
      // The contract's shape, and the shape every story-scene piece must copy.
      factory: ({ payload }) => {
        const style = themeStyle(payload);
        const vfx = vfxClass(payload);
        return (
          <div className={["themed", vfx].filter(Boolean).join(" ")} style={style} data-instance={payload.instanceId} />
        );
      }
    });
    const recipe: RecipeDocument = {
      surfaceId: "fx-theme-applied",
      root: { piece: "themed-factory", instanceId: "r", bind: "vm" }
    };
    const plan = bindSurface(recipe, { ...themedPayload, piece: "themed-factory" });
    const { container } = render(<RecipeMount plan={plan} bus={createSurfaceBus()} />);
    const root = container.querySelector(".themed") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#6fb7d4");
    expect(root.className).toContain("vfx-actor-penny");
  });

  it("maps a vfx id to a class by replacing dots (so a pack id is CSS-safe)", () => {
    expect(vfxClass({ ...themedPayload })).toBe("vfx-actor-penny");
    expect(themeStyle({ ...themedPayload })).toEqual({ "--piece-accent": "#6fb7d4" });
    expect(vfxClass({ piece: "p", instanceId: "i", phase: "ready" })).toBeUndefined();
    expect(themeStyle({ piece: "p", instanceId: "i", phase: "ready" })).toBeUndefined();
  });
});

/**
 * G1. A missing factory is the silent failure this group exists to prevent: `RecipeMount`
 * renders a themed `<div>` with no error, so a scene with unregistered pieces looks almost right
 * while every piece's own markup is gone. The group module must be the one place a story-scene
 * piece is registered, and its slot map must cover every factory.
 */
describe("story-scene piece group", () => {
  afterEach(() => {
    clearPieceRegistryForTests();
    resetStoryScenePiecesRegistrationFlagForTests();
  });

  it("exports a slot map covering every factory it declares", () => {
    for (const pieceId of Object.keys(storySceneFactories)) {
      expect(STORY_SCENE_SLOT_MAP[pieceId]).toBeDefined();
      expect(Array.isArray(STORY_SCENE_SLOT_MAP[pieceId])).toBe(true);
    }
    for (const pieceId of Object.keys(STORY_SCENE_SLOT_MAP)) {
      expect(storySceneFactories[pieceId]).toBeDefined();
    }
  });

  it("pins the shared slot vocabulary, so a piece or the recipe cannot invent a name", () => {
    // T12–T19's pieces and T21's recipe bind against this closed set. An invented slot name
    // fails silently at mount time (bindSurface resolves it to undefined), which is why it is
    // pinned rather than left to convention.
    expect([...STORY_SCENE_SHARED_SLOTS].sort()).toEqual(
      ["actors", "advance", "nameTag", "progress", "window"].sort()
    );
  });

  it("declares only shared slot names in the per-piece slot map", () => {
    const allowed = new Set<string>(STORY_SCENE_SHARED_SLOTS);
    for (const [pieceId, slots] of Object.entries(STORY_SCENE_SLOT_MAP)) {
      for (const slot of slots) {
        expect(allowed.has(slot), `${pieceId} declares unknown slot "${slot}"`).toBe(true);
      }
    }
  });

  it("has no slot map entry without a factory, and no factory without a slot map entry", () => {
    // The invariant stated as one assertion, so the two tables cannot drift apart.
    expect(Object.keys(STORY_SCENE_SLOT_MAP).sort()).toEqual(Object.keys(storySceneFactories).sort());
  });

  /**
   * The registration seam itself. The group starts empty (pieces land T12–T19), so this test
   * installs a fixture piece first — otherwise it would iterate an empty table and assert nothing,
   * which is exactly the vacuity the gate flagged.
   */
  it("registers every declared factory, so none can render as a silent fallback div", () => {
    const fixtureId = "story-scene-fixture-piece";
    storySceneFactories[fixtureId] = ({ slots }) => (
      <div className="story-scene-fixture">
        {STORY_SCENE_SLOT_MAP[fixtureId].map((slot) => (
          <span key={slot}>{slots[slot]}</span>
        ))}
      </div>
    );
    STORY_SCENE_SLOT_MAP[fixtureId] = [];
    try {
      registerStoryScenePieces();

      expect(getPiece(fixtureId), `unregistered piece: ${fixtureId}`).toBeDefined();
      // A fixture-free group would make this vacuous; assert the table was non-empty at call time.
      expect(Object.keys(storySceneFactories).length).toBeGreaterThan(0);
      expect(listPieces().map((p) => p.pieceId)).toContain(fixtureId);
    } finally {
      delete storySceneFactories[fixtureId];
      delete STORY_SCENE_SLOT_MAP[fixtureId];
    }
  });

  it("is idempotent — a second call neither throws nor duplicates", () => {
    registerStoryScenePieces();
    registerStoryScenePieces();
    registerStoryScenePieces();

    // Idempotent: the guard flag makes repeats a re-bind, never a duplicate registration.
    const ids = listPieces().map((p) => p.pieceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => registerStoryScenePieces()).not.toThrow();
  });

  it("re-binds after the registration flag is reset (the HMR / long-runner path)", () => {
    resetStoryScenePiecesRegistrationFlagForTests();
    expect(() => registerStoryScenePieces()).not.toThrow();
  });
});

/**
 * §7 — where a piece's CSS lives. Every story-scene CSS module sits beside the pieces and scopes
 * every rule under its own root class (`badgePieces.css`/`conditionConsole.css` are the shipped
 * precedent), never a global selector. The z-index half of the rule is already enforced tree-wide
 * by `bandGuard.scanForStrayZIndex`, which scans `.css`; this covers the half nothing else does.
 *
 * It is a real-tree scan, so it is trivially satisfied today (no piece CSS exists yet) and starts
 * enforcing itself the moment T12+ lands a CSS module — the same shape `bandGuard`'s own real-tree
 * test uses. A fixture case proves the scan is not vacuous.
 */
describe("story-scene piece CSS convention", () => {
  const cssDir = join(__dirname, "..", "..", "story-scene");
  const rootClassPattern = /^\.story-|^\.actor-|^\.scene-|^\.name-|^\.dialogue-|^\.advance-|^\.cue-/;

  function selectorsIn(css: string): string[] {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((block) => block.split("{")[0]?.trim() ?? "")
      .filter((sel) => sel.length > 0 && !sel.startsWith("@"))
      .flatMap((sel) => sel.split(",").map((s) => s.trim()))
      .filter(Boolean);
  }

  it("scopes every rule in a story-scene CSS module under a piece root class", () => {
    if (!existsSync(cssDir)) return;
    for (const file of readdirSync(cssDir).filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(join(cssDir, file), "utf8");
      for (const selector of selectorsIn(css)) {
        expect(
          rootClassPattern.test(selector),
          `${file}: selector "${selector}" is not scoped under a piece root class`
        ).toBe(true);
      }
    }
  });

  it("the scoping scan would catch an unscoped selector (fixture, so the rule has teeth)", () => {
    const bad = "body { color: red; }\n.story-actor-sprite { display: block; }\n";
    const offenders = selectorsIn(bad).filter((sel) => !rootClassPattern.test(sel));
    expect(offenders).toEqual(["body"]);
  });
});
