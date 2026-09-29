import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Plate-13 list | inspector split. Each pane may scroll independently; never pushes band 3. */
export function InspectSplit({
  list,
  inspector,
  className,
  testId = "inspect-split"
}: {
  list: ReactNode;
  inspector: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]",
        className
      )}
    >
      <div className="min-h-0 min-w-0 overflow-y-auto" data-testid={`${testId}-list`}>
        {list}
      </div>
      <aside
        className="min-h-0 space-y-3 overflow-y-auto rounded-sm border border-border bg-soil-raised p-3"
        data-testid={`${testId}-inspector`}
      >
        {inspector}
      </aside>
    </div>
  );
}
