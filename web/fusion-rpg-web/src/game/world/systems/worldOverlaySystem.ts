import Phaser from "phaser";
import type { WorldInteractionPayload } from "../../EventBus";
import { reasonFor } from "@/stages/world/inspector/reasonFor";
import type { WorldTheme } from "../snapshotTheme";
import type { WorldRegistry } from "../entities/WorldRegistry";
import type { ZoomTier } from "../zoomTier";
import {
  planWorldOverlay,
  type OverlayCommand,
  type OverlayDrawCounts,
  type OverlayModelSlice,
  type TargetingPlanInput
} from "./worldOverlayPlan";

const ROOT_NAME = "world-overlay-root";
const TEXT_KEY = "worldOverlayTexts";
const TYPE_FLOOR_PX = 12;

export type WorldOverlayInput = {
  scene: Phaser.Scene;
  theme: WorldTheme;
  registry: WorldRegistry;
  model: unknown;
  interaction: WorldInteractionPayload | null;
  lens: string;
  tier: ZoomTier;
};

function rootGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  let g = scene.children.getByName(ROOT_NAME) as Phaser.GameObjects.Graphics | null;
  if (!g) {
    g = scene.add.graphics();
    g.setName(ROOT_NAME);
    g.setDepth(50);
  }
  g.clear();
  return g;
}

function clearOverlayTexts(scene: Phaser.Scene): void {
  const prev = scene.data.get(TEXT_KEY) as Phaser.GameObjects.Text[] | undefined;
  if (prev) {
    for (const t of prev) t.destroy();
  }
  scene.data.set(TEXT_KEY, []);
}

function addOverlayText(
  scene: Phaser.Scene,
  theme: WorldTheme,
  x: number,
  y: number,
  text: string,
  fontSizePx = TYPE_FLOOR_PX
): void {
  if (fontSizePx < TYPE_FLOOR_PX) return;
  const t = scene.add.text(x, y, text, {
    fontFamily: theme.fontFamily,
    fontSize: `${fontSizePx}px`,
    color: theme.ink
  });
  t.setOrigin(0.5);
  t.setDepth(51);
  const list = (scene.data.get(TEXT_KEY) as Phaser.GameObjects.Text[] | undefined) ?? [];
  list.push(t);
  scene.data.set(TEXT_KEY, list);
}

function clear(scene: Phaser.Scene): void {
  clearOverlayTexts(scene);
  const g = scene.children.getByName(ROOT_NAME) as Phaser.GameObjects.Graphics | null;
  g?.clear();
  g?.destroy();
}

function asModel(model: unknown): OverlayModelSlice | null {
  if (model == null || typeof model !== "object") return null;
  return model as OverlayModelSlice;
}

function selectionPos(
  registry: WorldRegistry,
  selectedId: string | null | undefined,
  selectedKind: string | null | undefined
): { x: number; y: number } | null {
  if (!selectedId) return null;
  if (selectedKind === "force") {
    const force = registry.getForce(selectedId) as Phaser.GameObjects.Container | undefined;
    if (force) return { x: force.x, y: force.y };
    return null;
  }
  const pin = registry.getSector(selectedId) as Phaser.GameObjects.Container | undefined;
  if (pin) return { x: pin.x, y: pin.y };
  return null;
}

function ink(theme: WorldTheme): number {
  return Phaser.Display.Color.HexStringToColor(theme.ink).color;
}

function sun(theme: WorldTheme): number {
  return Phaser.Display.Color.HexStringToColor(theme.sun).color;
}

function plant(theme: WorldTheme): number {
  return Phaser.Display.Color.HexStringToColor(theme.sidePlant).color;
}

function panel(theme: WorldTheme): number {
  return Phaser.Display.Color.HexStringToColor(theme.panel).color;
}

function strokeDashedLine(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLen: number,
  gapLen: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  let t = 0;
  let draw = true;
  while (t < len) {
    const seg = Math.min(draw ? dashLen : gapLen, len - t);
    const ax = x1 + ux * t;
    const ay = y1 + uy * t;
    const bx = x1 + ux * (t + seg);
    const by = y1 + uy * (t + seg);
    if (draw) g.lineBetween(ax, ay, bx, by);
    t += seg;
    draw = !draw;
  }
}

function drawHatch(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  density: number,
  color: number
): void {
  const lines = Math.max(2, Math.round(3 + density * 6));
  g.lineStyle(1, color, 0.55 + density * 0.35);
  for (let i = 0; i < lines; i++) {
    const t = (i / (lines - 1)) * 2 - 1;
    const ox = t * radius * 0.7;
    g.lineBetween(x + ox - radius * 0.3, y - radius * 0.5, x + ox + radius * 0.3, y + radius * 0.5);
  }
}

function drawCommand(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  theme: WorldTheme,
  cmd: OverlayCommand
): void {
  switch (cmd.kind) {
    case "selection-halo": {
      g.lineStyle(3, sun(theme), 0.95);
      g.strokeCircle(cmd.x, cmd.y, cmd.radius);
      break;
    }
    case "range-ring": {
      const color = cmd.hops <= 2 ? plant(theme) : panel(theme);
      g.lineStyle(2, color, 0.75);
      if (cmd.dash === "dashed") {
        const steps = 32;
        for (let i = 0; i < steps; i += 2) {
          const a0 = (i / steps) * Math.PI * 2;
          const a1 = ((i + 1) / steps) * Math.PI * 2;
          g.beginPath();
          g.arc(cmd.x, cmd.y, cmd.radius, a0, a1, false);
          g.strokePath();
        }
      } else {
        g.strokeCircle(cmd.x, cmd.y, cmd.radius);
      }
      addOverlayText(scene, theme, cmd.x, cmd.y, String(cmd.hops));
      break;
    }
    case "route-segment": {
      g.lineStyle(3, sun(theme), 0.85);
      strokeDashedLine(g, cmd.x1, cmd.y1, cmd.x2, cmd.y2, 10, 6);
      break;
    }
    case "destination-flag": {
      g.fillStyle(sun(theme), 0.95);
      g.fillTriangle(cmd.x, cmd.y - 22, cmd.x + 10, cmd.y - 14, cmd.x, cmd.y - 10);
      g.lineStyle(2, ink(theme), 0.9);
      g.lineBetween(cmd.x, cmd.y - 22, cmd.x, cmd.y - 4);
      break;
    }
    case "blocked-mark": {
      if (cmd.treatment === "inert") {
        addOverlayText(scene, theme, cmd.x, cmd.y, "…");
        break;
      }
      g.lineStyle(3, ink(theme), 0.95);
      const r = 16;
      g.lineBetween(cmd.x - r, cmd.y - r, cmd.x + r, cmd.y + r);
      g.lineBetween(cmd.x + r, cmd.y - r, cmd.x - r, cmd.y + r);
      drawHatch(g, cmd.x, cmd.y, r + 4, 0.6, panel(theme));
      addOverlayText(scene, theme, cmd.x, cmd.y + 22, reasonFor(cmd.reason));
      break;
    }
    case "supply-cutoff": {
      g.lineStyle(3, ink(theme), 0.95);
      const r = 14;
      g.lineBetween(cmd.x - r, cmd.y - r, cmd.x + r, cmd.y + r);
      g.lineBetween(cmd.x + r, cmd.y - r, cmd.x - r, cmd.y + r);
      g.lineStyle(2, ink(theme), 0.7);
      g.strokeCircle(cmd.x, cmd.y, r + 4);
      addOverlayText(scene, theme, cmd.x, cmd.y + 18, cmd.word);
      break;
    }
    case "supply-envelope": {
      g.lineStyle(2, plant(theme), 0.55);
      g.fillStyle(plant(theme), 0.12);
      if (cmd.mode === "hull" && cmd.points.length >= 3) {
        g.beginPath();
        g.moveTo(cmd.points[0]!.x, cmd.points[0]!.y);
        for (let i = 1; i < cmd.points.length; i++) {
          g.lineTo(cmd.points[i]!.x, cmd.points[i]!.y);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
      } else if (cmd.mode === "per-lane") {
        for (const n of cmd.nodes) {
          g.fillStyle(plant(theme), 0.45);
          g.fillCircle(n.x, n.y, 4);
        }
      }
      break;
    }
    case "lifeline-halo": {
      const w = cmd.weight === "thick" ? 4 : 2;
      g.lineStyle(w, sun(theme), 0.9);
      const steps = 40;
      for (let i = 0; i < steps; i += 2) {
        const a0 = (i / steps) * Math.PI * 2;
        const a1 = ((i + 1) / steps) * Math.PI * 2;
        g.beginPath();
        g.arc(cmd.x, cmd.y, 22, a0, a1, false);
        g.strokePath();
      }
      g.fillStyle(sun(theme), 0.95);
      g.fillTriangle(cmd.x, cmd.y - 7, cmd.x + 6, cmd.y, cmd.x, cmd.y + 7);
      g.fillTriangle(cmd.x, cmd.y - 7, cmd.x - 6, cmd.y, cmd.x, cmd.y + 7);
      if (cmd.caption) addOverlayText(scene, theme, cmd.x, cmd.y + 28, cmd.caption);
      break;
    }
    case "lens-mark": {
      const color = ink(theme);
      const r = 18;
      if (cmd.shape === "ring" || cmd.shape === "hatch") {
        const width = cmd.stroke === "double" ? 3 : 2;
        g.lineStyle(width, color, 0.7 + cmd.fillDensity * 0.25);
        if (cmd.stroke === "dashed" || cmd.stroke === "dotted") {
          const steps = cmd.stroke === "dotted" ? 24 : 32;
          const step = cmd.stroke === "dotted" ? 3 : 2;
          for (let i = 0; i < steps; i += step) {
            const a0 = (i / steps) * Math.PI * 2;
            const a1 = ((i + 1) / steps) * Math.PI * 2;
            g.beginPath();
            g.arc(cmd.x, cmd.y, r, a0, a1, false);
            g.strokePath();
          }
        } else {
          g.strokeCircle(cmd.x, cmd.y, r);
          if (cmd.stroke === "double") g.strokeCircle(cmd.x, cmd.y, r - 4);
        }
        if (cmd.fillDensity > 0.05) drawHatch(g, cmd.x, cmd.y, r - 2, cmd.fillDensity, color);
      } else if (cmd.shape === "chevron-up") {
        g.lineStyle(2, color, 0.9);
        g.lineBetween(cmd.x - 10, cmd.y + 4, cmd.x, cmd.y - 8);
        g.lineBetween(cmd.x, cmd.y - 8, cmd.x + 10, cmd.y + 4);
        if (cmd.fillDensity > 0) {
          g.fillStyle(color, cmd.fillDensity);
          g.fillTriangle(cmd.x - 8, cmd.y + 2, cmd.x, cmd.y - 6, cmd.x + 8, cmd.y + 2);
        }
      } else if (cmd.shape === "chevron-down") {
        g.lineStyle(2, color, 0.9);
        g.lineBetween(cmd.x - 10, cmd.y - 4, cmd.x, cmd.y + 8);
        g.lineBetween(cmd.x, cmd.y + 8, cmd.x + 10, cmd.y - 4);
      } else if (cmd.shape === "bar") {
        g.lineStyle(2, color, 0.7);
        g.lineBetween(cmd.x - 12, cmd.y, cmd.x + 12, cmd.y);
      } else if (cmd.shape === "cross") {
        g.lineStyle(3, color, 0.95);
        g.lineBetween(cmd.x - 12, cmd.y - 12, cmd.x + 12, cmd.y + 12);
        g.lineBetween(cmd.x + 12, cmd.y - 12, cmd.x - 12, cmd.y + 12);
        drawHatch(g, cmd.x, cmd.y, 14, cmd.fillDensity, color);
      } else if (cmd.shape === "diamond") {
        const n = Math.max(1, cmd.count ?? 1);
        for (let i = 0; i < n; i++) {
          const ox = (i - (n - 1) / 2) * 10;
          g.lineStyle(2, color, 0.9);
          g.lineBetween(cmd.x + ox, cmd.y - 7, cmd.x + ox + 6, cmd.y);
          g.lineBetween(cmd.x + ox + 6, cmd.y, cmd.x + ox, cmd.y + 7);
          g.lineBetween(cmd.x + ox, cmd.y + 7, cmd.x + ox - 6, cmd.y);
          g.lineBetween(cmd.x + ox - 6, cmd.y, cmd.x + ox, cmd.y - 7);
        }
      }
      if (cmd.label) addOverlayText(scene, theme, cmd.x, cmd.y + 26, cmd.label);
      break;
    }
    default:
      break;
  }
}

function drawWorldOverlay(input: WorldOverlayInput): OverlayDrawCounts {
  clearOverlayTexts(input.scene);
  const g = rootGraphics(input.scene);
  const model = asModel(input.model);
  const targeting = (input.interaction?.targeting ?? null) as TargetingPlanInput | null;
  const pos = selectionPos(
    input.registry,
    input.interaction?.selectedId,
    input.interaction?.selectedKind
  );

  const { commands, counts } = planWorldOverlay({
    model,
    selectedId: input.interaction?.selectedId,
    selectedKind: input.interaction?.selectedKind,
    selectionPos: pos,
    targeting,
    lens: input.lens
  });

  for (const cmd of commands) drawCommand(input.scene, g, input.theme, cmd);

  if (import.meta.env.DEV) {
    console.info("[world-overlay]", {
      event: "draw",
      lens: input.lens,
      tier: input.tier,
      ...counts
    });
  }

  return counts;
}

drawWorldOverlay.clear = clear;

export const worldOverlaySystem = drawWorldOverlay;
