import Phaser from "phaser";
import { createGame } from "./createGame";
import { worldBusEmit } from "./EventBus";
import { destroyGame } from "./destroyGame";
import { snapshotTheme } from "./world/snapshotTheme";
import { WorldMapScene } from "./world/scenes/WorldMapScene";

export type CreateWorldGameOptions = {
  parent: HTMLElement;
  generation: number;
  width?: number;
  height?: number;
};

/**
 * Facade: create Phaser.Game for the world map (RT-07).
 * Scene list is WorldMapScene only — no BootScene in v1.
 * Destroy order owned by {@link destroyGame}.
 */
export function createWorldGame(opts: CreateWorldGameOptions): Phaser.Game {
  const theme = snapshotTheme();
  const game = createGame({
    ...opts,
    scenes: [WorldMapScene],
    backgroundColor: theme.soil
  });
  game.registry.set("worldTheme", theme);
  return game;
}

export function destroyWorldGame(
  game: Phaser.Game | null,
  generation: number
): Promise<void> {
  return destroyGame({
    game,
    sceneKey: "WorldMapScene",
    emitDestroyed: (g) => worldBusEmit("world:destroyed", { generation: g }),
    generation
  });
}
