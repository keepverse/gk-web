import Phaser from "phaser";
import { createGame } from "./createGame";

/**
 * Thin siege facade — createGame({ scenes }) only (lock 5a).
 * Does not import LawnWorldScene. No SiegeBoardScene in this program.
 */
export type CreateSiegeGameOptions = {
  parent: HTMLElement;
  generation: number;
  scenes: Phaser.Types.Scenes.SceneType[];
  width?: number;
  height?: number;
  backgroundColor?: string;
};

export function createSiegeGame(opts: CreateSiegeGameOptions): Phaser.Game {
  return createGame({
    parent: opts.parent,
    generation: opts.generation,
    scenes: opts.scenes,
    width: opts.width,
    height: opts.height,
    backgroundColor: opts.backgroundColor
  });
}
