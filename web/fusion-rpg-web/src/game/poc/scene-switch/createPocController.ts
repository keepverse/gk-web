import Phaser from "phaser";
import { createGame } from "@/game/createGame";
import { destroyGameWhenReady } from "./destroyGameWhenReady";
import {
  POC_MODES,
  POC_REGISTRY_ON_ACTIVE,
  type PocMode,
  sceneKeyForMode
} from "./pocKeys";
import { PocLawnScene, PocSiegeScene, PocWorldScene } from "./PocScenes";

export type PocTrack = "A" | "B";

export type PocController = {
  track: PocTrack;
  getGame: () => Phaser.Game | null;
  /** Stable object identity token for GG-11 assertions (same Game instance). */
  getGameIdentity: () => object | null;
  getMode: () => PocMode;
  switchTo: (mode: PocMode) => Promise<number>;
  destroy: () => Promise<void>;
};

function sceneClassFor(mode: PocMode): Phaser.Types.Scenes.SceneType {
  switch (mode) {
    case "world":
      return PocWorldScene;
    case "siege":
      return PocSiegeScene;
    case "lawn":
      return PocLawnScene;
  }
}

function orderedScenes(initial: PocMode): Phaser.Types.Scenes.SceneType[] {
  return [initial, ...POC_MODES.filter((m) => m !== initial)].map(sceneClassFor);
}

/**
 * Track A: one Game, all three scenes registered; travel via scene.switch.
 * Track B: one scene per Game; travel via destroy → createGame.
 */
export function createPocController(opts: {
  parent: HTMLElement;
  track: PocTrack;
  initialMode?: PocMode;
  generation: number;
}): PocController {
  const initialMode = opts.initialMode ?? "world";
  let mode = initialMode;
  let game: Phaser.Game | null = null;
  let gameIdentity: object | null = null;
  let pending: { mode: PocMode; t0: number; resolve: (ms: number) => void } | null =
    null;

  const onActive = (activeMode: PocMode, atMs: number) => {
    mode = activeMode;
    if (pending && pending.mode === activeMode) {
      const ms = Math.max(0, atMs - pending.t0);
      const { resolve } = pending;
      pending = null;
      resolve(ms);
    }
  };

  const mount = (m: PocMode): Phaser.Game => {
    const scenes = opts.track === "A" ? orderedScenes(m) : [sceneClassFor(m)];
    const g = createGame({
      parent: opts.parent,
      scenes,
      generation: opts.generation,
      backgroundColor: "#0e0e0e"
    });
    g.registry.set(POC_REGISTRY_ON_ACTIVE, onActive);
    game = g;
    gameIdentity = g;
    return g;
  };

  mount(initialMode);

  return {
    track: opts.track,
    getGame: () => game,
    getGameIdentity: () => gameIdentity,
    getMode: () => mode,
    async switchTo(next: PocMode) {
      if (next === mode && game) {
        // Still measure a no-op so Run-20 sample counts stay honest.
        return 0;
      }
      const t0 = performance.now();
      if (opts.track === "A") {
        if (!game) throw new Error("POC Track A: no game");
        const fromKey = sceneKeyForMode(mode);
        const toKey = sceneKeyForMode(next);
        return await new Promise<number>((resolve) => {
          pending = { mode: next, t0, resolve };
          // Game.scene is SceneManager — switch(from, to), not ScenePlugin.switch(key).
          game!.scene.switch(fromKey, toKey);
          setTimeout(() => {
            if (pending && pending.mode === next) {
              const ms = Math.max(0, performance.now() - pending.t0);
              pending = null;
              mode = next;
              resolve(ms);
            }
          }, 1500);
        });
      }
      await destroyGameWhenReady(game);
      game = null;
      return await new Promise<number>((resolve) => {
        pending = { mode: next, t0, resolve };
        mount(next);
        setTimeout(() => {
          if (pending && pending.mode === next) {
            const ms = Math.max(0, performance.now() - pending.t0);
            pending = null;
            mode = next;
            resolve(ms);
          }
        }, 1500);
      });
    },
    async destroy() {
      pending = null;
      await destroyGameWhenReady(game);
      game = null;
      gameIdentity = null;
    }
  };
}
