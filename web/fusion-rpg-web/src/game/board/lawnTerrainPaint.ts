import type Phaser from "phaser";
import { createBoardLayers, type BoardLayers } from "../board/BoardLayers";
import {
  CELL_H,
  CELL_W,
  ORIGIN_X,
  ORIGIN_Y
} from "../gridMath";

/**
 * Graphics-compatible lawn terrain paint via BoardLayers (lock 4c default).
 * Command list matches the former ensureGrid checkerboard — reversible oracle.
 */
export function paintLawnTerrainGraphics(
  scene: Phaser.Scene,
  layers: BoardLayers,
  rows: number,
  cols: number,
  previous?: Phaser.GameObjects.Graphics | null
): Phaser.GameObjects.Graphics {
  previous?.destroy();
  const g = scene.add.graphics();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ORIGIN_X + c * CELL_W;
      const y = ORIGIN_Y + r * CELL_H;
      g.fillStyle((r + c) % 2 === 0 ? 0x221c16 : 0x2a231b, 0.9);
      g.fillRect(x, y, CELL_W - 2, CELL_H - 2);
      g.lineStyle(1, 0x3d6b45, 0.45);
      g.strokeRect(x, y, CELL_W - 2, CELL_H - 2);
    }
  }
  layers.terrain.add(g);
  return g;
}

export function createLawnBoardLayers(scene: Phaser.Scene): BoardLayers {
  return createBoardLayers(scene.add);
}
