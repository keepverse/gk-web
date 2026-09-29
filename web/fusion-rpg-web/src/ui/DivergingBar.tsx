import { cn } from "@/lib/cn";

/**
 * T19's fourth chart shape (plate 05 §D): a signed delta is zero-anchored and coloured by sign —
 * a positive value fills right of centre in the "ok" tone, a negative one fills left of centre in
 * the "bad" tone. `scaleMax` sets what magnitude reaches the bar's edge; values are clamped to it
 * rather than ever overflowing the track.
 */
export function DivergingBar({
  value,
  scaleMax,
  className,
  testId = "diverging-bar"
}: {
  value: number;
  scaleMax: number;
  className?: string;
  testId?: string;
}) {
  const max = Math.max(1, scaleMax);
  const pct = Math.min(100, (Math.abs(value) / max) * 100) / 2;
  const positive = value >= 0;

  return (
    <div
      data-testid={testId}
      data-sign={value === 0 ? "zero" : positive ? "positive" : "negative"}
      className={cn("relative h-3 w-full overflow-hidden rounded-sm bg-panel-inset", className)}
    >
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden="true" data-testid={`${testId}-zero`} />
      {value !== 0 ? (
        <span
          className={cn("absolute inset-y-0 rounded-sm", positive ? "bg-ok" : "bg-bad-solid")}
          style={
            positive
              ? { left: "50%", width: `${pct}%` }
              : { right: "50%", width: `${pct}%` }
          }
        />
      ) : null}
    </div>
  );
}
