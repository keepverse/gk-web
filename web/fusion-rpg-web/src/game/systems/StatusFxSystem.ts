import type { FxPool } from "../fx/FxPool";
import type { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import type Phaser from "phaser";

/** ptr → select ring (scene-local; released via clearStatusFxRings before FxPool.drain). */
const selectRings = new Map<string, Phaser.GameObjects.Arc>();

/**
 * Cosmetic status pulse / select ring — not EffectBag RNG.
 * Wires FxPool.acquireRing for selected occupants (fx-facade).
 */
export function tickStatusFx(
  registry: PtrEntityRegistry,
  fx: FxPool,
  _delta: number
): void {
  const selected = new Set<string>();
  for (const rec of registry.entries()) {
    if (rec.chips.length > 0 || rec.selected) {
      const t = performance.now() / 400;
      const a = 0.75 + Math.sin(t) * 0.2;
      rec.go.setAlpha(a);
    } else {
      rec.go.setAlpha(1);
    }

    if (rec.selected) {
      selected.add(rec.ptr);
      let ring = selectRings.get(rec.ptr);
      if (!ring) {
        ring = fx.acquireRing();
        selectRings.set(rec.ptr, ring);
      }
      ring.setPosition(rec.go.x, rec.go.y);
    }
  }

  for (const [ptr, ring] of [...selectRings.entries()]) {
    if (!selected.has(ptr)) {
      fx.release(ring);
      selectRings.delete(ptr);
    }
  }
}

/**
 * Release every in-use select ring back to the pool and empty the map.
 * Call on scene shutdown **before** `fx.drain()` so rings are not abandoned.
 */
export function clearStatusFxRings(fx: FxPool): void {
  for (const ring of selectRings.values()) {
    fx.release(ring);
  }
  selectRings.clear();
}
