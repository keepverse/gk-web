import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  hint,
  action,
  className,
  testId
}: {
  title: string;
  hint?: string;
  /** GG-17 ("empty states teach and offer the next action"): an optional CTA — typically a
   * `<Button>` — rendered under the hint. No existing caller passes this yet, so it stays a
   * no-op for them; it exists for the first case that needs a real, clickable next step rather
   * than text alone (G4: Pacts' "bind a creature's contract from the Creatures roster" hint). */
  action?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("rounded-md border border-dashed border-border px-4 py-6 text-center", className)} data-testid={testId}>
      <p className="font-semibold text-text">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
