import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Grid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)} {...props} />;
}
