import type { WorldIgnoreRect } from "@/game/EventBus";

/** Shell `Rail` column width (`Rail.tsx` `w-[92px]`). */
export const SHELL_RAIL_WIDTH_PX = 92;

/** Fallback chrome sizes when HUD anchors are not yet measured (followup F6). */
export const FALLBACK_TOP_H = 56;
export const FALLBACK_BOTTOM_LEFT_W = 200;
export const FALLBACK_BOTTOM_LEFT_H = 200;
export const FALLBACK_RIGHT_W = 280;
export const FALLBACK_DOCK_W = 380;

export type MeasuredIgnoreAnchors = {
  top?: WorldIgnoreRect;
  bottomLeft?: WorldIgnoreRect;
  right?: WorldIgnoreRect;
  dock?: WorldIgnoreRect;
};

export type BuildWorldIgnoreRectsInput = {
  /** Map pane size in CSS px (the Phaser canvas parent). */
  width: number;
  height: number;
  /** Inspector dock open — covers left of the canvas (DockShell is viewport-fixed at 92px). */
  dockOpen: boolean;
  /**
   * When true, the map canvas already sits in a flex child beside the shell rail.
   * Phaser pointer coords are canvas-relative, so a 92px left strip must **not** be added
   * (that would eat homeworld / left pins). Gaps D7 / D22.
   */
  canvasBesideRail: boolean;
  /** Optional measured HUD boxes in canvas CSS space (followup F6). */
  measured?: MeasuredIgnoreAnchors;
};

/**
 * HUD / chrome ignore regions in **canvas CSS space** for pick + edge-scroll (gaps D7).
 * Callers that mount `Rail` beside the map pass `canvasBesideRail: true`.
 */
export function buildWorldIgnoreRects(input: BuildWorldIgnoreRectsInput): WorldIgnoreRect[] {
  const { width: w, height: h, dockOpen, canvasBesideRail, measured } = input;
  const rects: WorldIgnoreRect[] = [
    measured?.top ?? { left: 0, top: 0, width: w, height: FALLBACK_TOP_H },
    measured?.bottomLeft ?? {
      left: 0,
      top: Math.max(0, h - FALLBACK_BOTTOM_LEFT_H),
      width: FALLBACK_BOTTOM_LEFT_W,
      height: FALLBACK_BOTTOM_LEFT_H
    },
    measured?.right ?? {
      left: Math.max(0, w - FALLBACK_RIGHT_W),
      top: 0,
      width: FALLBACK_RIGHT_W,
      height: h
    }
  ];

  if (!canvasBesideRail) {
    // Only when the canvas still underlays the shell rail (legacy full-bleed). After G12 flex
    // mount, the canvas is already inset — skip this strip.
    rects.push({ left: 0, top: 0, width: SHELL_RAIL_WIDTH_PX, height: h });
  }

  if (dockOpen) {
    rects.push(
      measured?.dock ?? { left: 0, top: 0, width: FALLBACK_DOCK_W, height: h }
    );
  }

  return rects;
}

/**
 * Convert an absolute DOM rect into canvas-relative CSS space.
 * Returns null when width/height are degenerate.
 */
export function rectRelativeToCanvas(
  canvasRect: DOMRectReadOnly,
  elRect: DOMRectReadOnly
): WorldIgnoreRect | null {
  if (elRect.width < 1 || elRect.height < 1) return null;
  return {
    left: elRect.left - canvasRect.left,
    top: elRect.top - canvasRect.top,
    width: elRect.width,
    height: elRect.height
  };
}

/** Fit padLeft from dock ignore (followup F5). */
export function fitPadLeft(dockOpen: boolean, measuredDockWidth?: number): number {
  if (!dockOpen) return 100;
  return measuredDockWidth != null && measuredDockWidth > 0 ? measuredDockWidth : FALLBACK_DOCK_W;
}
