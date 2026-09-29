import { describe, expect, it } from "vitest";
import {
  buildWorldIgnoreRects,
  fitPadLeft,
  FALLBACK_DOCK_W,
  FALLBACK_RIGHT_W,
  rectRelativeToCanvas,
  SHELL_RAIL_WIDTH_PX
} from "./worldIgnoreRects";

describe("buildWorldIgnoreRects — canvas CSS space (gaps D7 / D22)", () => {
  it("omits the 92px shell-rail strip when the canvas already sits beside the rail", () => {
    const rects = buildWorldIgnoreRects({
      width: 1188,
      height: 720,
      dockOpen: false,
      canvasBesideRail: true
    });

    expect(rects.some((r) => r.left === 0 && r.width === SHELL_RAIL_WIDTH_PX && r.height === 720)).toBe(
      false
    );
    // Homeworld / left pins stay pickable: nothing claims only the leftmost 92px of the canvas.
    const leftStrip = rects.filter((r) => r.left === 0 && r.width <= SHELL_RAIL_WIDTH_PX);
    expect(leftStrip).toEqual([]);
  });

  it("includes a 92px left strip only when the canvas still underlays the rail", () => {
    const rects = buildWorldIgnoreRects({
      width: 1280,
      height: 720,
      dockOpen: false,
      canvasBesideRail: false
    });

    expect(rects).toContainEqual({ left: 0, top: 0, width: SHELL_RAIL_WIDTH_PX, height: 720 });
  });

  it("dock ignore is 380px from canvas left — not 92+380", () => {
    const rects = buildWorldIgnoreRects({
      width: 1188,
      height: 720,
      dockOpen: true,
      canvasBesideRail: true
    });

    expect(rects).toContainEqual({ left: 0, top: 0, width: 380, height: 720 });
    expect(rects.some((r) => r.left === 0 && r.width === 92 + 380)).toBe(false);
  });

  it("publishes top strip, bottom-left HUD, and right chrome column", () => {
    const rects = buildWorldIgnoreRects({
      width: 1000,
      height: 800,
      dockOpen: false,
      canvasBesideRail: true
    });

    expect(rects).toContainEqual({ left: 0, top: 0, width: 1000, height: 56 });
    expect(rects).toContainEqual({ left: 0, top: 600, width: 200, height: 200 });
    expect(rects).toContainEqual({ left: 720, top: 0, width: 280, height: 800 });
  });

  it("uses measured anchors when provided (followup F6)", () => {
    const rects = buildWorldIgnoreRects({
      width: 1000,
      height: 800,
      dockOpen: false,
      canvasBesideRail: true,
      measured: {
        top: { left: 0, top: 0, width: 1000, height: 72 },
        bottomLeft: { left: 0, top: 650, width: 240, height: 150 },
        right: { left: 700, top: 0, width: 300, height: 800 }
      }
    });
    expect(rects).toContainEqual({ left: 0, top: 0, width: 1000, height: 72 });
    expect(rects).toContainEqual({ left: 0, top: 650, width: 240, height: 150 });
    expect(rects).toContainEqual({ left: 700, top: 0, width: 300, height: 800 });
    expect(rects.some((r) => r.width === FALLBACK_RIGHT_W && r.left === 720)).toBe(false);
  });

  it("fitPadLeft widens when dock is open (followup F5)", () => {
    expect(fitPadLeft(false)).toBe(100);
    expect(fitPadLeft(true)).toBe(FALLBACK_DOCK_W);
    expect(fitPadLeft(true, 420)).toBe(420);
  });

  it("rectRelativeToCanvas subtracts canvas origin", () => {
    const canvas = { left: 92, top: 30, width: 1000, height: 800, right: 1092, bottom: 830 } as DOMRect;
    const el = { left: 92, top: 30, width: 1000, height: 56, right: 1092, bottom: 86 } as DOMRect;
    expect(rectRelativeToCanvas(canvas, el)).toEqual({ left: 0, top: 0, width: 1000, height: 56 });
  });
});
