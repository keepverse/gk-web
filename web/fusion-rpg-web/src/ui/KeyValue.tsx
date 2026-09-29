import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type KeyValueItem = { label: string; value: ReactNode };

export function KeyValue({
  items,
  className
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-3 text-sm">
          <dt className="font-semibold text-muted">{item.label}</dt>
          <dd className="text-text break-all">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
