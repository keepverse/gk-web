import type { Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * A loam reading — stock, flow, or the denominator a stock is read against (world-numbers W39).
 * Pure function of a `Magnitude` (never a bare `number` — GG-46, proven by `figures.typecheck.ts`)
 * plus a sentence template; no component upstream ever asks what a number "looks like".
 *
 * **A stock renders against its denominator or a stated `Pending` reason, never a bare number.**
 * **A flow carries a period and its sign on three channels** — arrow, the real minus sign, and
 * colour (GG-27/GG-30) — never colour alone.
 */
export type LoamFigureProps =
  | { kind: "stock"; amount: Magnitude; capacity: Pending<Magnitude> }
  | { kind: "flow"; amount: Magnitude; period: string };

/** The number portion only — sign is this component's own composition, never doubled with `Intl`'s. */
function absolute(m: Magnitude): Magnitude {
  return { ...m, value: Math.abs(m.value) };
}

export function LoamFigure(props: LoamFigureProps) {
  if (props.kind === "stock") {
    const denominator =
      props.capacity.state === "known" ? formatMagnitude(props.capacity.value) : null;

    return (
      <span data-testid="loam-figure-stock" data-kind="stock" className="text-sm text-text">
        {formatMagnitude(props.amount)} loam
        {denominator ? (
          <span data-testid="loam-figure-denominator"> / {denominator}</span>
        ) : (
          <span data-testid="loam-figure-denominator-pending" className="text-muted">
            {" "}
            / {props.capacity.state === "pending" ? props.capacity.reason : "no capacity"}
          </span>
        )}
      </span>
    );
  }

  const negative = props.amount.value < 0;
  const sign = negative ? "−" : "+";
  const arrow = negative ? "▼" : "▲";

  return (
    <span
      data-testid="loam-figure-flow"
      data-sign={negative ? "negative" : "positive"}
      className={negative ? "text-sm text-rose-300" : "text-sm text-emerald-300"}
    >
      <span aria-hidden="true">{arrow}</span> {sign}
      {formatMagnitude(absolute(props.amount))} loam {props.period}
    </span>
  );
}
