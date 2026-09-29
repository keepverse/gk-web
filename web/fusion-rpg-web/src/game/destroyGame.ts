import type Phaser from "phaser";
import { emitKernelObs } from "./kernelObs";

/**
 * Shared island teardown (phaser-kernel `destroy-game`).
 * Order: kill tweens → optional scene shutdown → emitDestroyed → game.destroy(true)
 * with default noReturn (false). Page mutex held until Phaser emits `destroy`.
 *
 * Safety timeout is structural (jsdom / stub hang guard) — not a gameplay clamp.
 */
// Structural: refuse to hang forever if DESTROY never fires (tests / broken host).
const DESTROY_SETTLE_TIMEOUT_MS = 2000;

let pendingCount = 0;

export type DestroyGameOptions = {
  game: Phaser.Game | null;
  sceneKey: string;
  shutdown?: () => void;
  emitDestroyed: (generation: number) => void;
  generation: number;
};

export function destroyMutexPending(): boolean {
  return pendingCount > 0;
}

/** Throws if a destroy is in flight — call before constructing the next Phaser.Game. */
export function assertDestroySettled(): void {
  if (pendingCount > 0) {
    throw new Error(
      "[destroyGame] create refused: destroy mutex still pending (WebGL teardown in flight)"
    );
  }
}

/**
 * Resolves when no destroy is in flight. Hosts use this before create so StrictMode
 * remount waits instead of racing WebGL (assertDestroySettled remains the sync fail-fast).
 */
export function awaitDestroySettled(): Promise<void> {
  if (pendingCount === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const tick = () => {
      if (pendingCount === 0) {
        resolve();
        return;
      }
      setTimeout(tick, 16);
    };
    tick();
  });
}

/** Test helper — reset mutex if a prior test left it held. */
export function resetDestroyMutexForTests(): void {
  pendingCount = 0;
}

/**
 * Resolves after Phaser DESTROY (or equivalent). `noReturn` must stay false so the next
 * stage Game can follow on the same page.
 */
export function destroyGame(opts: DestroyGameOptions): Promise<void> {
  const { game, sceneKey, shutdown, emitDestroyed, generation } = opts;
  if (!game) return Promise.resolve();

  const anyGame = game as Phaser.Game & { isDestroyed?: boolean };
  if (anyGame.isDestroyed) {
    emitKernelObs("destroyGame", {
      event: "already-destroyed",
      sceneKey,
      generation
    });
    return Promise.resolve();
  }

  pendingCount += 1;
  emitKernelObs("destroyGame", {
    event: "destroy-begin",
    sceneKey,
    generation,
    pending: pendingCount
  });

  const release = () => {
    if (pendingCount > 0) pendingCount -= 1;
    emitKernelObs("destroyGame", {
      event: "destroy-settled",
      sceneKey,
      generation,
      pending: pendingCount
    });
  };

  try {
    for (const scene of game.scene.getScenes(true)) {
      scene.tweens?.killAll();
    }
  } catch {
    /* scene graph may already be torn */
  }

  try {
    if (shutdown) {
      shutdown();
    } else {
      const scene = game.scene.getScene(sceneKey) as { shutdown?: () => void } | null;
      scene?.shutdown?.();
    }
  } catch {
    /* scene may already be gone */
  }

  emitDestroyed(generation);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      release();
      resolve();
    };

    try {
      game.events.once("destroy", finish);
    } catch {
      finish();
      return;
    }

    try {
      // noReturn defaults false — do not pass true while another stage Game can follow.
      game.destroy(true);
    } catch {
      finish();
      return;
    }

    setTimeout(finish, DESTROY_SETTLE_TIMEOUT_MS);
  });
}
