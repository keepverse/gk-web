import { describe, expect, it, vi } from "vitest";
import { bindCamera, computeCameraFit, type CameraModel, type ScaleSource } from "./bindCamera";
import type { CellGeometry } from "../board/pickCell";

const LAWN_GEOMETRY: CellGeometry = { cellWidth: 64, cellHeight: 72, originX: 48, originY: 56 };
const LAWN_MARGIN = 24;
const LAWN_MIN_ZOOM = 0.2;

function fakeScale(initial: { width: number; height: number }): ScaleSource & {
  fireResize: (size: { width: number; height: number }) => void;
} {
  let handler: ((size: { width: number; height: number }) => void) | undefined;
  return {
    gameSize: initial,
    on: (_event, h) => {
      handler = h;
    },
    off: vi.fn((_event, h) => {
      if (handler === h) handler = undefined;
    }),
    fireResize: (size) => handler?.(size)
  };
}

function fakeCamera() {
  return { setZoom: vi.fn(), centerOn: vi.fn() };
}

describe("computeCameraFit — pure, matches the lawn's own pre-extraction formula", () => {
  it("reproduces gridMath.lawnWorldSize's own +margin contain-fit and center-of-grid", () => {
    const model: CameraModel = { rows: 5, cols: 9 };
    const viewport = { width: 800, height: 600 };
    const fit = computeCameraFit(model, LAWN_GEOMETRY, viewport, LAWN_MARGIN);

    const worldW = LAWN_GEOMETRY.originX + 9 * LAWN_GEOMETRY.cellWidth + LAWN_MARGIN;
    const worldH = LAWN_GEOMETRY.originY + 5 * LAWN_GEOMETRY.cellHeight + LAWN_MARGIN;
    expect(fit.zoom).toBeCloseTo(Math.min(800 / worldW, 600 / worldH));
    expect(fit.centerX).toBe(LAWN_GEOMETRY.originX + (9 * LAWN_GEOMETRY.cellWidth) / 2);
    expect(fit.centerY).toBe(LAWN_GEOMETRY.originY + (5 * LAWN_GEOMETRY.cellHeight) / 2);
  });

  it("a zero-size viewport falls back to zoom 1 rather than dividing by a degenerate size", () => {
    const fit = computeCameraFit({ rows: 5, cols: 9 }, LAWN_GEOMETRY, { width: 0, height: 0 }, LAWN_MARGIN);
    expect(fit.zoom).toBe(1);
  });

  it("a non-lawn geometry and margin still compute correctly — no lawn constant lives in this file", () => {
    const siegeGeometry: CellGeometry = { cellWidth: 40, cellHeight: 40, originX: 0, originY: 0 };
    const fit = computeCameraFit({ rows: 6, cols: 6 }, siegeGeometry, { width: 240, height: 240 }, 0);
    expect(fit.zoom).toBeCloseTo(1);
    expect(fit.centerX).toBe(120);
    expect(fit.centerY).toBe(120);
  });
});

describe("bindCamera — model authoritative, Phaser write-only", () => {
  it("binding performs no write on its own — the caller decides when the first fit happens", () => {
    const scale = fakeScale({ width: 800, height: 600 });
    const camera = fakeCamera();
    bindCamera({
      scale,
      camera,
      getModel: () => ({ rows: 5, cols: 9 }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });
    expect(camera.setZoom).not.toHaveBeenCalled();
    expect(camera.centerOn).not.toHaveBeenCalled();
  });

  it("refresh() writes exactly one zoom and one center call, matching computeCameraFit", () => {
    const scale = fakeScale({ width: 800, height: 600 });
    const camera = fakeCamera();
    const bridge = bindCamera({
      scale,
      camera,
      getModel: () => ({ rows: 5, cols: 9 }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });

    bridge.refresh();

    expect(camera.setZoom).toHaveBeenCalledTimes(1);
    expect(camera.centerOn).toHaveBeenCalledTimes(1);
    const expected = computeCameraFit({ rows: 5, cols: 9 }, LAWN_GEOMETRY, { width: 800, height: 600 }, LAWN_MARGIN);
    expect(camera.setZoom).toHaveBeenCalledWith(Math.max(LAWN_MIN_ZOOM, expected.zoom));
    expect(camera.centerOn).toHaveBeenCalledWith(expected.centerX, expected.centerY);
  });

  it("driving the model (a fresh refresh call) writes exactly once more, reading getModel afresh each time", () => {
    const scale = fakeScale({ width: 800, height: 600 });
    const camera = fakeCamera();
    let rows = 5;
    let cols = 9;
    const bridge = bindCamera({
      scale,
      camera,
      getModel: () => ({ rows, cols }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });

    bridge.refresh();
    camera.setZoom.mockClear();
    camera.centerOn.mockClear();

    rows = 3;
    cols = 20;
    bridge.refresh();

    expect(camera.setZoom).toHaveBeenCalledTimes(1);
    expect(camera.centerOn).toHaveBeenCalledTimes(1);
    const expected = computeCameraFit({ rows: 3, cols: 20 }, LAWN_GEOMETRY, { width: 800, height: 600 }, LAWN_MARGIN);
    expect(camera.centerOn).toHaveBeenCalledWith(expected.centerX, expected.centerY);
  });

  it("a resize event writes exactly once more, using the new viewport size", () => {
    const scale = fakeScale({ width: 800, height: 600 });
    const camera = fakeCamera();
    const bridge = bindCamera({
      scale,
      camera,
      getModel: () => ({ rows: 5, cols: 9 }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });
    bridge.refresh();
    camera.setZoom.mockClear();
    camera.centerOn.mockClear();

    scale.fireResize({ width: 1200, height: 900 });

    expect(camera.setZoom).toHaveBeenCalledTimes(1);
    expect(camera.centerOn).toHaveBeenCalledTimes(1);
    const expected = computeCameraFit({ rows: 5, cols: 9 }, LAWN_GEOMETRY, { width: 1200, height: 900 }, LAWN_MARGIN);
    expect(camera.setZoom).toHaveBeenCalledWith(Math.max(LAWN_MIN_ZOOM, expected.zoom));
  });

  it("the caller-supplied minZoom floors the write — a raw fit below it never reaches the camera", () => {
    const scale = fakeScale({ width: 10, height: 10 });
    const camera = fakeCamera();
    const bridge = bindCamera({
      scale,
      camera,
      getModel: () => ({ rows: 50, cols: 50 }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });

    bridge.refresh();

    const raw = computeCameraFit({ rows: 50, cols: 50 }, LAWN_GEOMETRY, { width: 10, height: 10 }, LAWN_MARGIN);
    expect(raw.zoom).toBeLessThan(LAWN_MIN_ZOOM);
    expect(camera.setZoom).toHaveBeenCalledWith(LAWN_MIN_ZOOM);
  });

  it("unbind removes exactly the listener this bridge registered, and no further resize triggers a write", () => {
    const scale = fakeScale({ width: 800, height: 600 });
    const camera = fakeCamera();
    const bridge = bindCamera({
      scale,
      camera,
      getModel: () => ({ rows: 5, cols: 9 }),
      geometry: LAWN_GEOMETRY,
      margin: LAWN_MARGIN,
      minZoom: LAWN_MIN_ZOOM
    });

    bridge.unbind();
    expect(scale.off).toHaveBeenCalledTimes(1);

    scale.fireResize({ width: 1200, height: 900 });
    expect(camera.setZoom).not.toHaveBeenCalled();
    expect(camera.centerOn).not.toHaveBeenCalled();
  });
});
