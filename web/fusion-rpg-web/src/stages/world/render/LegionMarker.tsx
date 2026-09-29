import { memo, useEffect, useRef } from "react";
import type { Ownership } from "./sectorChannels";

/**
 * A force sliding along a lane during turn playback (world-stage W46, moved from
 * `features/world/LegionMarker.tsx`).
 *
 * The animation writes `transform` straight onto its own `<g>` through a ref inside a
 * `requestAnimationFrame` loop — it never calls `setState`, so a legion crossing the map costs the
 * React tree exactly **zero** re-renders. That technique survives the library removal unchanged;
 * **the id contract it depends on does not.** `pathId` used to be documented as "the `<path>`
 * element id React Flow gives this lane's edge" — with the library gone, nothing would supply that
 * id, and markers would simply stop moving with no compile error and no runtime error. The caller
 * must pass `stageIds.lanePath(laneId)` (`world-shell` W33) here, and this module's own test proves
 * that id is what `getElementById` actually finds.
 *
 * Ownership reads as **three shapes before three colours** — no hex literal anywhere in this file.
 */

/** Module-scope so the default is a stable identity, not a fresh closure on every render. */
const wallClock = () => performance.now();

const OWNERSHIP_SHAPE: Record<Ownership, "triangle" | "square" | "diamond"> = {
  yours: "triangle",
  enemy: "square",
  contested: "diamond",
  open: "diamond"
};

/** A small polygon per shape, centred on the origin — the `<g>`'s own `transform` places it. */
function MarkerGlyph({ shape }: { shape: "triangle" | "square" | "diamond" }) {
  if (shape === "triangle") return <polygon points="0,-7 6,5 -6,5" />;
  if (shape === "square") return <rect x={-6} y={-6} width={12} height={12} />;
  return <polygon points="0,-7 7,0 0,7 -7,0" />;
}

export type LegionMarkerProps = {
  /** `stageIds.lanePath(laneId)` — the DOM id the lane's own `<path>` was rendered with. */
  pathId: string;
  fromMilli: number;
  toMilli: number;
  durationMs: number;
  ownership: Ownership;
  entityId: string;
  /** Injected in tests; the browser's clock otherwise. */
  now?: () => number;
};

function LegionMarkerView({
  pathId,
  fromMilli,
  toMilli,
  durationMs,
  ownership,
  entityId,
  now = wallClock
}: LegionMarkerProps) {
  const group = useRef<SVGGElement | null>(null);

  // The clock is read through a ref rather than depended on. It is *how* we tell the time, not part
  // of the march — and treating it as a dependency restarts the animation from the start of the lane
  // on any re-render that gets past `memo`, which reads as a legion stuttering backwards.
  const clock = useRef(now);
  clock.current = now;

  useEffect(() => {
    const path = document.getElementById(pathId) as SVGPathElement | null;
    const node = group.current;
    if (!path || !node || typeof path.getPointAtLength !== "function") return;

    const total = path.getTotalLength();
    const started = clock.current();
    let frame = 0;

    const place = (milli: number) => {
      const point = path.getPointAtLength((total * Math.min(1000, Math.max(0, milli))) / 1000);
      node.setAttribute("transform", `translate(${point.x}, ${point.y})`);
    };

    const tick = () => {
      const elapsed = durationMs <= 0 ? 1 : (clock.current() - started) / durationMs;
      const t = Math.min(1, Math.max(0, elapsed));
      place(fromMilli + (toMilli - fromMilli) * t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    place(fromMilli);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pathId, fromMilli, toMilli, durationMs]);

  return (
    <g ref={group} data-testid={`legion-marker-${entityId}`} data-ownership={ownership}>
      <MarkerGlyph shape={OWNERSHIP_SHAPE[ownership]} />
    </g>
  );
}

export const LegionMarker = memo(LegionMarkerView);
LegionMarker.displayName = "LegionMarker";
