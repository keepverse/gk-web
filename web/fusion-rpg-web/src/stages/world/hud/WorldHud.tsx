import type { ReactNode } from "react";

/**
 * The band-1 frame (world-stage W51): six anchors, one occupant each, and nothing in this band
 * ever grows or moves the map beneath it — screen budget stays chrome ~27% / map ~73% at 1280×720.
 * A bounded anchor may still scroll its own body (`right-edge`/`left-edge` do, deliberately); what
 * must never happen is the *band itself* growing the page or pushing the stage.
 *
 * `top-left rail` is not one of this component's anchors — it is the shell's own `Rail.tsx`,
 * unchanged, docked outside this module. **`left-edge` is the one conditional occupant** (the
 * inspector, §8e.1): its container only exists while there is something to show it. Every other
 * anchor's container is always present — reserved, not filled with a placeholder — so a reader can
 * tell "nothing here yet" (the container is empty) from "this anchor does not exist" (a bug).
 *
 * **Found missing 2026-09-04 (world-stage W55):** every anchor here is Band 1 (HUD) by the map's own
 * GG-5 arbitration, but none of them carried the `band-hud` class — `SanctumHud.tsx`'s real, shipped
 * frame does (`className="band-hud ..."`), and this module's own W51 acceptance never named the
 * class explicitly, so the gap went unnoticed until the GG-5 scrim amendment needed something to
 * actually stack *against*. Added to all five anchors below; unaffected by the amendment itself
 * (only `PanelShell`'s scrim moved), but load-bearing for proving it.
 */
export type WorldHudProps = {
  topStrip?: ReactNode;
  rightEdge?: ReactNode;
  bottomRight?: ReactNode;
  bottomLeft?: ReactNode;
  /** The one conditional occupant — omit entirely (not merely empty) when nothing selects it. */
  leftEdge?: ReactNode;
  /** The map/stage itself, filling whatever space the anchors leave. */
  children: ReactNode;
};

export function WorldHud({ topStrip, rightEdge, bottomRight, bottomLeft, leftEdge, children }: WorldHudProps) {
  return (
    <div data-testid="world-hud" className="relative h-full w-full overflow-hidden">
      <div data-testid="world-hud-map-layer" className="absolute inset-0">
        {children}
      </div>

      <div data-testid="world-hud-anchor-top-strip" className="band-hud pointer-events-none absolute inset-x-0 top-0 overflow-hidden">
        {topStrip}
      </div>
      <div
        data-testid="world-hud-anchor-right-edge"
        className="band-hud pointer-events-none absolute inset-y-0 right-0 overflow-y-auto overflow-x-hidden"
      >
        {rightEdge}
      </div>
      <div data-testid="world-hud-anchor-bottom-right" className="band-hud pointer-events-none absolute bottom-0 right-0 overflow-hidden">
        {bottomRight}
      </div>
      <div data-testid="world-hud-anchor-bottom-left" className="band-hud pointer-events-none absolute bottom-0 left-0 overflow-hidden">
        {bottomLeft}
      </div>

      {leftEdge != null ? (
        <div
          data-testid="world-hud-anchor-left-edge"
          className="band-hud pointer-events-none absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden"
        >
          {leftEdge}
        </div>
      ) : null}
    </div>
  );
}
