import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { CatalogIcon } from "./CatalogIcon";
import type { ReactNode } from "react";

export type ActorSheetRailTab = {
  id: string;
  label: string;
  icon?: string | null;
  testId?: string;
};

export type ActorSheetTabRailProps = {
  tabs: ActorSheetRailTab[];
  value: string;
  onChange: (id: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onClose: () => void;
  summarize: ReactNode;
  testId?: string;
  className?: string;
};

/**
 * Vertical ActorSheet tab rail — expanded (icon + label) or collapsed (icon-only).
 * Esc close lives here so PanelShell can drop its header row.
 */
export function ActorSheetTabRail({
  tabs,
  value,
  onChange,
  collapsed,
  onCollapsedChange,
  onClose,
  summarize,
  testId = "actor-sheet-tabs",
  className
}: ActorSheetTabRailProps) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col gap-2 overflow-y-auto overflow-x-hidden border-r border-border bg-soil-raised",
        collapsed ? "w-12 px-1 py-3" : "w-44 px-2 py-3",
        className
      )}
      data-testid="actor-sheet-rail"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Actor sheet navigation"
    >
      <div
        className={cn(
          "flex shrink-0 gap-1",
          collapsed ? "flex-col items-center" : "items-center justify-between"
        )}
      >
        <button
          type="button"
          className="rounded-sm px-2 py-1 font-ui text-sm text-muted hover:bg-panel-inset hover:text-text"
          data-testid="actor-sheet-close"
          aria-label="Close"
          title="Close (Esc)"
          onClick={onClose}
        >
          Esc
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-control bg-panel-inset text-muted hover:bg-panel hover:text-text"
          data-testid="actor-sheet-rail-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand rail" : "Collapse rail"}
          title={collapsed ? "Expand" : "Collapse"}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {summarize}

      <div
        role="tablist"
        aria-orientation="vertical"
        data-testid={testId}
        className="flex min-h-0 flex-1 flex-col gap-1"
      >
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={t.label}
              title={t.label}
              data-testid={t.testId ?? `tab-${t.id}`}
              onClick={() => onChange(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-sm border border-transparent font-ui text-sm font-bold transition-colors",
                collapsed ? "justify-center px-0 py-2" : "px-2 py-1.5 text-left",
                active
                  ? "bg-lawn text-text shadow-panel"
                  : "bg-panel-inset text-muted hover:bg-soil-raised hover:text-text"
              )}
            >
              <CatalogIcon
                icon={t.icon}
                fallbackToken={t.label.slice(0, 1)}
                className="h-4 w-4"
                testId={`actor-sheet-tab-icon-${t.id}`}
              />
              {!collapsed ? <span className="min-w-0 truncate">{t.label}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
