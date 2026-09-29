import { lanePath } from "../stageIds";
import { laneChannelsFor, type LaneKind, type LaneState, type LaneStrokeStyle } from "./laneChannels";

/** Lane width is per-mille of a full front; 1000 draws at 4px, a 600-wide pass at ~2.4px. Ported
 * unchanged from `LaneEdge.tsx:24-26` — the spec keeps this half correct as-is. */
export function strokeWidthFor(widthMilli: number): number {
  return Math.max(1.2, Math.min(6, (widthMilli / 1000) * 4));
}

const DASH_PATTERN: Partial<Record<LaneStrokeStyle, string>> = {
  dashed: "6 4",
  "long-dash": "14 8"
};

export type LaneProps = {
  laneId: string;
  kind: LaneKind;
  state: LaneState;
  widthMilli: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

/** A point a `fraction` of the way from `a` to `b`. */
function lerp(ax: number, ay: number, bx: number, by: number, fraction: number) {
  return { x: ax + (bx - ax) * fraction, y: ay + (by - ay) * fraction };
}

/**
 * One lane (world-stage W45, spec-world-render.md §Design 2). Kind and state are drawn as
 * independent, stacking channels — never a single palette pick — so a warded, hazardous ley lane
 * reads as all three at once. **Severed draws a real gap in the path, plus a mark — never a fade**,
 * since a faded line reads as "far away" rather than "cut."
 *
 * The path itself carries `stageIds.lanePath(laneId)` as its own element id — `LegionMarker`
 * (still on the old page today) reads that id to animate a legion along the lane, and this is the
 * one place in `world-render` that contract has to hold.
 */
export function Lane({ laneId, kind, state, widthMilli, sourceX, sourceY, targetX, targetY }: LaneProps) {
  const channels = laneChannelsFor(kind, state);
  const width = strokeWidthFor(widthMilli);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // A real gap: two segments stopping short of the midpoint, never one continuous (and therefore
  // fadeable-looking) line.
  const gapStart = lerp(sourceX, sourceY, targetX, targetY, 0.42);
  const gapEnd = lerp(sourceX, sourceY, targetX, targetY, 0.58);
  const d = channels.severedGap
    ? `M ${sourceX},${sourceY} L ${gapStart.x},${gapStart.y}`
    : `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  const secondSegment = channels.severedGap ? `M ${gapEnd.x},${gapEnd.y} L ${targetX},${targetY}` : null;

  const markers: { key: string; testId: string; text: string; dx: number }[] = [];
  if (channels.arrowheads) markers.push({ key: "arrow", testId: `lane-arrow-${laneId}`, text: "➤", dx: 0 });
  if (channels.noSupplyMark) markers.push({ key: "no-supply", testId: `lane-no-supply-${laneId}`, text: "⊘", dx: 14 });
  if (channels.gateGlyph) markers.push({ key: "gate", testId: `lane-gate-${laneId}`, text: channels.gateGlyph, dx: -14 });
  if (channels.severedGlyph) markers.push({ key: "severed", testId: `lane-severed-${laneId}`, text: channels.severedGlyph, dx: 0 });
  if (channels.wardBadge) markers.push({ key: "ward", testId: `lane-ward-${laneId}`, text: channels.wardBadge, dx: 24 });
  if (channels.hazardBadge) markers.push({ key: "hazard", testId: `lane-hazard-${laneId}`, text: channels.hazardBadge, dx: -24 });

  return (
    <g data-testid={`lane-${laneId}`} data-kind={kind} data-token={channels.token}>
      <path
        id={lanePath(laneId)}
        data-testid={`lane-path-${laneId}`}
        d={d}
        fill="none"
        strokeWidth={width}
        strokeDasharray={DASH_PATTERN[channels.strokeStyle]}
      />
      {secondSegment ? (
        <path data-testid={`lane-path-second-${laneId}`} d={secondSegment} fill="none" strokeWidth={width} />
      ) : null}
      {channels.strokeStyle === "twin-rail" ? (
        <path
          data-testid={`lane-rail-${laneId}`}
          d={`M ${sourceX},${sourceY + width * 1.5} L ${targetX},${targetY + width * 1.5}`}
          fill="none"
          strokeWidth={Math.max(1, width / 2)}
        />
      ) : null}
      {markers.map((marker) => (
        <text key={marker.key} data-testid={marker.testId} x={midX + marker.dx} y={midY} textAnchor="middle">
          {marker.text}
        </text>
      ))}
    </g>
  );
}
