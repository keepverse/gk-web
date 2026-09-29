import { beforeEach, describe, expect, it, vi } from "vitest";
import { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import type { FxPool } from "../fx/FxPool";
import {
  clearStatusFxRings,
  tickStatusFx
} from "./StatusFxSystem";

function fakeGo(x = 10, y = 20) {
  return {
    x,
    y,
    setAlpha: vi.fn(),
    destroy: vi.fn()
  };
}

function fakeRing() {
  return {
    setPosition: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };
}

function fakeFx(): FxPool & { rings: ReturnType<typeof fakeRing>[] } {
  const rings: ReturnType<typeof fakeRing>[] = [];
  return {
    rings,
    acquireRing: vi.fn(() => {
      const ring = fakeRing();
      rings.push(ring);
      return ring;
    }),
    release: vi.fn(),
    drain: vi.fn()
  } as never;
}

describe("StatusFxSystem", () => {
  beforeEach(() => {
    // Ensure no leftover map entries across tests (release via a throwaway pool).
    clearStatusFxRings(fakeFx());
  });

  it("select acquires a ring and positions it on the occupant", () => {
    const registry = new PtrEntityRegistry();
    const go = fakeGo(40, 50);
    registry.set({
      ptr: "0x1",
      side: "plant",
      typeId: 1,
      chips: [],
      selected: true,
      go: go as never
    });
    const fx = fakeFx();

    tickStatusFx(registry, fx, 16);

    expect(fx.acquireRing).toHaveBeenCalledTimes(1);
    expect(fx.rings[0]!.setPosition).toHaveBeenCalledWith(40, 50);
  });

  it("deselect releases the ring", () => {
    const registry = new PtrEntityRegistry();
    const go = fakeGo();
    registry.set({
      ptr: "0x2",
      side: "plant",
      typeId: 1,
      chips: [],
      selected: true,
      go: go as never
    });
    const fx = fakeFx();

    tickStatusFx(registry, fx, 16);
    const ring = fx.rings[0]!;

    registry.set({
      ptr: "0x2",
      side: "plant",
      typeId: 1,
      chips: [],
      selected: false,
      go: go as never
    });
    tickStatusFx(registry, fx, 16);

    expect(fx.release).toHaveBeenCalledWith(ring);
  });

  it("clearStatusFxRings releases in-use rings and empties the map (destroy leak regression)", () => {
    const registry = new PtrEntityRegistry();
    registry.set({
      ptr: "0x3",
      side: "zombie",
      typeId: 2,
      chips: [],
      selected: true,
      go: fakeGo() as never
    });
    const fx = fakeFx();
    tickStatusFx(registry, fx, 16);
    expect(fx.acquireRing).toHaveBeenCalledTimes(1);
    const ring = fx.rings[0]!;

    clearStatusFxRings(fx);

    expect(fx.release).toHaveBeenCalledWith(ring);

    // A second clear with a fresh pool must not re-release the old ring.
    const fx2 = fakeFx();
    clearStatusFxRings(fx2);
    expect(fx2.release).not.toHaveBeenCalled();
  });
});
