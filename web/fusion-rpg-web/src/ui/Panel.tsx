import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  testId
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId ?? "panel"}
      className={cn(
        "mb-4 rounded-md border border-border bg-panel p-4 shadow-panel",
        className
      )}
    >
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title ? <h2 className="font-display text-xl text-text">{title}</h2> : null}
            {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
