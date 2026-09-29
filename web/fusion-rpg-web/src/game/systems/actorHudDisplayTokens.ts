/** Shared actor HUD display tokens — Inspector (CSS) + Phaser canvas (numeric colors). */

import {
  elementPaintAccentHex,
  elementPaintAccentPhaser
} from "../../features/gui-lego/themes/elementPaint";

/** Structural mirror of `gk-core/data/tuning/actor-hud.v1.json` `statusStripMax` (web does not load tuning file v1). */
export const STATUS_STRIP_MAX = 3;

export type HudTokenResolve = { hudToken: string; color: string; displayName: string };

/**
 * Element colors — redirected to gui-lego `resolveElementPaint` (CG-A1 / paint SSOT).
 * Do not add a private hex table here.
 */
export function elementColorHex(element: string): string {
  return elementPaintAccentHex(element);
}

export function elementColorPhaser(element: string): number {
  return elementPaintAccentPhaser(element);
}

export const TIER_BORDER: Record<string, string> = {
  normal: "border-border-control",
  elite: "border-rarity-4",
  boss: "border-bad-solid",
  unique: "border-rarity-5"
};

export const TIER_STROKE: Record<string, number> = {
  normal: 0x6a6258,
  elite: 0x9b7ddb,
  boss: 0xcc4444,
  unique: 0xe8b040
};

/**
 * H2 resolve: catalog hudToken/color when actor-surface is injected; else designed placeholder
 * (GG-62) — never treat id-slice as SSOT.
 */
export function resolveStatusHudToken(id: string): HudTokenResolve {
  const row = window.__fusionRpgActorSurface?.statuses?.find((s) => s.id === id);
  if (row?.hudToken && row.color) {
    return {
      hudToken: row.hudToken,
      color: row.color,
      displayName: row.displayName ?? id
    };
  }
  return {
    hudToken: "·",
    color: "#a89880",
    displayName: "Unknown status"
  };
}

export function tierBadgeLetter(tier: string): string {
  if (tier === "unique") return "U";
  if (tier === "elite") return "E";
  if (tier === "boss") return "B";
  return "";
}
