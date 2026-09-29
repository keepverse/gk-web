import Phaser from "phaser";
import type { ForceView } from "@/contract/types";
import type { WorldTheme } from "../snapshotTheme";

export type ForceOwnership = "yours" | "enemy";

export type ForceShape = "triangle" | "circle" | "square";

/** Three shapes before three colours (GG-27 / spec §Design 3). */
export function shapeForForceKind(kind: string): ForceShape {
  const k = kind.toLowerCase();
  if (k.includes("legion")) return "triangle";
  if (k.includes("garrison")) return "square";
  return "circle";
}

function ownershipColor(theme: WorldTheme, ownership: ForceOwnership): number {
  return Phaser.Display.Color.HexStringToColor(ownership === "yours" ? theme.sidePlant : theme.sideZombie).color;
}

function drawShape(g: Phaser.GameObjects.Graphics, shape: ForceShape, size: number, color: number): void {
  g.fillStyle(color, 1);
  g.lineStyle(1, color, 1);
  switch (shape) {
    case "triangle":
      g.beginPath();
      g.moveTo(0, -size);
      g.lineTo(size, size);
      g.lineTo(-size, size);
      g.closePath();
      g.fillPath();
      break;
    case "square":
      g.fillRect(-size, -size, size * 2, size * 2);
      break;
    case "circle":
    default:
      g.fillCircle(0, 0, size);
      break;
  }
}

export type ForceMarkerInput = {
  id: string;
  force: ForceView;
  ownership: ForceOwnership;
  x: number;
  y: number;
};

export function createForceMarker(
  scene: Phaser.Scene,
  theme: WorldTheme,
  input: ForceMarkerInput
): Phaser.GameObjects.Container {
  const container = scene.add.container(input.x, input.y);
  container.setName(`force:${input.id}`);
  container.setData("forceId", input.id);
  container.setData("entityId", input.force.entityId);

  const g = scene.add.graphics();
  const shape = shapeForForceKind(input.force.kind);
  drawShape(g, shape, 9, ownershipColor(theme, input.ownership));
  container.add(g);

  const glyph = scene.add.text(0, shape === "triangle" ? 2 : 0, input.force.kind.slice(0, 1).toUpperCase() || "?", {
    fontFamily: theme.fontFamily,
    fontSize: "10px",
    color: theme.ink
  });
  glyph.setOrigin(0.5);
  container.add(glyph);

  const hit = scene.add.zone(0, 0, 20, 20);
  hit.setInteractive({ useHandCursor: input.ownership === "yours" });
  container.add(hit);

  return container;
}
