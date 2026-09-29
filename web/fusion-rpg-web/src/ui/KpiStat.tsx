import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KpiStat({
  label,
  value,
  className
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[7rem] rounded-md border border-border bg-panel-inset px-3 py-2",
        className
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-xl text-sun">{value}</div>
    </div>
  );
}
