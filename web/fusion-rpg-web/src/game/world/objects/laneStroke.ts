import Phaser from "phaser";
import {
  laneChannelsFor,
  type LaneChannels,
  type LaneKind,
  type LaneState
} from "@/stages/world/render/laneChannels";
import type { WorldTheme } from "../snapshotTheme";

/** Lane width is per-mille of a full front — same mapping as `Lane.tsx`. */
export function strokeWidthFor(widthMilli: number): number {
  return Math.max(1.2, Math.min(6, (widthMilli / 1000) * 4));
}

function laneColor(theme: WorldTheme, token: LaneChannels["token"]): number {
  switch (token) {
    case "lane-severed":
      return Phaser.Display.Color.HexStringToColor(theme.sideZombie).color;
    case "lane-warded":
      return Phaser.Display.Color.HexStringToColor(theme.sun).color;
    case "lane-hazardous":
      return Phaser.Display.Color.HexStringToColor(theme.sideZombie).color;
    case "lane-open":
    default:
      return Phaser.Display.Color.HexStringToColor(theme.ink).color;
  }
}

function lerp(ax: number, ay: number, bx: number, by: number, t: number): { x: number; y: number } {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

/**
 * Paint-ops covering every LaneChannels field (gaps D14).
 * Stroke/gap drawn by Graphics; markers as mid-lane text ops.
 */
export type LanePaintOp =
  | { op: "stroke"; style: LaneChannels["strokeStyle"]; token: LaneChannels["token"]; severedGap: boolean }
  | { op: "marker"; kind: "arrow" | "no-supply" | "gate" | "severed" | "ward" | "hazard"; text: string; dx: number };

export function lanePaintOps(channels: LaneChannels): readonly LanePaintOp[] {
  const ops: LanePaintOp[] = [
    {
      op: "stroke",
      style: channels.strokeStyle,
      token: channels.token,
      severedGap: channels.severedGap
    }
  ];
  if (channels.arrowheads) ops.push({ op: "marker", kind: "arrow", text: "➤", dx: 0 });
  if (channels.noSupplyMark) ops.push({ op: "marker", kind: "no-supply", text: "⊘", dx: 14 });
  if (channels.gateGlyph) ops.push({ op: "marker", kind: "gate", text: channels.gateGlyph, dx: -14 });
  if (channels.severedGlyph) ops.push({ op: "marker", kind: "severed", text: channels.severedGlyph, dx: 0 });
  if (channels.wardBadge) ops.push({ op: "marker", kind: "ward", text: channels.wardBadge, dx: 24 });
  if (channels.hazardBadge) ops.push({ op: "marker", kind: "hazard", text: channels.hazardBadge, dx: -24 });
  return ops;
}

function drawStroke(
  g: Phaser.GameObjects.Graphics,
  channels: LaneChannels,
  color: number,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  g.lineStyle(width, color, 1);

  if (channels.severedGap) {
    const gapStart = lerp(x0, y0, x1, y1, 0.42);
    const gapEnd = lerp(x0, y0, x1, y1, 0.58);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(gapStart.x, gapStart.y);
    g.strokePath();
    g.beginPath();
    g.moveTo(gapEnd.x, gapEnd.y);
    g.lineTo(x1, y1);
    g.strokePath();
    return;
  }

  const style = channels.strokeStyle;
  if (style === "dashed" || style === "long-dash") {
    const dash = style === "long-dash" ? 14 : 6;
    const gap = style === "long-dash" ? 8 : 4;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    let dist = 0;
    let draw = true;
    while (dist < len) {
      const seg = draw ? dash : gap;
      const next = Math.min(dist + seg, len);
      if (draw) {
        g.beginPath();
        g.moveTo(x0 + ux * dist, y0 + uy * dist);
        g.lineTo(x0 + ux * next, y0 + uy * next);
        g.strokePath();
      }
      dist = next;
      draw = !draw;
    }
    return;
  }

  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokePath();

  if (style === "twin-rail") {
    g.lineStyle(Math.max(1, width / 2), color, 0.85);
    g.beginPath();
    g.moveTo(x0, y0 + width * 1.5);
    g.lineTo(x1, y1 + width * 1.5);
    g.strokePath();
  }
}

export type LaneStrokeInput = {
  id: string;
  kind: LaneKind;
  state: LaneState;
  widthMilli: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** Draw a lane between two pin centres using LaneChannels paint-ops. */
export function createLaneStroke(
  scene: Phaser.Scene,
  theme: WorldTheme,
  input: LaneStrokeInput
): Phaser.GameObjects.Container {
  const channels = laneChannelsFor(input.kind, input.state);
  const ops = lanePaintOps(channels);
  const container = scene.add.container(0, 0);
  container.setName(`lane:${input.id}`);

  const g = scene.add.graphics();
  container.add(g);
  const color = laneColor(theme, channels.token);
  const width = strokeWidthFor(input.widthMilli);
  drawStroke(g, channels, color, width, input.x0, input.y0, input.x1, input.y1);

  const midX = (input.x0 + input.x1) / 2;
  const midY = (input.y0 + input.y1) / 2;
  for (const op of ops) {
    if (op.op !== "marker") continue;
    const t = scene.add.text(midX + op.dx, midY, op.text, {
      fontFamily: theme.fontFamily,
      fontSize: "12px",
      color: theme.ink
    });
    t.setOrigin(0.5);
    container.add(t);
  }

  container.setDepth(-10);
  return container;
}

/** Midpoint along a straight lane — v1 linear, no easing. */
export function pointOnLane(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  progressMilli: number
): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, progressMilli / 1000));
  return lerp(x0, y0, x1, y1, t);
}
