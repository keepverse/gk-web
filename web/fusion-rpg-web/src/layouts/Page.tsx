import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Page({
  title,
  description,
  actions,
  children,
  className,
  testId
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("max-w-[1100px]", className)} data-testid={testId ?? "page"}>
      {/* A plain div, not a semantic <header>: every real consumer of this component is wrapped
          inside a PanelShell now (T12/T15/T17/T19's "wrap the already-real page" pattern), which
          already renders its own <header> banner — a second one here is a duplicate landmark
          (axe: landmark-no-duplicate-banner / landmark-unique), and a page body never needs its
          own banner landmark regardless. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3" data-testid="page-header">
        <div>
          <h1 className="font-display text-display text-text" data-testid="page-title">
            {title}
          </h1>
          {description ? (
            <div className="mt-1 text-sm text-muted" data-testid="page-description">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2" data-testid="page-actions">
            {actions}
          </div>
        ) : null}
      </div>
      <div data-testid="page-body">{children}</div>
    </div>
  );
}
