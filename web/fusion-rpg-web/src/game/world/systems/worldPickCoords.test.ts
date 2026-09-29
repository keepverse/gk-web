import { describe, expect, it } from "vitest";
import { cssToGamePoint, gameToCssPoint, worldToCameraScreen } from "./worldPickCoords";

describe("worldPickCoords", () => {
  it("round-trips when CSS and game sizes match", () => {
    const p = cssToGamePoint(100, 50, 800, 600, 800, 600);
    expect(p).toEqual({ x: 100, y: 50 });
    expect(gameToCssPoint(p.x, p.y, 800, 600, 800, 600)).toEqual({ x: 100, y: 50 });
  });

  it("maps CSS centre to game centre when display is scaled", () => {
    // Backing store 1600×900, CSS display 800×450 (0.5×).
    const game = cssToGamePoint(400, 225, 1600, 900, 800, 450);
    expect(game.x).toBeCloseTo(800);
    expect(game.y).toBeCloseTo(450);
    const css = gameToCssPoint(800, 450, 1600, 900, 800, 450);
    expect(css.x).toBeCloseTo(400);
    expect(css.y).toBeCloseTo(225);
  });

  it("worldToCameraScreen puts a Phaser-centerOn'd point at the viewport centre for any zoom", () => {
    // Phaser centerOnX: scrollX = worldX - width/2 (no /zoom).
    const camW = 1348;
    const camH = 870;
    const zoom = 1.287719298245614;
    const worldX = -770;
    const worldY = 95;
    const scrollX = worldX - camW * 0.5;
    const scrollY = worldY - camH * 0.5;
    const screen = worldToCameraScreen(worldX, worldY, scrollX, scrollY, zoom, camW, camH);
    expect(screen.x).toBeCloseTo(camW * 0.5, 5);
    expect(screen.y).toBeCloseTo(camH * 0.5, 5);
  });

  it("naive (world-scroll)*zoom drifts off-centre when zoom ≠ 1", () => {
    const camW = 1348;
    const zoom = 1.287719298245614;
    const worldX = -770;
    const scrollX = worldX - camW * 0.5;
    const naive = (worldX - scrollX) * zoom;
    expect(naive).not.toBeCloseTo(camW * 0.5, 0);
  });
});
