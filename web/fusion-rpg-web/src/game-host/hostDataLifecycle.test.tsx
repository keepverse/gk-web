/**
 * Production host data-lifecycle cutover gate (phaser-kernel host-data-lifecycle).
 * ScenePOC timings alone are insufficient — these tests drive LawnGameHost / WorldGameHost.
 *
 * Rules under test:
 * 1. Buffer until ready
 * 2. Foreign generation drop
 * 3. Track-B remount — new generation; old handlers do not apply
 * 4. Latest wins — newest buffered revision/modelSeq after ready
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import {
  lawnBusClearAll,
  lawnBusEmit,
  lawnBusOn,
  resetGameGenerationForTests,
  worldBusClearAll,
  worldBusEmit,
  worldBusOn
} from "@/game/EventBus";
import { resetDestroyMutexForTests } from "@/game/destroyGame";

const fakeGame = {
  scale: { resize: vi.fn() },
  registry: { set: vi.fn(), get: vi.fn() },
  scene: { getScenes: () => [], getScene: () => null },
  destroy: vi.fn()
} as unknown as Phaser.Game;

const createLawnGame = vi.fn(() => fakeGame);
const destroyLawnGame = vi.fn(async () => undefined);
const createWorldGame = vi.fn(() => fakeGame);
const destroyWorldGame = vi.fn(async () => undefined);

vi.mock("@/game/createLawnGame", () => ({
  createLawnGame: (...args: unknown[]) => createLawnGame(...(args as [])),
  destroyLawnGame: (...args: unknown[]) => destroyLawnGame(...(args as []))
}));

vi.mock("@/game/createWorldGame", () => ({
  createWorldGame: (...args: unknown[]) => createWorldGame(...(args as [])),
  destroyWorldGame: (...args: unknown[]) => destroyWorldGame(...(args as []))
}));

import { LawnGameHost } from "@/features/lawn/LawnGameHost";
import { WorldGameHost } from "@/stages/world/host/WorldGameHost";
import { emptyLawnViewModel } from "@/features/lawn/lawnViewModel";
import { idleInteraction } from "@/features/lawn/interactionMode";
import type { AdaptedWorldState } from "@/contract/adapt";

const emptyLawn = (revision: number) => emptyLawnViewModel({ revision });
const idle = idleInteraction();

const emptyWorld: AdaptedWorldState = {
  sectors: [],
  lanes: [],
  slotsBySectorId: {},
  forcesBySectorId: {}
};

describe("hostDataLifecycle — production hosts (not ScenePOC-only)", () => {
  beforeEach(() => {
    lawnBusClearAll();
    worldBusClearAll();
    resetGameGenerationForTests();
    resetDestroyMutexForTests();
    createLawnGame.mockClear();
    destroyLawnGame.mockClear();
    createWorldGame.mockClear();
    destroyWorldGame.mockClear();
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  it("1 lawn buffer-until-ready: pre-ready model applies once after ready (same generation)", () => {
    const models: Array<{ revision: number; generation: number }> = [];
    lawnBusOn("lawn:model", (raw) => {
      const p = raw as { revision: number; generation: number };
      models.push({ revision: p.revision, generation: p.generation });
    });

    render(
      <LawnGameHost
        model={emptyLawn(3)}
        interaction={idle}
        viewMode="split"
        onSelect={() => {}}
      />
    );
    expect(models).toHaveLength(0);
    const generation = createLawnGame.mock.calls[0]![0].generation as number;
    act(() => {
      lawnBusEmit("lawn:ready", { generation });
    });
    expect(models).toHaveLength(1);
    expect(models[0]).toEqual({ revision: 3, generation });
  });

  it("2 lawn foreign generation drop: ready for other gen does not flush buffer", () => {
    const models: unknown[] = [];
    lawnBusOn("lawn:model", (raw) => models.push(raw));

    render(
      <LawnGameHost
        model={emptyLawn(1)}
        interaction={idle}
        viewMode="split"
        onSelect={() => {}}
      />
    );
    const generation = createLawnGame.mock.calls[0]![0].generation as number;
    act(() => {
      lawnBusEmit("lawn:ready", { generation: generation + 99 });
    });
    expect(models).toHaveLength(0);
    act(() => {
      lawnBusEmit("lawn:ready", { generation });
    });
    expect(models).toHaveLength(1);
  });

  it("3+4 lawn Track-B remount + latest wins: newest revision after remount; old gen ignored", () => {
    const models: Array<{ revision: number; generation: number }> = [];
    lawnBusOn("lawn:model", (raw) => {
      const p = raw as { revision: number; generation: number };
      models.push({ revision: p.revision, generation: p.generation });
    });

    const { unmount, rerender } = render(
      <LawnGameHost
        model={emptyLawn(1)}
        interaction={idle}
        viewMode="split"
        onSelect={() => {}}
      />
    );
    const gen1 = createLawnGame.mock.calls[0]![0].generation as number;
    // Buffer supersedes — latest revision wins before ready
    rerender(
      <LawnGameHost
        model={emptyLawn(5)}
        interaction={idle}
        viewMode="split"
        onSelect={() => {}}
      />
    );
    act(() => {
      lawnBusEmit("lawn:ready", { generation: gen1 });
    });
    expect(models).toEqual([{ revision: 5, generation: gen1 }]);

    unmount();
    models.length = 0;
    createLawnGame.mockClear();

    render(
      <LawnGameHost
        model={emptyLawn(9)}
        interaction={idle}
        viewMode="split"
        onSelect={() => {}}
      />
    );
    const gen2 = createLawnGame.mock.calls[0]![0].generation as number;
    expect(gen2).not.toBe(gen1);
    act(() => {
      // Old generation must not flush into the new host
      lawnBusEmit("lawn:ready", { generation: gen1 });
    });
    expect(models).toHaveLength(0);
    act(() => {
      lawnBusEmit("lawn:ready", { generation: gen2 });
    });
    expect(models).toEqual([{ revision: 9, generation: gen2 }]);
  });

  it("1 world buffer-until-ready + 4 latest modelSeq wins after ready", () => {
    const models: Array<{ modelSeq: number; generation: number }> = [];
    worldBusOn("world:model", (raw) => {
      const p = raw as { modelSeq: number; generation: number };
      models.push({ modelSeq: p.modelSeq, generation: p.generation });
    });

    const { rerender } = render(
      <WorldGameHost model={emptyWorld} overlayEpoch={0} onSelect={() => {}} />
    );
    expect(models).toHaveLength(0);
    rerender(
      <WorldGameHost model={emptyWorld} overlayEpoch={2} onSelect={() => {}} />
    );
    const generation = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation });
    });
    expect(models).toHaveLength(1);
    expect(models[0]!.modelSeq).toBe(1);
    expect(models[0]!.generation).toBe(generation);
  });

  it("2+3 world foreign generation drop across Track-B remount", () => {
    const models: Array<{ generation: number }> = [];
    worldBusOn("world:model", (raw) => {
      models.push({ generation: (raw as { generation: number }).generation });
    });

    const { unmount } = render(
      <WorldGameHost model={emptyWorld} overlayEpoch={1} onSelect={() => {}} />
    );
    const gen1 = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation: gen1 });
    });
    expect(models).toHaveLength(1);
    unmount();
    models.length = 0;
    createWorldGame.mockClear();

    render(
      <WorldGameHost model={emptyWorld} overlayEpoch={3} onSelect={() => {}} />
    );
    const gen2 = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation: gen1 });
    });
    expect(models).toHaveLength(0);
    act(() => {
      worldBusEmit("world:ready", { generation: gen2 });
    });
    expect(models).toEqual([{ generation: gen2 }]);
  });
});
