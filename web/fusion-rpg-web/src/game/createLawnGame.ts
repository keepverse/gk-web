import Phaser from "phaser";
import { createGame } from "./createGame";
import { BootScene } from "./scenes/BootScene";
import { LawnWorldScene } from "./scenes/LawnWorldScene";
import { lawnBusEmit } from "./EventBus";
import { destroyGame } from "./destroyGame";

export type CreateLawnGameOptions = {
  parent: HTMLElement;
  generation: number;
  width?: number;
  height?: number;
};

/**
 * Facade: create Phaser.Game and destroy checklist (RT-07).
 * Destroy order owned by {@link destroyGame}.
 *
 * base-defense `board-render`: a thin wrapper over the generic `createGame` factory, supplying the
 * lawn's own scene list — byte-identical to this function's own pre-extraction body (same width/
 * height defaults, same "#16120e" background, same scene array, same preBoot generation write).
 * Sets `bootNextScene` so BootScene injects LawnWorldScene (cell-boot).
 */
export function createLawnGame(opts: CreateLawnGameOptions): Phaser.Game {
  const game = createGame({ ...opts, scenes: [BootScene, LawnWorldScene] });
  game.registry.set("bootNextScene", "LawnWorldScene");
  return game;
}

export function destroyLawnGame(
  game: Phaser.Game | null,
  generation: number
): Promise<void> {
  return destroyGame({
    game,
    sceneKey: "LawnWorldScene",
    emitDestroyed: (g) => lawnBusEmit("lawn:destroyed", { generation: g }),
    generation
  });
}
