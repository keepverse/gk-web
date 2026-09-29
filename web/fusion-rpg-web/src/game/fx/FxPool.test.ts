import { describe, expect, it, vi } from "vitest";
import { FxPool } from "./FxPool";

function fakeArc() {
  return {
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setPosition: vi.fn().mockReturnThis()
  };
}

function fakeScene() {
  const arcs: ReturnType<typeof fakeArc>[] = [];
  return {
    add: {
      circle: vi.fn(() => {
        const arc = fakeArc();
        arcs.push(arc);
        return arc;
      })
    },
    tweens: {
      killTweensOf: vi.fn()
    },
    _arcs: arcs
  };
}

describe("FxPool", () => {
  it("acquireRing creates a new arc when the free list is empty", () => {
    const scene = fakeScene();
    const pool = new FxPool(scene as never);

    const ring = pool.acquireRing();

    expect(scene.add.circle).toHaveBeenCalledTimes(1);
    expect(ring).toBe(scene._arcs[0]);
  });

  it("release then acquire reuses the same arc", () => {
    const scene = fakeScene();
    const pool = new FxPool(scene as never);

    const first = pool.acquireRing();
    pool.release(first as never);
    const second = pool.acquireRing();

    expect(second).toBe(first);
    expect(scene.add.circle).toHaveBeenCalledTimes(1);
    expect(first.setActive).toHaveBeenCalledWith(true);
    expect(first.setVisible).toHaveBeenCalledWith(true);
  });

  it("drain destroys every free ring and empties the pool", () => {
    const scene = fakeScene();
    const pool = new FxPool(scene as never);

    const a = pool.acquireRing();
    const b = pool.acquireRing();
    pool.release(a as never);
    pool.release(b as never);
    pool.drain();

    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
    // After drain, next acquire must create fresh.
    pool.acquireRing();
    expect(scene.add.circle).toHaveBeenCalledTimes(3);
  });
});
