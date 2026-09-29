import type { CellGeometry } from "./pickCell";
import { terrainAt, type CellTerrain, type GridPos, type GridSpec } from "./GridSpec";

/**
 * base-defense `board-render` (module 16): terrain is painted once per distinct `GridSpec` and cached
 * — "redrawing a static grid per frame is the obvious first implementation and it is the one that
 * makes a large board stutter" (spec-board-render.md §3). `district-layout`'s own stability contract
 * (S1-S4) guarantees a board's `GridSpec` rarely changes, so a cheap reference check is enough
 * invalidation — no deep comparison, matching this codebase's existing revision/reference-based
 * change checks (e.g. `lawnSyncGate`'s own `revision`-based gate) rather than diffing cell arrays.
 */

export type TerrainPaintRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type TerrainSink = {
  /** Clears whatever this sink previously painted, before a repaint. */
  clear(): void;
  /** Paints one cell's terrain at its pixel rect. Called once per cell, only while (re)baking. */
  paintCell(pos: GridPos, terrain: CellTerrain, rect: TerrainPaintRect): void;
};

export type TerrainCache = {
  /**
   * Paints `sink` for `spec` unless `spec` is the exact same `GridSpec` reference already painted —
   * safe to call every frame; it repaints only when the reference changes.
   */
  ensure(spec: GridSpec): void;
};

export function createTerrainCache(sink: TerrainSink, geometry: CellGeometry): TerrainCache {
  let painted: GridSpec | null = null;
  return {
    ensure(spec: GridSpec): void {
      if (spec === painted) return;
      sink.clear();
      for (let row = 0; row < spec.rows; row++) {
        for (let col = 0; col < spec.cols; col++) {
          const pos: GridPos = { row, col };
          sink.paintCell(pos, terrainAt(spec, pos), {
            x: geometry.originX + col * geometry.cellWidth,
            y: geometry.originY + row * geometry.cellHeight,
            width: geometry.cellWidth,
            height: geometry.cellHeight
          });
        }
      }
      painted = spec;
    }
  };
}

/**
 * A real Phaser `RenderTexture` satisfies this with no adapter (`clear()` and `fill(rgb, alpha, x, y,
 * w, h)` are both real `RenderTexture` methods) — baking terrain into one texture instead of leaving a
 * live `Graphics` object in the display list, per this module's own "cached to a render texture" line.
 * Not wired into any scene yet — `LawnWorldScene`'s own terrain today already renders correctly via
 * its existing `Graphics`+depth approach (see this task's own todo.md evidence for why that retrofit
 * is deferred); this adapter exists so a future consumer (siege/battle, or that retrofit) has one.
 */
export function createRenderTextureTerrainSink(
  renderTexture: { clear(): unknown; fill(rgb: number, alpha: number, x: number, y: number, width: number, height: number): unknown },
  colorFor: (terrain: CellTerrain) => number
): TerrainSink {
  return {
    clear: () => {
      renderTexture.clear();
    },
    paintCell: (_pos, terrain, rect) => {
      renderTexture.fill(colorFor(terrain), 1, rect.x, rect.y, rect.width, rect.height);
    }
  };
}
