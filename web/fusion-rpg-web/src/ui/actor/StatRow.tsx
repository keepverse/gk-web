import { HelpCircle } from "lucide-react";
import { Line, LineChart } from "recharts";
import { cn } from "@/lib/cn";
import { CatalogIcon } from "./CatalogIcon";

export function StatRow({
  icon,
  displayName,
  valueLabel,
  spark,
  reading,
  color,
  selected,
  onSelect,
  testId
}: {
  icon?: string | null;
  displayName: string;
  valueLabel: string;
  spark?: number[];
  reading?: string;
  color?: string | null;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left",
        selected ? "border-lawn-hot bg-lawn/15" : "border-border-control bg-panel-inset"
      )}
    >
      <CatalogIcon icon={icon} color={color} fallbackToken={displayName.slice(0, 1)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-sm text-text">{displayName}</span>
        {reading ? <span className="block truncate text-2xs text-muted">{reading}</span> : null}
      </span>
      <span className="font-mono text-sm text-text">{valueLabel}</span>
      {spark && spark.length > 0 ? (
        <LineChart
          width={72}
          height={24}
          data={(spark.length === 1 ? [0, spark[0]!] : spark).map((value, index) => ({ index, value }))}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          aria-hidden
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-lawn-hot)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      ) : null}
      <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
    </button>
  );
}
