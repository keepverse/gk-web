/**
 * Element paint SSOT — theme packs + element catalog resolve.
 * Spec: docs/architecture/gui-lego/spec-element-paint-ssot.md
 */
import elementCatalogJson from "../../../../../../data/tuning/element-catalog.v1.json";
import { lookupThemePack, resolveTheme } from "../themeRegistry";
import type { GlyphRef, ThemeResolved } from "../types";

export type ElementPaint = {
  themeId: string;
  css: Record<string, string>;
  paint: ThemeResolved["paint"];
  vfx: ThemeResolved["vfx"];
  /** Value for `data-el` (catalog element id, or `neutral` fallback). */
  dataEl: string;
  label: string;
  glyphRef: GlyphRef;
};

type CatalogEntry = {
  id: string;
  displayName: string;
  ordinal: number;
  color: string;
  presentationOnly: boolean;
};

const CATALOG = (elementCatalogJson as { entries: CatalogEntry[] }).entries;
const byId = new Map(CATALOG.map((e) => [e.id, e]));

/** Catalog element ids that have theme packs (includes presentation-only omni). */
export const ELEMENT_PAINT_CATALOG_IDS: readonly string[] = CATALOG.map((e) => e.id);

function normalizeId(elementId: string): string {
  return elementId.trim().toLowerCase();
}

/**
 * Resolve paint + CSS + vfx for a catalog element id.
 * Unknown ids → neutral pack paint with `dataEl: "neutral"` (documented fallback).
 */
export function resolveElementPaint(elementId: string): ElementPaint {
  const id = normalizeId(elementId);
  const row = byId.get(id);
  const hasPack = lookupThemePack({ kind: "element", id }).themeId === `element.${id}`;
  const theme = hasPack
    ? resolveTheme({ kind: "element", id })
    : resolveTheme(null);

  const dataEl = hasPack ? id : "neutral";
  const label = row?.displayName ?? (hasPack ? id : "Unknown");

  return {
    themeId: theme.themeId,
    css: { ...theme.css },
    paint: { ...theme.paint },
    vfx: { ...theme.vfx },
    dataEl,
    label,
    glyphRef: {
      catalogIcon: theme.glyphDefault ?? undefined,
      fallbackText: label
    }
  };
}

/** Hex accent from paint SSOT (HUD / CSS consumers). */
export function elementPaintAccentHex(elementId: string): string {
  return resolveElementPaint(elementId).paint.accent;
}

/** Phaser-style 0xRRGGBB from paint SSOT accent. */
export function elementPaintAccentPhaser(elementId: string): number {
  const hex = elementPaintAccentHex(elementId).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return 0xa0a0a8;
  }
  return Number.parseInt(hex, 16);
}
