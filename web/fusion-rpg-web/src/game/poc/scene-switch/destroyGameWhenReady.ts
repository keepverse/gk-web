import Phaser from "phaser";

/**
 * Destroy a Phaser.Game and resolve only after the engine emits `destroy`
 * (destroy is next-frame async — see Phaser Game.destroy docs). POC Track B
 * and host unmount use this so the next createGame does not race a live WebGL context.
 */
export function destroyGameWhenReady(game: Phaser.Game | null): Promise<void> {
  if (!game) return Promise.resolve();
  // Phaser 4: isDestroyed may exist; treat already-gone as done.
  const anyGame = game as Phaser.Game & { isDestroyed?: boolean };
  if (anyGame.isDestroyed) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      game.events.once("destroy", finish);
    } catch {
      finish();
      return;
    }
    try {
      game.destroy(true);
    } catch {
      finish();
    }
    // Safety: if destroy event never fires (jsdom / stub), don't hang tests.
    setTimeout(finish, 2000);
  });
}
