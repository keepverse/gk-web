import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    AUTO: "AUTO",
    Scale: { RESIZE: "RESIZE", NO_CENTER: "NO_CENTER" },
    Display: { Color: { HexStringToColor: () => ({ color: 0x2a241c }) } }
  }
}));

vi.mock("./world/scenes/WorldMapScene", () => ({
  WorldMapScene: class {}
}));

vi.mock("./world/snapshotTheme", () => ({
  snapshotTheme: () => ({
    soil: "#16120e",
    panel: "#2a241c",
    sun: "#e8c547",
    ink: "#f2ebe0",
    sidePlant: "#6fbf73",
    sideZombie: "#c45c5c",
    fontFamily: "serif"
  })
}));

vi.mock("./destroyGame", () => ({
  destroyGame: vi.fn(() => Promise.resolve()),
  assertDestroySettled: vi.fn()
}));

vi.mock("./EventBus", () => ({
  worldBusEmit: vi.fn()
}));

import { buildGameConfig } from "./createGame";
import { destroyGame } from "./destroyGame";
import { worldBusEmit } from "./EventBus";
import { WorldMapScene } from "./world/scenes/WorldMapScene";
import { destroyWorldGame } from "./createWorldGame";

describe("createWorldGame config shape", () => {
  it("would pass WorldMapScene alone (no BootScene)", () => {
    const parent = { clientWidth: 1280, clientHeight: 720 } as unknown as HTMLElement;
    const config = buildGameConfig({
      parent,
      scenes: [WorldMapScene as unknown as Phaser.Types.Scenes.SceneType],
      generation: 1,
      backgroundColor: "#16120e"
    });
    expect(config.scene).toHaveLength(1);
    expect(config.backgroundColor).toBe("#16120e");
  });
});

describe("destroyWorldGame facade", () => {
  beforeEach(() => {
    vi.mocked(destroyGame).mockClear();
    vi.mocked(worldBusEmit).mockClear();
  });

  it("delegates to destroyGame with WorldMapScene + generation", async () => {
    const game = { registry: {} } as never;
    await destroyWorldGame(game, 9);

    expect(destroyGame).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(destroyGame).mock.calls[0]![0]!;
    expect(arg.game).toBe(game);
    expect(arg.sceneKey).toBe("WorldMapScene");
    expect(arg.generation).toBe(9);

    arg.emitDestroyed?.(9);
    expect(worldBusEmit).toHaveBeenCalledWith("world:destroyed", { generation: 9 });
  });
});
