import type { Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";

/** `null` reads as "later" visually (dotted/faint) but the turn is never asserted in text unless
 * it is genuinely known — see the module comment on why the split itself cannot be computed here. */
export type RouteHop = {
  laneId: string;
  /** `world-wire` W9's per-lane cost, fog-honest (belief, never truth) when known. */
  cost: Pending<Magnitude>;
  /** The turn this hop resolves on, **as an absolute turn index** (`T`, `T+1`, …), when the
   * engine has actually projected it. */
  turn: Pending<number>;
};

export type RoutePreviewProps = {
  hops: RouteHop[];
  /** The turn the preview is drawn from — hop `turn.value === currentTurn` is "this turn," one
   * higher is "next turn," anything further is "later." */
  currentTurn: number;
};

type HopStyle = "this-turn" | "next-turn" | "later" | "unknown-timing";

function styleFor(turn: Pending<number>, currentTurn: number): HopStyle {
  if (turn.state !== "known") return "unknown-timing";
  if (turn.value === currentTurn) return "this-turn";
  if (turn.value === currentTurn + 1) return "next-turn";
  return "later";
}

/** `T` / `T+1` / `T+2` — always relative to the turn the preview is drawn from, never the absolute
 * turn index by itself (a hop resolving on turn 6 reads `T+3` when drawn from turn 3, not `T+6`). */
function turnLabel(turn: Pending<number>, currentTurn: number): string {
  if (turn.state !== "known") return "";
  const offset = turn.value - currentTurn;
  return offset === 0 ? "T" : `T+${offset}`;
}

const STYLE_CLASS: Record<HopStyle, string> = {
  "this-turn": "border-solid border-2 border-lawn-hot",
  "next-turn": "border-dashed border-2 border-warn",
  later: "border-dotted border-2 border-faint",
  "unknown-timing": "border-dotted border border-border"
};

/**
 * The route preview (world-stage W68) — select a legion and the map answers *where can I go*
 * before any button is pressed. **The route is `routeBetween`/`routeForLegion`'s own hop sequence,
 * unmodified** — this component draws it, never recomputes it. **The turn split is never computed
 * here, on purpose, even though per-lane cost now exists** (`world-wire` W9's `MarchCosts`): the
 * budget side of that arithmetic is stance-dependent and engine-owned
 * (`LaneCost.cs:32,35` — `PointsPerTurn`/`ScoutPointsPerTurn` are `const`, not tunables, not
 * projected anywhere) — summing real per-lane costs against a *guessed* per-turn budget would be
 * exactly the "second copy of a hashed engine rule in the browser" this task's own text forbids.
 * So every hop's `turn` is `Pending` until the day the engine projects it directly, and this
 * component renders that honestly (a fourth, `unknown-timing` style, distinct from "known to be
 * later") rather than guessing a split from a real cost alone.
 *
 * **Every hop also carries its turn in text, never colour/style alone** (GG-27/GG-30) — solid
 * bright / dashed amber / dotted faint carry the same fact `T` / `T+1` / `T+2` does, and colour is
 * never the only channel. **Fog over-prices and stays over-priced**: whatever `cost` this
 * component is handed renders exactly as given — it never "corrects" a belief-based cost toward
 * the true one, which would be painting authority the map does not have (GG-15).
 */
export function RoutePreview({ hops, currentTurn }: RoutePreviewProps) {
  return (
    <ol data-testid="route-preview" className="flex flex-col gap-1">
      {hops.map((hop) => {
        const style = styleFor(hop.turn, currentTurn);
        const label = turnLabel(hop.turn, currentTurn);
        return (
          <li
            key={hop.laneId}
            data-testid={`route-hop-${hop.laneId}`}
            data-style={style}
            className={`flex items-center justify-between gap-2 px-2 py-1 text-sm text-text ${STYLE_CLASS[style]}`}
          >
            <span data-testid={`route-hop-turn-${hop.laneId}`}>
              {hop.turn.state === "known" ? label : hop.turn.state === "pending" ? hop.turn.reason : "unknown"}
            </span>
            <span data-testid={`route-hop-cost-${hop.laneId}`}>
              {hop.cost.state === "known"
                ? formatMagnitude(hop.cost.value)
                : hop.cost.state === "pending"
                  ? hop.cost.reason
                  : "cost unknown"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
