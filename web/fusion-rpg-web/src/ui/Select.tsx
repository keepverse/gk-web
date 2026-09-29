import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "rounded-sm border border-border bg-soil px-2 py-1.5 text-md text-text",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
