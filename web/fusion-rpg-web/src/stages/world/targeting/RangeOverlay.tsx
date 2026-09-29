export type RangeSector = { sectorId: string; habitable: boolean };
export type RangeLane = { laneId: string; fromSectorId: string; toSectorId: string; severed: boolean };

/**
 * Multi-source hop-distance BFS from any of the player's own habitable holdings (world-stage W69),
 * matching `BuildResolver.cs:90-99`'s `WithinWaystationRange` → `Hops.Between` against
 * `Habitability.For`: a sector failing habitability is **skipped entirely** — never a source,
 * never an intermediate hop, never a destination — and a severed lane never carries a hop either,
 * the same rule `routeBetween` already applies. Returns the hop count for every sector reached
 * within `maxHops`; a sector not in the map is genuinely out of reach, not merely unlisted.
 */
export function hopDistancesFromHoldings(
  sectors: readonly RangeSector[],
  lanes: readonly RangeLane[],
  ownedSectorIds: readonly string[],
  maxHops: number
): Map<string, number> {
  const habitable = new Set(sectors.filter((s) => s.habitable).map((s) => s.sectorId));

  const neighbours = new Map<string, string[]>();
  for (const lane of lanes) {
    if (lane.severed) continue;
    if (!habitable.has(lane.fromSectorId) || !habitable.has(lane.toSectorId)) continue;
    for (const [a, b] of [
      [lane.fromSectorId, lane.toSectorId],
      [lane.toSectorId, lane.fromSectorId]
    ]) {
      const list = neighbours.get(a);
      if (list) list.push(b);
      else neighbours.set(a, [b]);
    }
  }

  const distances = new Map<string, number>();
  const queue: string[] = [];
  for (const id of ownedSectorIds) {
    if (!habitable.has(id)) continue;
    if (distances.has(id)) continue;
    distances.set(id, 0);
    queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const at = distances.get(current)!;
    if (at >= maxHops) continue;
    for (const next of neighbours.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, at + 1);
      queue.push(next);
    }
  }

  return distances;
}

/**
 * `x`/`y` are additive (world-stage W71) — W69 built this component before any real map existed to
 * position it against, so it drew every ring at the SVG origin. Both are optional and default to no
 * offset, so every existing caller/test that never supplied them keeps rendering exactly as before;
 * a real caller (`WorldScene.tsx`) now passes the sector's own on-screen centre.
 */
export type RangeTarget = { sectorId: string; hops: number; x?: number; y?: number };

export type RangeOverlayProps =
  | {
      shape: "sectors";
      /** Already-computed reachable sectors and their hop count — this component draws them, it
       * never runs the BFS itself (the caller wires real sector/lane data through
       * `hopDistancesFromHoldings`). */
      reachable: RangeTarget[];
      /** Sectors worth naming as out-of-reach, each with the sentence a hover/focus reveals. */
      outOfReach?: Array<{ sectorId: string; reason: string }>;
    }
  | {
      shape: "lane";
      /** `ward`'s own target is an edge, not a node — the click target is a line. */
      laneId: string;
    };

/**
 * The range overlay (world-stage W69) — one grammar for the verbs that reach past where you stand.
 * Reachable ground gets a solid ring **plus its hop number** (the number is what makes the rule
 * teachable without a manual, per this task's own acceptance); out-of-reach ground gets nothing
 * drawn except, on hover or focus, the sentence saying why — never a second ring style that could
 * be mistaken for "reachable, just further." `ward`'s lane shape is the one case this grammar draws
 * as an edge instead of a node — its own click target is the line, never a sector.
 *
 * `raise a well` (no range, gated on slot kind) and `take the ground` (range 0, drawn anyway so
 * silence never reads as "you missed the target") are not special-cased here: both are simply the
 * `sectors` shape with every entry at `hops: 0` — the caller decides which sectors qualify, this
 * component only ever draws a reachable set with its hop numbers.
 */
export function RangeOverlay(props: RangeOverlayProps) {
  if (props.shape === "lane") {
    return (
      <g data-testid={`range-lane-${props.laneId}`} data-shape="lane">
        <line data-testid={`range-lane-target-${props.laneId}`} aria-hidden="true" />
      </g>
    );
  }

  return (
    <g data-testid="range-overlay" data-shape="sectors">
      {props.reachable.map((target) => (
        <g
          key={target.sectorId}
          data-testid={`range-ring-${target.sectorId}`}
          data-hops={target.hops}
          transform={`translate(${target.x ?? 0}, ${target.y ?? 0})`}
        >
          <circle aria-hidden="true" r={90} fill="none" strokeWidth={2} />
          <text data-testid={`range-hop-number-${target.sectorId}`} textAnchor="middle" dy={4}>
            {target.hops}
          </text>
        </g>
      ))}
      {(props.outOfReach ?? []).map(({ sectorId, reason }) => (
        <g
          key={sectorId}
          data-testid={`range-blocked-${sectorId}`}
          tabIndex={0}
          role="img"
          aria-label={reason}
        >
          <title>{reason}</title>
        </g>
      ))}
    </g>
  );
}
