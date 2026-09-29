import { describe, expect, it } from "vitest";
import { INITIAL_CAMERA, cameraReducer } from "./cameraState";

describe("cameraReducer — pure pan/zoom/fit state (D5.4)", () => {
  it("pan adds the delta directly, independent of zoom", () => {
    const next = cameraReducer(INITIAL_CAMERA, { type: "pan", dx: 10, dy: -5 });
    expect(next).toEqual({ x: 10, y: -5, zoom: 1 });
  });

  it("zoom-by multiplies zoom and keeps the anchor point fixed in graph space", () => {
    const start = { x: 0, y: 0, zoom: 1 };
    const next = cameraReducer(start, { type: "zoom-by", factor: 2, anchor: { x: 100, y: 100 } });
    expect(next.zoom).toBe(2);
    // The anchor's own graph-space point must round-trip: (anchor - x) / zoom is invariant.
    expect((100 - next.x) / next.zoom).toBeCloseTo((100 - start.x) / start.zoom);
  });

  it("zoom-by clamps to the configured min/max rather than growing unbounded", () => {
    let state = INITIAL_CAMERA;
    for (let i = 0; i < 40; i++) {
      state = cameraReducer(state, { type: "zoom-by", factor: 2, anchor: { x: 0, y: 0 } });
    }
    expect(state.zoom).toBeLessThanOrEqual(2.5);

    state = INITIAL_CAMERA;
    for (let i = 0; i < 40; i++) {
      state = cameraReducer(state, { type: "zoom-by", factor: 0.5, anchor: { x: 0, y: 0 } });
    }
    expect(state.zoom).toBeGreaterThanOrEqual(0.4);
  });

  it("a zoom-by that would not change the clamped zoom is a true no-op (same object identity)", () => {
    let state = INITIAL_CAMERA;
    for (let i = 0; i < 40; i++) {
      state = cameraReducer(state, { type: "zoom-by", factor: 2, anchor: { x: 0, y: 0 } });
    }
    const pinned = cameraReducer(state, { type: "zoom-by", factor: 2, anchor: { x: 0, y: 0 } });
    expect(pinned).toBe(state);
  });

  it("fit centres the bounds in the viewport at the largest zoom that still fits both axes", () => {
    const next = cameraReducer(INITIAL_CAMERA, {
      type: "fit",
      bounds: { minX: 0, minY: 0, width: 200, height: 100 },
      viewport: { width: 400, height: 400 }
    });
    // width-constrained: 400/200 = 2, height 400/100 = 4 -> min is 2, then clamped to MAX_ZOOM (2.5) — 2 wins.
    expect(next.zoom).toBe(2);
    // The bounds' own centre (100, 50) lands on the viewport's own centre (200, 200) at that zoom.
    expect(next.x + 100 * next.zoom).toBeCloseTo(200);
    expect(next.y + 50 * next.zoom).toBeCloseTo(200);
  });

  it("fit is a no-op against a zero-size viewport rather than dividing by zero", () => {
    const next = cameraReducer(INITIAL_CAMERA, {
      type: "fit",
      bounds: { minX: 0, minY: 0, width: 200, height: 100 },
      viewport: { width: 0, height: 0 }
    });
    expect(next).toBe(INITIAL_CAMERA);
  });

  it("reset returns to the initial camera", () => {
    const panned = cameraReducer(INITIAL_CAMERA, { type: "pan", dx: 500, dy: 500 });
    expect(cameraReducer(panned, { type: "reset" })).toEqual(INITIAL_CAMERA);
  });
});
