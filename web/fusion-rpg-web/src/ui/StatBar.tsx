import { cn } from "@/lib/cn";

export function StatBar({
  label,
  value,
  max = 2,
  className
}: {
  label: string;
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("mt-2", className)}>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-panel-inset shadow-inset">
        <div className="h-full rounded-pill bg-lawn-hot transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
