import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  children,
  className
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  // Use a div, not <label wrapping the control> — a wrapping label focuses the
  // input when the title is clicked and shows a text caret (annoying on Cheats).
  return (
    <div className={cn("mt-2 block text-sm text-muted", className)}>
      <div className="mb-1 block font-semibold">{label}</div>
      {children}
      {hint ? <div className="mt-1 block text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
