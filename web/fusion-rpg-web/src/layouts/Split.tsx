import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Split({
  list,
  detail,
  className
}: {
  list: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]", className)}
      data-testid="split"
    >
      <div data-testid="split-list">{list}</div>
      {detail != null ? <div data-testid="split-detail">{detail}</div> : null}
    </div>
  );
}
