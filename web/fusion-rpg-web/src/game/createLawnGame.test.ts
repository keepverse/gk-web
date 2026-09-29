import { beforeEach, describe, expect, it, vi } from "vitest";

const registrySet = vi.fn();
const fakeGame = {
  registry: { set: registrySet, get: vi.fn() }
};

vi.mock("./createGame", () => ({
  createGame: vi.fn(() => fakeGame)
}));

vi.mock("./destroyGame", () => ({
  destroyGame: vi.fn(() => Promise.resolve())
}));

vi.mock("./EventBus", () => ({
  lawnBusEmit: vi.fn()
}));

vi.mock("./scenes/BootScene", () => ({
  BootScene: class {}
}));

vi.mock("./scenes/LawnWorldScene", () => ({
  LawnWorldScene: class {}
}));

vi.mock("phaser", () => ({
  default: {}
}));

import { createGame } from "./createGame";
import { destroyGame } from "./destroyGame";
import { lawnBusEmit } from "./EventBus";
import { createLawnGame, destroyLawnGame } from "./createLawnGame";

describe("createLawnGame", () => {
  beforeEach(() => {
    registrySet.mockClear();
    vi.mocked(createGame).mockClear();
    vi.mocked(destroyGame).mockClear();
    vi.mocked(lawnBusEmit).mockClear();
  });

  it("sets bootNextScene to LawnWorldScene on the registry (cell-boot)", () => {
    const parent = document.createElement("div");
    const game = createLawnGame({ parent, generation: 7 });

    expect(createGame).toHaveBeenCalledTimes(1);
    expect(registrySet).toHaveBeenCalledWith("bootNextScene", "LawnWorldScene");
    expect(game).toBe(fakeGame);
  });

  it("destroyLawnGame delegates to destroyGame with LawnWorldScene + generation", async () => {
    await destroyLawnGame(fakeGame as never, 3);

    expect(destroyGame).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(destroyGame).mock.calls[0]![0]!;
    expect(arg.game).toBe(fakeGame);
    expect(arg.sceneKey).toBe("LawnWorldScene");
    expect(arg.generation).toBe(3);

    arg.emitDestroyed?.(3);
    expect(lawnBusEmit).toHaveBeenCalledWith("lawn:destroyed", { generation: 3 });
  });
});
