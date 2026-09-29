import Phaser from "phaser";
import { assertDestroySettled } from "./destroyGame";

/**
 * base-defense `board-render` (module 16): the generic board layer's game factory — `createGame`
 * takes scenes/background as caller-supplied options instead of hardcoding the lawn's own scene
 * list, so a siege board (and, per decision 40, a `battle` playback stage) can create a Phaser.Game
 * without cloning `createLawnGame`'s own body. Extracted from `createLawnGame.ts` — that function
 * becomes a thin wrapper calling this one with its own scenes, so the lawn renders byte-identically
 * afterward (this module's own acceptance bar for every extraction).
 */
export type CreateGameOptions = {
  parent: HTMLElement;
  scenes: Phaser.Types.Scenes.SceneType[];
  generation: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
};

/**
 * Pure: builds the `Phaser.Types.Core.GameConfig` object without ever constructing a real
 * `Phaser.Game` — kept separate from {@link createGame} so it is testable under jsdom, matching
 * this codebase's own existing discipline of never unit-testing a real Phaser.Game construction
 * (see `game.pure.test.ts`: only pure logic is exercised, Phaser internals are not).
 */
export function buildGameConfig(opts: CreateGameOptions): Phaser.Types.Core.GameConfig {
  const width = opts.width ?? (opts.parent.clientWidth || 640);
  const height = opts.height ?? (opts.parent.clientHeight || 480);

  return {
    type: Phaser.AUTO,
    width,
    height,
    parent: opts.parent,
    backgroundColor: opts.backgroundColor ?? "#16120e",
    scene: opts.scenes,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    callbacks: {
      preBoot: (g) => {
        g.registry.set("generation", opts.generation);
      }
    }
  };
}

export function createGame(opts: CreateGameOptions): Phaser.Game {
  assertDestroySettled();
  return new Phaser.Game(buildGameConfig(opts));
}
