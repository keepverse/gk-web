/**
 * The DOM id scheme the stage and the renderer agree on (world-stage W33).
 *
 * **Migration risk, written down rather than left implicit:** `LegionMarker` (`world-render`)
 * animates a legion along a lane by id — `getElementById` -> `getTotalLength()` ->
 * `getPointAtLength()` — reading "the `<path>` element id React Flow gives this lane's edge" today.
 * Removing `@xyflow/react` removes that supplier with **no compile error and no runtime error** —
 * markers simply stop moving, silently, because the id just stops existing. `lanePath(laneId)` is
 * the replacement contract: `world-render` must render each lane's edge as an SVG `<path>` carrying
 * exactly this id, so the animation keeps a real supplier once the library is gone.
 */
export function lanePath(laneId: string): string {
  return `world-lane-path-${laneId}`;
}
