import type { CellGeometry } from "../board/pickCell";

/**
 * base-defense `board-render` (module 16): a generic camera bridge — generalizing
 * `LawnWorldScene`'s own `fitCamera`/`onScaleResize` pair (a "contain" fit: zoom so the whole grid,
 * plus a margin, fills the viewport; center on the grid's own midpoint) into caller-supplied data, so
 * a siege board and the lawn can share one bridge instead of two.
 *
 * **Model authoritative, Phaser write-only**: this bridge only ever WRITES to the camera
 * (`setZoom`/`centerOn`), computed from the caller's `getModel()` and the current viewport size. It
 * never reads camera state back — `CameraSink` below exposes no getter, so there is nothing to read.
 * The lawn's own 0.2 zoom floor and 24px fit margin are NOT hardcoded here — both are required
 * caller-supplied numbers, so no lawn-specific value lives in this file.
 */

export type CameraSink = {
  setZoom(zoom: number): void;
  centerOn(x: number, y: number): void;
};

export type CameraViewport = { readonly width: number; readonly height: number };

/** Matches `Phaser.Scale.ScaleManager`'s own shape — the lawn passes `scene.scale` directly. */
export type ScaleSource = {
  readonly gameSize: CameraViewport;
  on(event: "resize", handler: (size: CameraViewport) => void): void;
  off(event: "resize", handler: (size: CameraViewport) => void): void;
};

export type CameraModel = { readonly rows: number; readonly cols: number };

export type BindCameraOptions = {
  readonly scale: ScaleSource;
  readonly camera: CameraSink;
  readonly getModel: () => CameraModel;
  readonly geometry: CellGeometry;
  /** Extra world-space padding added around the grid before fitting it to the viewport. */
  readonly margin: number;
  /** The zoom computed by the fit never goes below this floor. */
  readonly minZoom: number;
};

export type CameraBridge = {
  /** Recomputes the fit from the current model (and, if given, viewport) and writes it to the
   * camera — exactly one `setZoom` and one `centerOn` call. Call whenever the model may have
   * changed shape; falls back to the scale source's current size when no viewport is given. */
  refresh: (viewport?: CameraViewport) => void;
  /** Removes every listener this bridge registered. */
  unbind: () => void;
};

/**
 * Pure: the zoom-to-contain and center-of-grid for a model's shape inside a viewport, generalizing
 * `gridMath.lawnWorldSize`'s `+24` margin and `fitCamera`'s own center formula into explicit
 * parameters instead of hardcoded lawn constants.
 */
export function computeCameraFit(
  model: CameraModel,
  geometry: CellGeometry,
  viewport: CameraViewport,
  margin: number
): { zoom: number; centerX: number; centerY: number } {
  const worldW = geometry.originX + model.cols * geometry.cellWidth + margin;
  const worldH = geometry.originY + model.rows * geometry.cellHeight + margin;
  const zoom =
    viewport.width <= 0 || viewport.height <= 0
      ? 1
      : Math.min(viewport.width / worldW, viewport.height / worldH);
  return {
    zoom,
    centerX: geometry.originX + (model.cols * geometry.cellWidth) / 2,
    centerY: geometry.originY + (model.rows * geometry.cellHeight) / 2
  };
}

export function bindCamera(opts: BindCameraOptions): CameraBridge {
  const refresh = (viewport?: CameraViewport): void => {
    const vp = viewport ?? opts.scale.gameSize;
    const fit = computeCameraFit(opts.getModel(), opts.geometry, vp, opts.margin);
    opts.camera.setZoom(Math.max(opts.minZoom, fit.zoom));
    opts.camera.centerOn(fit.centerX, fit.centerY);
  };

  const onResize = (size: CameraViewport): void => refresh(size);
  opts.scale.on("resize", onResize);

  return {
    refresh,
    unbind: () => opts.scale.off("resize", onResize)
  };
}
