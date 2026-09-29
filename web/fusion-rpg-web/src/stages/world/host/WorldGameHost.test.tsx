import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { worldBusEmit, worldBusOn, worldBusClearAll } from "@/game/EventBus";
import { WorldGameHost } from "./WorldGameHost";
import type { AdaptedWorldState } from "@/contract/adapt";

const fakeGame = {
  scale: { resize: vi.fn() },
  registry: { set: vi.fn(), get: vi.fn() },
  scene: { getScenes: () => [], getScene: () => null },
  destroy: vi.fn()
} as unknown as Phaser.Game;

const createWorldGame = vi.fn(() => fakeGame);
const destroyWorldGame = vi.fn();

vi.mock("@/game/createWorldGame", () => ({
  createWorldGame: (...args: unknown[]) => createWorldGame(...(args as [])),
  destroyWorldGame: (...args: unknown[]) => destroyWorldGame(...(args as []))
}));

const emptyModel: AdaptedWorldState = {
  sectors: [],
  lanes: [],
  slotsBySectorId: {},
  forcesBySectorId: {}
};

describe("WorldGameHost", () => {
  beforeEach(() => {
    worldBusClearAll();
    createWorldGame.mockClear();
    destroyWorldGame.mockClear();
  });

  it("creates a Phaser game on mount and destroys on unmount", () => {
    const { unmount } = render(
      <WorldGameHost model={emptyModel} onSelect={() => {}} />
    );
    expect(createWorldGame).toHaveBeenCalledTimes(1);
    expect(createWorldGame.mock.calls[0]![0]).toMatchObject({ generation: expect.any(Number) });
    unmount();
    expect(destroyWorldGame).toHaveBeenCalledTimes(1);
  });

  it("exposes world-game-host and world-game-canvas testids", () => {
    const { getByTestId } = render(
      <WorldGameHost model={emptyModel} onSelect={() => {}} />
    );
    expect(getByTestId("world-game-host")).toBeInTheDocument();
    expect(getByTestId("world-game-canvas")).toBeInTheDocument();
  });

  it("buffers world:model until world:ready, then emits with monotonic modelSeq", () => {
    const models: Array<{ modelSeq: number }> = [];
    worldBusOn("world:model", (raw) => {
      models.push(raw as { modelSeq: number });
    });

    render(<WorldGameHost model={emptyModel} overlayEpoch={0} onSelect={() => {}} />);
    expect(models).toHaveLength(0);

    const generation = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation });
    });
    expect(models).toHaveLength(1);
    expect(models[0]!.modelSeq).toBe(1);
  });

  it("does not remount the game when selectedSectorId changes (GG-11)", () => {
    const { rerender } = render(
      <WorldGameHost model={emptyModel} selectedSectorId={null} onSelect={() => {}} />
    );
    expect(createWorldGame).toHaveBeenCalledTimes(1);
    rerender(
      <WorldGameHost model={emptyModel} selectedSectorId="homeworld" onSelect={() => {}} />
    );
    expect(createWorldGame).toHaveBeenCalledTimes(1);
    expect(destroyWorldGame).not.toHaveBeenCalled();
  });

  it("emits force selection on world:interaction (followup F3)", () => {
    const interactions: Array<{ selectedId: string | null; selectedKind: string | null }> = [];
    worldBusOn("world:interaction", (raw) => {
      const p = raw as { selectedId: string | null; selectedKind: string | null };
      interactions.push({ selectedId: p.selectedId, selectedKind: p.selectedKind ?? null });
    });

    const { rerender } = render(
      <WorldGameHost
        model={emptyModel}
        selectedSectorId={null}
        selectedEntityId={null}
        onSelect={() => {}}
      />
    );
    const generation = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation });
    });
    interactions.length = 0;

    rerender(
      <WorldGameHost
        model={emptyModel}
        selectedSectorId="homeworld"
        selectedEntityId="e-dave-legion-1"
        onSelect={() => {}}
      />
    );
    expect(interactions.at(-1)).toEqual({
      selectedId: "e-dave-legion-1",
      selectedKind: "force"
    });

    rerender(
      <WorldGameHost
        model={emptyModel}
        selectedSectorId="homeworld"
        selectedEntityId={null}
        onSelect={() => {}}
      />
    );
    expect(interactions.at(-1)).toEqual({
      selectedId: "homeworld",
      selectedKind: "sector"
    });
  });

  it("bumps modelSeq when ownerFactionId changes with identical intel (gaps D1)", () => {
    const models: Array<{ modelSeq: number }> = [];
    worldBusOn("world:model", (raw) => {
      models.push(raw as { modelSeq: number });
    });

    const sector = {
      sectorId: "homeworld",
      typeId: "wildland",
      climate: null,
      ownerFactionId: "dave",
      intel: "Watched" as const,
      intelAge: 0,
      phase: "Held",
      dangerBand: { unit: "count" as const, value: 0 },
      developmentLevel: { unit: "count" as const, value: 0 },
      stability: { unit: "perMilleRatio" as const, op: "flat" as const, value: 1000 },
      pressure: { unit: "perMilleRatio" as const, op: "flat" as const, value: 0 },
      fractureIntensity: { unit: "perMilleRatio" as const, op: "absolute" as const, value: 1000 },
      habitable: true,
      layoutX: 0,
      layoutY: 0,
      loam: {
        production: { unit: "loamUnits" as const, value: 0 },
        upkeep: { unit: "loamUnits" as const, value: 0 },
        net: { unit: "loamUnits" as const, value: 0 },
        stock: { unit: "loamUnits" as const, value: 0 },
        capacity: { state: "pending" as const, reason: "x" },
        upkeepBreakdown: {
          base: { unit: "loamUnits" as const, value: 0 },
          garrison: { unit: "loamUnits" as const, value: 0 },
          development: { unit: "loamUnits" as const, value: 0 },
          danger: { unit: "loamUnits" as const, value: 0 },
          intensityMilli: { unit: "perMilleRatio" as const, op: "absolute" as const, value: 1000 }
        }
      },
      component: {
        componentId: null,
        production: { unit: "loamUnits" as const, value: 0 },
        upkeep: { unit: "loamUnits" as const, value: 0 },
        net: { unit: "loamUnits" as const, value: 0 },
        stock: { unit: "loamUnits" as const, value: 0 }
      },
      willReleaseNextTurn: false,
      lifelineCost: { state: "pending" as const, reason: "x" },
      lifeline: { state: "pending" as const, reason: "x" },
      wardenBindingId: { state: "pending" as const, reason: "x" },
      neglectedTurns: { state: "pending" as const, reason: "x" }
    };

    const modelA: AdaptedWorldState = {
      sectors: [sector],
      lanes: [],
      slotsBySectorId: {},
      forcesBySectorId: {}
    };
    const modelB: AdaptedWorldState = {
      ...modelA,
      sectors: [{ ...sector, ownerFactionId: "zomboss" }]
    };

    const { rerender } = render(
      <WorldGameHost model={modelA} playerFactionId="dave" overlayEpoch={0} onSelect={() => {}} />
    );
    const generation = createWorldGame.mock.calls[0]![0].generation as number;
    act(() => {
      worldBusEmit("world:ready", { generation });
    });
    expect(models).toHaveLength(1);

    rerender(
      <WorldGameHost model={modelB} playerFactionId="dave" overlayEpoch={0} onSelect={() => {}} />
    );
    expect(models).toHaveLength(2);
    expect(models[1]!.modelSeq).toBe(2);
  });
});
