import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allocGameGeneration,
  lawnBusClearAll,
  lawnBusEmit,
  lawnBusOn
} from "./EventBus";
import { lawnIconTextureKey, lawnIconUrl } from "./iconUrl";
import { PtrEntityRegistry } from "./entities/PtrEntityRegistry";
import {
  CELL_H,
  CELL_W,
  ORIGIN_X,
  ORIGIN_Y,
  cellToWorld,
  lawnCameraZoom,
  lawnWorldSize,
  worldToCell
} from "./gridMath";
import { resetIconEpochMirrorForTests } from "./iconEpochMirror";
import { setApiBaseMirror, resetApiBaseMirrorForTests } from "./apiBaseMirror";
import { stackOffset } from "./stackLayout";

describe("EventBus generation", () => {
  afterEach(() => {
    lawnBusClearAll();
  });

  it("allocGameGeneration is monotonic unique", () => {
    const a = allocGameGeneration();
    const b = allocGameGeneration();
    expect(b).toBeGreaterThan(a);
  });

  it("emit fans out; unsub stops; clearAll empties", () => {
    const seen: unknown[] = [];
    const off = lawnBusOn("lawn:ready", (p) => seen.push(p));
    lawnBusEmit("lawn:ready", { generation: 1 });
    expect(seen).toHaveLength(1);
    off();
    lawnBusEmit("lawn:ready", { generation: 2 });
    expect(seen).toHaveLength(1);
    lawnBusOn("lawn:ready", (p) => seen.push(p));
    lawnBusClearAll();
    lawnBusEmit("lawn:ready", { generation: 3 });
    expect(seen).toHaveLength(1);
  });

  it("subscribers can drop foreign generation", () => {
    const mine = allocGameGeneration();
    const got: number[] = [];
    lawnBusOn("lawn:model", (raw) => {
      const p = raw as { generation: number };
      if (p.generation !== mine) return;
      got.push(p.generation);
    });
    lawnBusEmit("lawn:model", { generation: mine + 99, revision: 1, model: {} });
    lawnBusEmit("lawn:model", { generation: mine, revision: 2, model: {} });
    expect(got).toEqual([mine]);
  });

  it("lawn:viewMode fans out", () => {
    const seen: string[] = [];
    lawnBusOn("lawn:viewMode", (raw) => {
      seen.push((raw as { viewMode: string }).viewMode);
    });
    lawnBusEmit("lawn:viewMode", { generation: 1, viewMode: "stack" });
    expect(seen).toEqual(["stack"]);
  });
});

describe("lawnIconUrl", () => {
  afterEach(() => {
    resetIconEpochMirrorForTests();
    resetApiBaseMirrorForTests();
  });

  it("includes /api/icons path, epoch query, and uses apiBase mirror in DEV", () => {
    setApiBaseMirror(import.meta.env.DEV ? "http://127.0.0.1:5088" : "");
    const url = lawnIconUrl("plant", 3);
    expect(url).toContain("/api/icons/plant/3.png");
    expect(url).toMatch(/\?r=\d+/);
    if (import.meta.env.DEV) {
      expect(url.startsWith("http://127.0.0.1:5088")).toBe(true);
    }
  });

  it("lawnIconTextureKey includes epoch", () => {
    expect(lawnIconTextureKey("zombie", 7, 3)).toBe("icon-zombie-7-e3");
  });
});

describe("gridMath", () => {
  it("cellToWorld / worldToCell round-trip center", () => {
    const { x, y } = cellToWorld(2, 4);
    expect(x).toBe(ORIGIN_X + 4 * CELL_W + CELL_W / 2);
    expect(y).toBe(ORIGIN_Y + 2 * CELL_H + CELL_H / 2);
    expect(worldToCell(x, y, 5, 9)).toEqual({ row: 2, col: 4 });
  });

  it("worldToCell rejects out of bounds", () => {
    expect(worldToCell(0, 0, 5, 9)).toBeNull();
    expect(worldToCell(ORIGIN_X + 20 * CELL_W, ORIGIN_Y + CELL_H, 5, 9)).toBeNull();
  });

  it("lawnCameraZoom is contain-fill (min of both axes)", () => {
    const gw = ORIGIN_X + 9 * CELL_W + 24;
    const gh = ORIGIN_Y + 5 * CELL_H + 24;
    expect(lawnCameraZoom(1280, 720, 5, 9)).toBe(Math.min(1280 / gw, 720 / gh));
    expect(lawnCameraZoom(0, 480, 5, 9)).toBe(1);
    expect(lawnCameraZoom(640, 0, 5, 9)).toBe(1);
  });

  it("lawnWorldSize matches 12×5 canvas used by Split aspect-ratio", () => {
    const world = lawnWorldSize(5, 12);
    expect(world).toEqual({
      width: ORIGIN_X + 12 * CELL_W + 24,
      height: ORIGIN_Y + 5 * CELL_H + 24
    });
    expect(lawnCameraZoom(world.width, world.height, 5, 12)).toBe(1);
  });
});

describe("stackOffset", () => {
  it("plants stack left, zombies right, later index on top", () => {
    const plant = stackOffset("plant", 0, 3);
    const zombie = stackOffset("zombie", 2, 3);
    expect(plant.dx).toBeLessThan(0);
    expect(zombie.dx).toBeGreaterThan(0);
    expect(zombie.depth).toBeGreaterThan(stackOffset("zombie", 0, 3).depth);
  });

  it("single occupant has no y spread", () => {
    const one = stackOffset("plant", 0, 1);
    expect(one.dx).toBeLessThan(0);
    expect(one.dy).toBe(0);
  });
});

describe("PtrEntityRegistry", () => {
  it("normalizes ptr keys; entries/delete; destroys on clear", () => {
    const destroy = vi.fn();
    const reg = new PtrEntityRegistry();
    reg.set({
      ptr: "ab",
      side: "plant",
      typeId: 1,
      chips: [],
      selected: false,
      go: { destroy } as unknown as Phaser.GameObjects.Container
    });
    expect(reg.get("AB")).toBeDefined();
    expect(reg.keys()).toEqual(["AB"]);
    expect([...reg.entries()]).toHaveLength(1);
    expect(reg.delete("ab")?.ptr).toBe("ab");
    expect(reg.get("AB")).toBeUndefined();
    reg.set({
      ptr: "cd",
      side: "zombie",
      typeId: 2,
      chips: ["hypno"],
      selected: true,
      go: { destroy } as unknown as Phaser.GameObjects.Container
    });
    reg.clear();
    expect(destroy).toHaveBeenCalledWith(true);
    expect(reg.keys()).toHaveLength(0);
  });
});
