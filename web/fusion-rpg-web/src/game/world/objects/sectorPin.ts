import Phaser from "phaser";
import type { Channels, ColorToken } from "@/stages/world/render/sectorChannels";
import type { FogTreatment } from "@/stages/world/render/fogTreatments";
import { glyphFor } from "@/stages/world/render/slotSilhouettes";
import type { WorldTheme } from "../snapshotTheme";
import { lodChannels, type ZoomTier } from "../zoomTier";
import { PIN_DISC_PX } from "./pinConstants";

export type PinKind = "unknown" | "disc";

/** Structural type floor — omit fact-bearing text below 12px at 720p (gaps D12). */
export const PIN_TYPE_FLOOR_PX = 12;

/** Pure paint descriptor for matrix tests — no Phaser types, no opacity field. */
export type PinDescriptor = {
  kind: PinKind;
  lod: ReadonlySet<string>;
  channels: Channels;
  /** Fog ring/pip/wash flags relevant at this zoom — forces strip never included. */
  fog: {
    raggedRing: boolean;
    doubledRing: boolean;
    pip: boolean;
    wash: boolean;
  } | null;
};

export type PinSlotInput = {
  slotIndex: number;
  slotTypeId: string;
};

export type SectorPinInput = {
  id: string;
  channels: Channels;
  fog: FogTreatment;
  zoom: ZoomTier;
  x: number;
  y: number;
  slots?: readonly PinSlotInput[];
  /** Owner-only net loam chip; null when not owned / not shown. */
  netLoam?: number | null;
};

/**
 * Paint-ops the factory's draw path consumes (gaps D11).
 * Tests assert this list — not only `descriptor.channels` — so hue-only draw fails.
 */
export type PinPaintOp =
  | { op: "fill"; shape: "disc" | "diamond"; token: ColorToken }
  | { op: "border"; style: Channels["border"]["style"]; weight: Channels["border"]["weight"] }
  | { op: "hatch"; pattern: NonNullable<Channels["pattern"]> }
  | { op: "crest"; text: string }
  | { op: "glyph"; text: string }
  | { op: "meter"; milli: number }
  | { op: "word"; text: string }
  | { op: "fog-stamp"; text: string }
  | { op: "fog-ring"; kind: "ragged" | "doubled" }
  | { op: "fog-wash"; percent: number }
  | { op: "slot-dot"; index: number; x: number; y: number }
  | { op: "slot-shape"; index: number; glyph: string; x: number; y: number }
  | { op: "net-loam"; text: string }
  | { op: "name"; text: string };

function fogOnPin(fog: FogTreatment, zoom: ZoomTier): PinDescriptor["fog"] {
  if (!fog.raggedBorder && !fog.doubledBorder && fog.wash === "none") return null;
  const lod = lodChannels(zoom);
  return {
    raggedRing: fog.raggedBorder,
    doubledRing: fog.doubledBorder,
    pip: lod.has("fogPip") && fog.stamp != null,
    wash: lod.has("fogWash") && fog.wash !== "none"
  };
}

/** Descriptor-only path for unit tests — encodes kind, LOD channels, fog-on-pin density. */
export function pinDescriptor(input: Pick<SectorPinInput, "channels" | "fog" | "zoom">): PinDescriptor {
  const kind: PinKind = input.channels.shape === "unknown" ? "unknown" : "disc";
  return {
    kind,
    lod: lodChannels(input.zoom),
    channels: input.channels,
    fog: kind === "disc" ? fogOnPin(input.fog, input.zoom) : null
  };
}

function slotOffset(index: number, count: number): { x: number; y: number } {
  const r = PIN_DISC_PX / 2 + 10;
  const a = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/**
 * Pure paint-ops list for pin draw + tests (gaps D11/D12/D13).
 * Ownership reads on crest+word without hue; health on hatch/glyph/meter.
 */
export function pinPaintOps(input: SectorPinInput): readonly PinPaintOp[] {
  const ops: PinPaintOp[] = [];
  const lod = lodChannels(input.zoom);
  const r = PIN_DISC_PX / 2;

  if (input.channels.shape === "unknown") {
    ops.push({ op: "fill", shape: "diamond", token: input.channels.token });
    ops.push({ op: "border", style: "solid", weight: "normal" });
    return ops;
  }

  ops.push({ op: "fill", shape: "disc", token: input.channels.token });
  ops.push({
    op: "border",
    style: input.channels.border.style,
    weight: input.channels.border.weight
  });
  // Non-hue ownership channels — always present on cards (GG-27 / gaps D11).
  ops.push({ op: "crest", text: input.channels.crest });
  ops.push({ op: "word", text: input.channels.word });

  if (input.channels.pattern) ops.push({ op: "hatch", pattern: input.channels.pattern });
  if (input.channels.glyph) ops.push({ op: "glyph", text: input.channels.glyph });
  if (input.channels.meterMilli != null) ops.push({ op: "meter", milli: input.channels.meterMilli });

  const fogFlags = fogOnPin(input.fog, input.zoom);
  if (fogFlags?.doubledRing) ops.push({ op: "fog-ring", kind: "doubled" });
  if (fogFlags?.raggedRing) ops.push({ op: "fog-ring", kind: "ragged" });
  if (fogFlags?.wash) ops.push({ op: "fog-wash", percent: input.fog.washCapPercent });
  if (fogFlags?.pip && input.fog.stamp) {
    ops.push({ op: "fog-stamp", text: input.fog.stamp });
  }

  const slots = input.slots ?? [];
  if (lod.has("slotShapes") && slots.length > 0) {
    slots.forEach((slot, i) => {
      const p = slotOffset(i, slots.length);
      ops.push({
        op: "slot-shape",
        index: slot.slotIndex,
        glyph: glyphFor(slot.slotTypeId),
        x: p.x,
        y: p.y
      });
    });
  } else if (lod.has("slotDots") && slots.length > 0) {
    slots.forEach((slot, i) => {
      const p = slotOffset(i, slots.length);
      ops.push({ op: "slot-dot", index: slot.slotIndex, x: p.x, y: p.y });
    });
  }

  if (lod.has("netLoam") && input.netLoam != null) {
    ops.push({ op: "net-loam", text: `${input.netLoam}` });
  }

  if (lod.has("name")) {
    ops.push({ op: "name", text: input.id });
  }

  void r;
  return ops;
}

function hex(theme: WorldTheme, token: ColorToken): number {
  switch (token) {
    case "ownership-mine":
      return Phaser.Display.Color.HexStringToColor(theme.sidePlant).color;
    case "ownership-enemy":
      return Phaser.Display.Color.HexStringToColor(theme.sideZombie).color;
    case "ownership-contested":
      return Phaser.Display.Color.HexStringToColor(theme.sun).color;
    case "ownership-neutral":
    default:
      return Phaser.Display.Color.HexStringToColor(theme.panel).color;
  }
}

function addText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  theme: WorldTheme,
  x: number,
  y: number,
  text: string,
  fontSizePx: number
): void {
  if (fontSizePx < PIN_TYPE_FLOOR_PX) return;
  const t = scene.add.text(x, y, text, {
    fontFamily: theme.fontFamily,
    fontSize: `${fontSizePx}px`,
    color: theme.ink
  });
  t.setOrigin(0.5);
  container.add(t);
}

function drawPaintOps(
  scene: Phaser.Scene,
  theme: WorldTheme,
  container: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  ops: readonly PinPaintOp[]
): void {
  const r = PIN_DISC_PX / 2;
  const border = Phaser.Display.Color.HexStringToColor(theme.ink).color;

  for (const op of ops) {
    switch (op.op) {
      case "fill": {
        const fill = hex(theme, op.token);
        g.fillStyle(fill, 1);
        if (op.shape === "diamond") {
          g.beginPath();
          g.moveTo(0, -r);
          g.lineTo(r, 0);
          g.lineTo(0, r);
          g.lineTo(-r, 0);
          g.closePath();
          g.fillPath();
        } else {
          g.fillCircle(0, 0, r);
        }
        break;
      }
      case "border": {
        g.lineStyle(op.weight === "heavy-left" ? 3 : 2, border, 0.95);
        if (op.style === "dashed") {
          const segments = 24;
          for (let i = 0; i < segments; i += 2) {
            const a0 = (i / segments) * Math.PI * 2;
            const a1 = ((i + 1) / segments) * Math.PI * 2;
            g.beginPath();
            g.arc(0, 0, r + 2, a0, a1);
            g.strokePath();
          }
        } else {
          g.strokeCircle(0, 0, r + 2);
        }
        break;
      }
      case "hatch": {
        const density = op.pattern === "hatch-heavy" ? 8 : op.pattern === "hatch-fine" ? 5 : 3;
        g.lineStyle(1, border, op.pattern === "flat-desaturated" ? 0.35 : 0.55);
        for (let i = 0; i < density; i++) {
          const t = (i / Math.max(1, density - 1)) * 2 - 1;
          const ox = t * r * 0.7;
          g.lineBetween(ox - r * 0.35, -r * 0.55, ox + r * 0.35, r * 0.55);
        }
        break;
      }
      case "crest":
        addText(scene, container, theme, -r + 6, -r + 8, op.text, 14);
        break;
      case "word":
        addText(scene, container, theme, 0, r + 12, op.text, 12);
        break;
      case "glyph":
        addText(scene, container, theme, r - 6, -r + 8, op.text, 14);
        break;
      case "meter":
        addText(scene, container, theme, 0, 2, String(Math.round(op.milli / 10)), 12);
        break;
      case "fog-stamp":
        addText(scene, container, theme, r - 2, -r + 2, op.text, 12);
        break;
      case "fog-ring":
        if (op.kind === "doubled") {
          g.lineStyle(1, border, 0.7);
          g.strokeCircle(0, 0, r + 6);
        } else {
          g.lineStyle(1, border, 0.65);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const rr = r + 5 + (i % 2 === 0 ? 2 : 0);
            g.fillStyle(border, 0.65);
            g.fillCircle(Math.cos(a) * rr, Math.sin(a) * rr, 1.5);
          }
        }
        break;
      case "fog-wash":
        g.fillStyle(border, op.percent / 100);
        g.fillCircle(0, 0, r);
        break;
      case "slot-dot":
        g.fillStyle(border, 0.9);
        g.fillCircle(op.x, op.y, 3);
        break;
      case "slot-shape":
        addText(scene, container, theme, op.x, op.y, op.glyph, 12);
        break;
      case "net-loam":
        addText(scene, container, theme, 0, -r - 10, op.text, 12);
        break;
      case "name":
        addText(scene, container, theme, 0, r + 26, op.text, 12);
        break;
      default:
        break;
    }
  }
}

/**
 * Pin factory. Unknown → diamond silhouette; card channels → 44px disc via paint-ops.
 */
export function createSectorPin(
  scene: Phaser.Scene,
  theme: WorldTheme,
  input: SectorPinInput
): Phaser.GameObjects.Container {
  const container = scene.add.container(input.x, input.y);
  container.setName(`pin:${input.id}`);
  container.setData("sectorId", input.id);

  const g = scene.add.graphics();
  container.add(g);

  const ops = pinPaintOps(input);
  drawPaintOps(scene, theme, container, g, ops);

  const hit = scene.add.zone(0, 0, PIN_DISC_PX, PIN_DISC_PX);
  hit.setInteractive({ useHandCursor: true });
  container.add(hit);
  container.setSize(PIN_DISC_PX, PIN_DISC_PX);
  container.setInteractive(
    new Phaser.Geom.Circle(0, 0, PIN_DISC_PX / 2),
    Phaser.Geom.Circle.Contains
  );

  return container;
}
