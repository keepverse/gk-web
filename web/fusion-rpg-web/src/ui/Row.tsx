import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Row({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap gap-4", className)} {...props} />;
}
