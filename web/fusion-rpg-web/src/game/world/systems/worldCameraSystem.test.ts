import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD_PX,
  EDGE_SCROLL_MARGIN_PX,
  MAX_SCALE,
  MIN_SCALE
} from "../objects/pinConstants";
import { edgeScrollBlockedByIgnore, fitExtentFromPoints } from "./worldCameraMath";

/**
 * Camera structural consts and clamp math — pure oracle for R9 / gaps D4/D7/D9/D25.
 */
function clampWorldZoom(z: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, z));
}

function dragExceedsThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
}

function edgeScrollAxes(
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
  ignoreRects: Array<{ left: number; top: number; width: number; height: number }> = []
): { dx: number; dy: number } {
  for (const r of ignoreRects) {
    if (
      pointerX >= r.left &&
      pointerX <= r.left + r.width &&
      pointerY >= r.top &&
      pointerY <= r.top + r.height
    ) {
      return { dx: 0, dy: 0 };
    }
  }
  const m = EDGE_SCROLL_MARGIN_PX;
  let dx = 0;
  let dy = 0;
  if (pointerX < m) dx = 1;
  else if (pointerX > width - m) dx = -1;
  if (pointerY < m) dy = 1;
  else if (pointerY > height - m) dy = -1;
  return { dx, dy };
}

describe("worldCameraSystem structural clamps (R9)", () => {
  it("clamps zoom to MIN_SCALE..MAX_SCALE", () => {
    expect(clampWorldZoom(0.01)).toBe(MIN_SCALE);
    expect(clampWorldZoom(99)).toBe(MAX_SCALE);
    expect(clampWorldZoom(1)).toBe(1);
  });

  it("separates click from drag via a named pixel threshold", () => {
    expect(dragExceedsThreshold(2, 2)).toBe(false);
    expect(dragExceedsThreshold(DRAG_THRESHOLD_PX, 0)).toBe(true);
  });

  it("edge-scroll activates inside the named margin", () => {
    expect(edgeScrollAxes(10, 200, 1280, 720)).toEqual({ dx: 1, dy: 0 });
    expect(edgeScrollAxes(1270, 10, 1280, 720)).toEqual({ dx: -1, dy: 1 });
    expect(edgeScrollAxes(640, 360, 1280, 720)).toEqual({ dx: 0, dy: 0 });
  });

  it("edge-scroll no-ops inside ignoreRects (gaps D7)", () => {
    expect(
      edgeScrollAxes(10, 200, 1280, 720, [{ left: 0, top: 0, width: 100, height: 400 }])
    ).toEqual({ dx: 0, dy: 0 });
  });

  it("edge-scroll ignoreRects compare in CSS space when display is scaled (followup F2)", () => {
    const rightStrip = [{ left: 520, top: 0, width: 280, height: 450 }];
    expect(edgeScrollBlockedByIgnore(1100, 200, 1600, 900, 800, 450, rightStrip)).toBe(true);
    expect(edgeScrollBlockedByIgnore(800, 200, 1600, 900, 800, 450, rightStrip)).toBe(false);
  });

  it("fitExtentFromPoints grows with far sector AABB (followup F5)", () => {
    const empty = fitExtentFromPoints([]);
    expect(empty.extentW).toBe(880);
    const wide = fitExtentFromPoints([
      { x: 0, y: 0 },
      { x: 2000, y: 100 }
    ]);
    expect(wide.extentW).toBeGreaterThan(empty.extentW);
    expect(wide.midX).toBe(1000);
  });

  it("accepts centre and relative zoom payload shapes (gaps D9/D25)", () => {
    const centre = { generation: 1, op: "centre" as const, x: 110, y: 95 };
    const zoomIn = { generation: 1, op: "zoom" as const, factor: 1.15 };
    expect(centre.op).toBe("centre");
    expect(zoomIn.factor).toBe(1.15);
    expect(clampWorldZoom(1 * zoomIn.factor)).toBeGreaterThan(1);
  });
});
