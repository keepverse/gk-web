import Phaser from "phaser";
import {
  POC_MARKER_COUNT,
  POC_REGISTRY_ON_ACTIVE,
  type PocMode,
  type PocSceneVisual
} from "./pocKeys";

type OnActive = (mode: PocMode, atMs: number) => void;

/**
 * Shared fake board: checker-ish grid + N markers + mode label.
 * Intentionally not production BoardLayers / lawn paint.
 */
export abstract class PocModeScene extends Phaser.Scene {
  protected abstract readonly pocMode: PocMode;
  protected abstract readonly visual: PocSceneVisual;

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(this.visual.backgroundColor);
    this.paintGrid(width, height);
    this.paintMarkers(width, height);
    this.add
      .text(16, 16, this.visual.label, {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff"
      })
      .setScrollFactor(0)
      .setDepth(10);

    // scene.switch sleeps the caller and wakes the target — wake fires without re-create.
    this.events.on("wake", () => this.notifyActive());
    this.notifyActive();
  }

  private notifyActive(): void {
    const cb = this.registry.get(POC_REGISTRY_ON_ACTIVE) as OnActive | undefined;
    cb?.(this.pocMode, performance.now());
  }

  private paintGrid(width: number, height: number): void {
    const g = this.add.graphics();
    const cols = 8;
    const rows = 5;
    const cellW = width / cols;
    const cellH = height / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = (r + c) % 2 === 0 ? 0x000000 : 0xffffff;
        g.fillStyle(shade, 0.08);
        g.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  }

  private paintMarkers(width: number, height: number): void {
    for (let i = 0; i < POC_MARKER_COUNT; i++) {
      const x = ((i * 37) % Math.max(1, width - 40)) + 20;
      const y = ((i * 53) % Math.max(1, height - 40)) + 40;
      this.add.circle(x, y, 8, this.visual.markerColor, 0.9);
    }
  }
}
