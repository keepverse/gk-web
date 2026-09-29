import { cn } from "@/lib/cn";

/**
 * T13/T19: the sparkline shape, rebuilt from theme tokens instead of `recharts` (T13's
 * dependency-removal goal). A plain inline SVG polyline — same external shape as before this
 * rebuild, so every existing caller (`RpgProgressionPage.tsx`) is unchanged.
 */
export function Sparkline({
  values,
  className,
  testId = "sparkline",
  height = 48
}: {
  values: number[];
  className?: string;
  testId?: string;
  height?: number;
  width?: number;
}) {
  if (values.length === 0) {
    return (
      <div data-testid={testId} className={cn("text-sm text-muted", className)}>
        No recent XP
      </div>
    );
  }

  const width = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div data-testid={testId} className={cn("w-full max-w-md", className)} style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height="100%">
        <polygon points={areaPoints} fill="var(--color-sun)" fillOpacity={0.2} />
        <polyline points={points} fill="none" stroke="var(--color-sun)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
