/**
 * Lane state → visual channels, as a pure function (world-stage W45, spec-world-render.md §Design
 * 2). Kind and state are orthogonal and both must read: a warded, hazardous ley lane is drawable
 * and reads as all three at once, so state is modelled as independent flags that **stack** rather
 * than a single enum.
 *
 * **The six-entry raw-hex palette (`LaneEdge.tsx:11-18`) has no successor.** Kind is now
 * distinguished by stroke *style* and markers, never by colour alone — the same GG-27 rule
 * `sectorChannels.ts` (W43) already applies.
 */

export type LaneKind = "corridor" | "rift" | "ley" | "deep" | "one-way" | "gated";

export type LaneStrokeStyle = "solid" | "dashed" | "twin-rail" | "long-dash";

export type LaneState = {
  severed: boolean;
  /** Non-null means warded, and it is the printed level — *"ward 3"*, never a percent. */
  wardLevel: number | null;
  /** Per-mille, straight off `HazardMilli` — 0 means not hazardous. */
  hazardMilli: number;
};

export type LaneColorToken = "lane-open" | "lane-severed" | "lane-warded" | "lane-hazardous";

export type LaneChannels = {
  strokeStyle: LaneStrokeStyle;
  /** `one-way` only — direction is drawn, never inferred from anything else. */
  arrowheads: boolean;
  /** `deep` only — passable, but a distinct mark says it carries no supply. */
  noSupplyMark: boolean;
  /** `gated` only — the lock glyph at the lane's midpoint. */
  gateGlyph: string | null;
  /** A real gap plus a mark — never a faded line, which reads as "far away" instead of "cut". */
  severedGap: boolean;
  severedGlyph: string | null;
  /** The printed ward level, e.g. `"ward 3"` — never a percentage. */
  wardBadge: string | null;
  /** The printed hazard chance, e.g. `"☠ 40%"` from `HazardMilli` 400. */
  hazardBadge: string | null;
  token: LaneColorToken;
};

const KIND_STROKE_STYLE: Record<LaneKind, LaneStrokeStyle> = {
  corridor: "solid",
  rift: "dashed",
  ley: "twin-rail",
  deep: "solid",
  "one-way": "solid",
  gated: "long-dash"
};

export function laneChannelsFor(kind: LaneKind, state: LaneState): LaneChannels {
  const warded = state.wardLevel != null;
  const hazardous = state.hazardMilli > 0;

  // Precedence when more than one state applies to the colour token only — every other channel
  // (the gap, the badges) still renders for every flag that is true, regardless of this pick.
  const token: LaneColorToken = state.severed ? "lane-severed" : warded ? "lane-warded" : hazardous ? "lane-hazardous" : "lane-open";

  return {
    strokeStyle: KIND_STROKE_STYLE[kind],
    arrowheads: kind === "one-way",
    noSupplyMark: kind === "deep",
    gateGlyph: kind === "gated" ? "🔒" : null,
    severedGap: state.severed,
    severedGlyph: state.severed ? "✕" : null,
    wardBadge: warded ? `ward ${state.wardLevel}` : null,
    // HazardMilli 400 -> 40% : divide by ten, per-mille to whole percent.
    hazardBadge: hazardous ? `☠ ${Math.round(state.hazardMilli / 10)}%` : null,
    token
  };
}

export const LANE_KIND_VALUES: readonly LaneKind[] = ["corridor", "rift", "ley", "deep", "one-way", "gated"];

/** Representative state combinations — including the stacked case a matrix test must cover. */
export const LANE_STATE_CASES: readonly { name: string; state: LaneState }[] = [
  { name: "open", state: { severed: false, wardLevel: null, hazardMilli: 0 } },
  { name: "severed", state: { severed: true, wardLevel: null, hazardMilli: 0 } },
  { name: "warded", state: { severed: false, wardLevel: 3, hazardMilli: 0 } },
  { name: "hazardous", state: { severed: false, wardLevel: null, hazardMilli: 400 } },
  { name: "warded and hazardous", state: { severed: false, wardLevel: 2, hazardMilli: 250 } },
  { name: "severed, warded and hazardous all at once", state: { severed: true, wardLevel: 1, hazardMilli: 600 } }
];
