import Phaser from "phaser";
import type { WorldCameraPayload, WorldIgnoreRect } from "../../EventBus";
import {
  DRAG_THRESHOLD_PX,
  EDGE_SCROLL_MARGIN_PX,
  MAX_SCALE,
  MIN_SCALE
} from "../objects/pinConstants";
import { edgeScrollBlockedByIgnore, fitExtentFromPoints } from "./worldCameraMath";

const STATE_KEY = "worldCamera";

type CameraWireState = {
  dragging: boolean;
  /** Set when a drag crosses threshold; pick consumes it on pointerup (gaps D4). */
  pickSuppress: boolean;
  dragStartX: number;
  dragStartY: number;
  camStartX: number;
  camStartY: number;
  pointerX: number;
  pointerY: number;
  getIgnoreRects: () => WorldIgnoreRect[];
  onLod?: () => void;
  offs: Array<() => void>;
};

const WHEEL_ZOOM_STEP = 1.15;
/** Edge-scroll speed — structural until a feel pass promotes it. */
const EDGE_SCROLL_SPEED = 0.35;

function state(scene: Phaser.Scene): CameraWireState {
  let s = scene.data.get(STATE_KEY) as CameraWireState | undefined;
  if (!s) {
    s = {
      dragging: false,
      pickSuppress: false,
      dragStartX: 0,
      dragStartY: 0,
      camStartX: 0,
      camStartY: 0,
      pointerX: 0,
      pointerY: 0,
      getIgnoreRects: () => [],
      offs: []
    };
    scene.data.set(STATE_KEY, s);
  }
  return s;
}

function clampZoom(z: number): number {
  return Phaser.Math.Clamp(z, MIN_SCALE, MAX_SCALE);
}

function applyPan(scene: Phaser.Scene, dx: number, dy: number): void {
  const cam = scene.cameras.main;
  cam.scrollX -= dx / cam.zoom;
  cam.scrollY -= dy / cam.zoom;
}

function applyZoomAboutScreenPoint(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
  nextZoom: number
): void {
  const cam = scene.cameras.main;
  const prevZoom = cam.zoom;
  if (nextZoom === prevZoom) return;
  const worldBefore = cam.getWorldPoint(screenX, screenY);
  cam.setZoom(nextZoom);
  const worldAfter = cam.getWorldPoint(screenX, screenY);
  cam.scrollX += worldBefore.x - worldAfter.x;
  cam.scrollY += worldBefore.y - worldAfter.y;
}

function applyZoomAboutPointer(scene: Phaser.Scene, pointer: Phaser.Input.Pointer, factor: number): void {
  const cam = scene.cameras.main;
  const nextZoom = clampZoom(cam.zoom * factor);
  applyZoomAboutScreenPoint(scene, pointer.x, pointer.y, nextZoom);
}

function applyFit(scene: Phaser.Scene, payload: WorldCameraPayload): void {
  const cam = scene.cameras.main;
  const padL = payload.padLeft ?? 0;
  const padR = payload.padRight ?? 0;
  const padT = payload.padTop ?? 0;
  const padB = payload.padBottom ?? 0;
  const viewW = scene.scale.width - padL - padR;
  const viewH = scene.scale.height - padT - padB;
  if (viewW <= 0 || viewH <= 0) return;

  // Prefer live pin AABB (followup F5); fall back to authored 4×3 grid.
  const points: Array<{ x: number; y: number }> = [];
  const registry = scene.data.get("worldRegistry") as
    | { sectorIds: () => string[]; getSector: (id: string) => Phaser.GameObjects.GameObject | undefined }
    | undefined;
  if (registry) {
    for (const id of registry.sectorIds()) {
      const go = registry.getSector(id) as Phaser.GameObjects.Container | undefined;
      if (!go || !go.active) continue;
      points.push({ x: go.x, y: go.y });
    }
  }
  const { extentW, extentH, midX, midY } = fitExtentFromPoints(points);

  const zoom = clampZoom(Math.min(viewW / extentW, viewH / extentH));
  cam.setZoom(zoom);
  cam.centerOn(midX, midY);
  cam.scrollX += padL / zoom;
  cam.scrollY += padT / zoom;
}

function applyCommand(scene: Phaser.Scene, payload: WorldCameraPayload): void {
  const cam = scene.cameras.main;
  switch (payload.op) {
    case "pan":
      applyPan(scene, payload.dx ?? 0, payload.dy ?? 0);
      break;
    case "zoom": {
      // HUD +/− zoom about viewport centre; absolute `scale` or relative `factor` (gaps D9).
      const next =
        payload.scale != null
          ? clampZoom(payload.scale)
          : clampZoom(cam.zoom * (payload.factor ?? 1));
      applyZoomAboutScreenPoint(scene, scene.scale.width / 2, scene.scale.height / 2, next);
      break;
    }
    case "fit":
      applyFit(scene, payload);
      break;
    case "centre":
      if (payload.x != null && payload.y != null) {
        cam.centerOn(payload.x, payload.y);
      }
      break;
    default:
      break;
  }
}

function wirePointer(
  scene: Phaser.Scene,
  onLod: () => void,
  getIgnoreRects: () => WorldIgnoreRect[] = () => []
): void {
  const s = state(scene);
  s.onLod = onLod;
  s.getIgnoreRects = getIgnoreRects;

  const onDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown()) return;
    s.dragging = false;
    s.pickSuppress = false;
    s.dragStartX = pointer.x;
    s.dragStartY = pointer.y;
    s.camStartX = scene.cameras.main.scrollX;
    s.camStartY = scene.cameras.main.scrollY;
    s.pointerX = pointer.x;
    s.pointerY = pointer.y;
  };

  const onMove = (pointer: Phaser.Input.Pointer) => {
    s.pointerX = pointer.x;
    s.pointerY = pointer.y;
    if (!pointer.isDown || pointer.rightButtonDown()) return;
    const dx = pointer.x - s.dragStartX;
    const dy = pointer.y - s.dragStartY;
    if (!s.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.dragging = true;
      s.pickSuppress = true;
    }
    scene.cameras.main.scrollX = s.camStartX - dx / scene.cameras.main.zoom;
    scene.cameras.main.scrollY = s.camStartY - dy / scene.cameras.main.zoom;
  };

  const onUp = () => {
    s.dragging = false;
    // pickSuppress stays until consumePickSuppress (gaps D4).
  };

  const onWheel = (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
    const factor = dy < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
    applyZoomAboutPointer(scene, scene.input.activePointer, factor);
    s.onLod?.();
  };

  scene.input.on("pointerdown", onDown);
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);
  scene.input.on("wheel", onWheel);

  s.offs.push(
    () => scene.input.off("pointerdown", onDown),
    () => scene.input.off("pointermove", onMove),
    () => scene.input.off("pointerup", onUp),
    () => scene.input.off("wheel", onWheel)
  );
}

function unwire(scene: Phaser.Scene): void {
  const s = scene.data.get(STATE_KEY) as CameraWireState | undefined;
  if (!s) return;
  for (const off of s.offs) off();
  s.offs = [];
  scene.data.remove(STATE_KEY);
}

/** True while the current gesture was a drag past threshold (gaps D4). Cleared on next pointerdown. */
function isPickSuppressed(scene: Phaser.Scene): boolean {
  const s = scene.data.get(STATE_KEY) as CameraWireState | undefined;
  return !!s?.pickSuppress;
}

function tickEdgeScroll(scene: Phaser.Scene, delta: number): void {
  const s = scene.data.get(STATE_KEY) as CameraWireState | undefined;
  if (!s) return;
  const canvas = scene.game.canvas as HTMLCanvasElement;
  const gameW = scene.scale.width;
  const gameH = scene.scale.height;
  // Edge-scroll no-ops inside ignoreRects (gaps D7) — CSS space (followup F2).
  if (
    edgeScrollBlockedByIgnore(
      s.pointerX,
      s.pointerY,
      gameW,
      gameH,
      canvas.clientWidth,
      canvas.clientHeight,
      s.getIgnoreRects()
    )
  ) {
    return;
  }
  const m = EDGE_SCROLL_MARGIN_PX;
  let dx = 0;
  let dy = 0;
  if (s.pointerX < m) dx = 1;
  else if (s.pointerX > gameW - m) dx = -1;
  if (s.pointerY < m) dy = 1;
  else if (s.pointerY > gameH - m) dy = -1;
  if (dx === 0 && dy === 0) return;
  const cam = scene.cameras.main;
  const speed = (EDGE_SCROLL_SPEED * delta) / cam.zoom;
  cam.scrollX -= dx * speed;
  cam.scrollY -= dy * speed;
}

export const worldCameraSystem = {
  applyCommand,
  wirePointer,
  unwire,
  tickEdgeScroll,
  isPickSuppressed,
  edgeScrollBlockedByIgnore,
  fitExtentFromPoints
};
