import { describe, expect, it, vi } from "vitest";

// Real `phaser` pulls in a browser Canvas 2D context at module-load time (`checkInverseAlpha`),
// which throws under jsdom without the `canvas` npm package — the same reason
// `systems/syncOccupantBandB.test.ts` mocks it rather than importing the real module. Only the
// members `createGame.ts` actually reads at runtime need a mock; `Phaser.Types.*` are erased,
// type-only references and need nothing here.
vi.mock("phaser", () => ({
  default: {
    AUTO: "AUTO",
    Scale: { RESIZE: "RESIZE", NO_CENTER: "NO_CENTER" }
  }
}));

import Phaser from "phaser";
import { buildGameConfig } from "./createGame";

// A fake scene type is enough — buildGameConfig never inspects scene contents, only passes the
// array through, so this proves genericity without depending on any real Phaser.Scene subclass.
const FakeSceneA = class {} as unknown as Phaser.Types.Scenes.SceneType;
const FakeSceneB = class {} as unknown as Phaser.Types.Scenes.SceneType;

function fakeParent(clientWidth = 640, clientHeight = 480): HTMLElement {
  return { clientWidth, clientHeight } as unknown as HTMLElement;
}

describe("buildGameConfig", () => {
  it("passes the scenes array through unchanged, in order", () => {
    const config = buildGameConfig({
      parent: fakeParent(),
      scenes: [FakeSceneA, FakeSceneB],
      generation: 1
    });
    expect(config.scene).toEqual([FakeSceneA, FakeSceneB]);
  });

  it("writes generation into the registry via the preBoot callback", () => {
    const config = buildGameConfig({ parent: fakeParent(), scenes: [FakeSceneA], generation: 42 });
    const set = vi.fn();
    const fakeGame = { registry: { set } } as unknown as Phaser.Game;

    expect(typeof config.callbacks?.preBoot).toBe("function");
    config.callbacks!.preBoot!(fakeGame);

    expect(set).toHaveBeenCalledWith("generation", 42);
  });

  it("defaults width/height from the parent element when not specified", () => {
    const config = buildGameConfig({
      parent: fakeParent(800, 600),
      scenes: [FakeSceneA],
      generation: 1
    });
    expect(config.width).toBe(800);
    expect(config.height).toBe(600);
  });

  it("falls back to 640x480 when the parent reports zero size", () => {
    const config = buildGameConfig({
      parent: fakeParent(0, 0),
      scenes: [FakeSceneA],
      generation: 1
    });
    expect(config.width).toBe(640);
    expect(config.height).toBe(480);
  });

  it("an explicit width/height overrides the parent element's own size", () => {
    const config = buildGameConfig({
      parent: fakeParent(800, 600),
      scenes: [FakeSceneA],
      generation: 1,
      width: 1024,
      height: 768
    });
    expect(config.width).toBe(1024);
    expect(config.height).toBe(768);
  });

  it("defaults backgroundColor to the lawn's own historic value when not specified", () => {
    const config = buildGameConfig({ parent: fakeParent(), scenes: [FakeSceneA], generation: 1 });
    expect(config.backgroundColor).toBe("#16120e");
  });

  it("an explicit backgroundColor overrides the default", () => {
    const config = buildGameConfig({
      parent: fakeParent(),
      scenes: [FakeSceneA],
      generation: 1,
      backgroundColor: "#000000"
    });
    expect(config.backgroundColor).toBe("#000000");
  });

  it("scale mode is RESIZE with no auto-centering, matching the lawn's own pre-extraction config", () => {
    const config = buildGameConfig({ parent: fakeParent(), scenes: [FakeSceneA], generation: 1 });
    expect(config.scale?.mode).toBe(Phaser.Scale.RESIZE);
    expect(config.scale?.autoCenter).toBe(Phaser.Scale.NO_CENTER);
  });

  it("type is Phaser.AUTO", () => {
    const config = buildGameConfig({ parent: fakeParent(), scenes: [FakeSceneA], generation: 1 });
    expect(config.type).toBe(Phaser.AUTO);
  });
});
