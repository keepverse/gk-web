import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function HelpText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
