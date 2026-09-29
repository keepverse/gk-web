import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  resetGameGenerationForTests,
  allocGameGeneration
} from "@/game/EventBus";
import {
  destroyMutexPending,
  resetDestroyMutexForTests
} from "@/game/destroyGame";
import { usePhaserIslandHost } from "./usePhaserIslandHost";

function fakeGame(): Phaser.Game {
  return {
    scale: { resize: vi.fn() },
    destroy: vi.fn()
  } as unknown as Phaser.Game;
}

describe("usePhaserIslandHost", () => {
  beforeEach(() => {
    resetGameGenerationForTests();
    resetDestroyMutexForTests();
    // ResizeObserver stub for jsdom
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    resetDestroyMutexForTests();
  });

  it("creates once and awaits deferred destroy before next create", async () => {
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 640 });
    Object.defineProperty(parent, "clientHeight", { value: 480 });
    const parentRef = { current: parent };

    const creates: number[] = [];
    let resolveDestroy: (() => void) | null = null;

    const create = vi.fn(({ generation }: { generation: number }) => {
      creates.push(generation);
      return fakeGame();
    });

    const destroy = vi.fn((_game: Phaser.Game | null, _gen: number) => {
      return new Promise<void>((resolve) => {
        // Simulate destroyGame mutex: hold until test fires settle.
        // We bump pending via a real destroyGame path in other tests; here
        // just defer the promise the hook awaits on next boot via awaitDestroySettled.
        resolveDestroy = resolve;
      });
    });

    // First mount
    const { unmount, result } = renderHook(() =>
      usePhaserIslandHost({ parentRef, create, destroy })
    );

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(creates[0]).toBe(1);

    act(() => {
      result.current.notifyReady(1);
    });
    expect(result.current.readyRef.current).toBe(true);

    // Unmount starts deferred destroy
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);

    // Remount while destroy still pending — must wait.
    // Without mutex, create could race; with awaitDestroySettled alone and no
    // pending mutex, second create proceeds after microtask. Force mutex hold:
    const { destroyGame } = await import("@/game/destroyGame");
    const holdGame = {
      isDestroyed: false,
      scene: { getScenes: () => [], getScene: () => null },
      events: { once: (ev: string, fn: () => void) => {
        if (ev === "destroy") {
          // keep pending until we call finish
          (holdGame as { _finish?: () => void })._finish = fn;
        }
      } },
      destroy: vi.fn()
    };
    const hold = destroyGame({
      game: holdGame as never,
      sceneKey: "x",
      emitDestroyed: () => undefined,
      generation: 99
    });
    expect(destroyMutexPending()).toBe(true);

    const parentRef2 = { current: parent };
    const create2 = vi.fn(({ generation }: { generation: number }) => {
      creates.push(generation);
      return fakeGame();
    });
    const { unmount: unmount2 } = renderHook(() =>
      usePhaserIslandHost({
        parentRef: parentRef2,
        create: create2,
        destroy: async () => undefined
      })
    );

    // Still pending — create2 must not have run yet
    expect(create2).not.toHaveBeenCalled();

    (holdGame as { _finish?: () => void })._finish?.();
    await hold;
    resolveDestroy?.();

    await waitFor(() => expect(create2).toHaveBeenCalledTimes(1));
    unmount2();
  });

  it("notifyReady ignores foreign generation", async () => {
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 100 });
    Object.defineProperty(parent, "clientHeight", { value: 100 });
    const parentRef = { current: parent };
    const onReady = vi.fn();

    const { result, unmount } = renderHook(() =>
      usePhaserIslandHost({
        parentRef,
        create: () => fakeGame(),
        destroy: () => undefined,
        onReady
      })
    );

    await waitFor(() => expect(result.current.generationRef.current).toBe(1));

    act(() => {
      result.current.notifyReady(999);
    });
    expect(result.current.readyRef.current).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    act(() => {
      result.current.notifyReady(1);
    });
    expect(result.current.readyRef.current).toBe(true);
    expect(onReady).toHaveBeenCalledWith(1);

    unmount();
  });

  it("allocGameGeneration stays monotonic across helper", () => {
    expect(allocGameGeneration()).toBe(1);
    expect(allocGameGeneration()).toBe(2);
  });
});
