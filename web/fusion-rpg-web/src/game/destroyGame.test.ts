import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDestroySettled,
  destroyGame,
  destroyMutexPending,
  resetDestroyMutexForTests
} from "./destroyGame";

type FakeScene = {
  tweens: { killAll: ReturnType<typeof vi.fn> };
  shutdown?: ReturnType<typeof vi.fn>;
};

function makeFakeGame(opts?: {
  destroyDeferred?: boolean;
  isDestroyed?: boolean;
}) {
  const order: string[] = [];
  const tweensKill = vi.fn(() => {
    order.push("tweens");
  });
  const sceneShutdown = vi.fn(() => {
    order.push("shutdown");
  });
  const scene: FakeScene = {
    tweens: { killAll: tweensKill },
    shutdown: sceneShutdown
  };

  let destroyHandler: (() => void) | null = null;
  const game = {
    isDestroyed: opts?.isDestroyed ?? false,
    scene: {
      getScenes: () => [scene],
      getScene: (_key: string) => scene
    },
    events: {
      once: (ev: string, fn: () => void) => {
        if (ev === "destroy") destroyHandler = fn;
      }
    },
    destroy: vi.fn((_removeCanvas?: boolean, noReturn?: boolean) => {
      order.push(`destroy(true,noReturn=${String(noReturn)})`);
      if (opts?.destroyDeferred) {
        // Caller must fire destroyHandler later.
        return;
      }
      destroyHandler?.();
    })
  };

  return { game, order, scene, fireDestroy: () => destroyHandler?.() };
}

describe("destroyGame", () => {
  afterEach(() => {
    resetDestroyMutexForTests();
    vi.useRealTimers();
  });

  it("order: tweens → shutdown → emit → destroy(true) with default noReturn", async () => {
    const { game, order } = makeFakeGame();
    const emitDestroyed = vi.fn((generation: number) => {
      order.push(`emit(${generation})`);
    });

    await destroyGame({
      game: game as never,
      sceneKey: "LawnWorldScene",
      emitDestroyed,
      generation: 7
    });

    expect(order).toEqual([
      "tweens",
      "shutdown",
      "emit(7)",
      "destroy(true,noReturn=undefined)"
    ]);
    expect(emitDestroyed).toHaveBeenCalledWith(7);
    expect(destroyMutexPending()).toBe(false);
  });

  it("uses optional shutdown callback instead of scene lookup", async () => {
    const { game, order } = makeFakeGame();
    const customShutdown = vi.fn(() => {
      order.push("custom-shutdown");
    });

    await destroyGame({
      game: game as never,
      sceneKey: "WorldMapScene",
      shutdown: customShutdown,
      emitDestroyed: () => {
        order.push("emit");
      },
      generation: 1
    });

    expect(order).toContain("custom-shutdown");
    expect(customShutdown).toHaveBeenCalledTimes(1);
  });

  it("mutex refuses overlapping create while pending", async () => {
    vi.useFakeTimers();
    const { game, fireDestroy } = makeFakeGame({ destroyDeferred: true });

    const pending = destroyGame({
      game: game as never,
      sceneKey: "LawnWorldScene",
      emitDestroyed: () => undefined,
      generation: 1
    });

    expect(destroyMutexPending()).toBe(true);
    expect(() => assertDestroySettled()).toThrow(/destroy mutex still pending/);

    fireDestroy();
    await pending;
    expect(destroyMutexPending()).toBe(false);
    expect(() => assertDestroySettled()).not.toThrow();
  });

  it("null and already-destroyed games are no-ops", async () => {
    await destroyGame({
      game: null,
      sceneKey: "x",
      emitDestroyed: () => {
        throw new Error("should not emit");
      },
      generation: 1
    });

    const { game } = makeFakeGame({ isDestroyed: true });
    const emit = vi.fn();
    await destroyGame({
      game: game as never,
      sceneKey: "x",
      emitDestroyed: emit,
      generation: 1
    });
    expect(emit).not.toHaveBeenCalled();
    expect(game.destroy).not.toHaveBeenCalled();
  });

  it("safety timeout releases mutex if DESTROY never fires", async () => {
    vi.useFakeTimers();
    const { game } = makeFakeGame({ destroyDeferred: true });

    const pending = destroyGame({
      game: game as never,
      sceneKey: "LawnWorldScene",
      emitDestroyed: () => undefined,
      generation: 2
    });

    expect(destroyMutexPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(destroyMutexPending()).toBe(false);
  });
});
