import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LogStream({
  children,
  className,
  ...props
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "max-h-[420px] overflow-auto rounded-sm bg-panel-inset p-2.5 font-mono text-xs whitespace-pre-wrap shadow-inset",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
