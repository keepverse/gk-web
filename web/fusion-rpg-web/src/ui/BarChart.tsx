import { cn } from "@/lib/cn";

/**
 * T13/T19: the horizontal-bar shape, rebuilt from theme tokens instead of `recharts` (T13's
 * dependency-removal goal). Same external shape as before this rebuild, so every existing caller
 * (`RpgProgressionPage.tsx`) is unchanged.
 */
export type BarChartItem = {
  label: string;
  value: number;
  tone?: "sun" | "lawn" | "zombie" | "bad" | "ok";
};

const toneFill: Record<NonNullable<BarChartItem["tone"]>, string> = {
  sun: "var(--color-sun)",
  lawn: "var(--color-lawn-hot)",
  zombie: "var(--color-zombie)",
  bad: "var(--color-bad)",
  ok: "var(--color-ok)"
};

export function BarChart({
  items,
  className,
  testId = "bar-chart",
  emptyLabel = "No data"
}: {
  items: BarChartItem[];
  className?: string;
  testId?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <div data-testid={testId} className={cn("text-sm text-muted", className)}>
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));

  return (
    <div data-testid={testId} className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      {items.map((item) => {
        const fill = toneFill[item.tone ?? (item.value < 0 ? "bad" : "sun")];
        const pct = (Math.abs(item.value) / max) * 100;
        return (
          <div key={item.label} className="flex items-center gap-2 text-xs" data-testid={`${testId}-row`}>
            <span className="w-20 shrink-0 truncate text-muted" title={item.label}>
              {item.label}
            </span>
            <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm bg-panel-inset">
              <span
                className="block h-full rounded-sm transition-[width]"
                style={{ width: `${pct}%`, background: fill }}
              />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums text-text">
              {item.value >= 0 ? `+${item.value.toFixed(0)}` : item.value.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
