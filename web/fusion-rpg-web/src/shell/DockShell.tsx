import { type ReactNode, useEffect, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { useLayerStack } from "./layerStack";

export type DockShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
};

/**
 * Band-2 shell (GG-5), edge-anchored rather than centred — `world-inspector`'s dock, the one
 * conditional occupant of the map's left edge (§8e.1). **A sibling of `PanelShell`, not a copy**:
 * ten shipped surfaces bind to `PanelShell` itself, so this task files under "Ask first" for that
 * file and adds a new one instead, reusing exactly the mechanics that are already right —
 * layer-stack registration at band `panel` with `close` owned by the stack (`PanelShell.tsx:40-44`),
 * the Radix focus trap and restore-to-opener (`:50-54`, `:66-69`), and the body-scrolls-not-the-shell
 * discipline (GG-61) — while changing only the geometry that was wrong for a dock: centred →
 * edge-anchored, capped-width modal → full-height 380px column beside the rail.
 *
 * **Left-anchored at `92px`, matching `Rail.tsx:31`'s own `w-[92px]` literally** — docks *beside*
 * the rail, never over it, so the rail keeps its corner role with exactly one conditional occupant
 * (spec-world-hud.md §1). `inset-y-0` is this shell's own bound (analogous to `PanelShell`'s
 * `max-h-[min(720px,82vh)]`, expressed as edge-pinning instead of a height cap since a dock has no
 * "centre" to cap around) — the body is still the only part that scrolls.
 *
 * **No scrim, by design, not by omission**: Stellaris/Civ VI/Total War all dock the selected-entity
 * panel at an edge with the map still fully visible and interactive beside it (spec-world-hud.md
 * §1's own genre citation) — a dimming backdrop here would darken the very map the panel is meant to
 * be read alongside. `PanelShell`'s scrim (world-stage W55) exists because that shell floats over
 * the stage it temporarily replaces attention from; this one does not.
 */
export function DockShell({
  open,
  onOpenChange,
  title,
  subtitle,
  footer,
  children,
  testId = "dock-shell"
}: DockShellProps) {
  const id = useId();
  const push = useLayerStack((state) => state.push);
  const pop = useLayerStack((state) => state.pop);

  useEffect(() => {
    if (!open) return;
    push({ id, band: "panel", close: () => onOpenChange(false) });
    return () => pop(id);
  }, [open, id, push, pop, onOpenChange]);

  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  if (open && !wasOpenRef.current) {
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
  }
  wasOpenRef.current = open;

  return (
    // `modal={false}` — found live, not assumed: Radix's default `modal={true}` sets
    // `pointer-events: none` on the rest of the page while any Dialog is open, *even with no
    // Overlay rendered* — silently contradicting this shell's own "the map beside it stays
    // interactive by design" claim above. A real click on the map, taken through a live browser
    // rather than jsdom, landed on `<html>` instead of the sector underneath it once the dock was
    // open, which is what surfaced this.
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          data-testid={testId}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // GG-6: the stack is the single source of truth for Esc — the global keymap
            // (useGlobalKeys) owns it and calls this shell's registered `close`; Radix's own
            // built-in Escape handling would race it, so it's suppressed here.
            event.preventDefault();
          }}
          className={cn(
            "band-panel",
            "fixed inset-y-0 left-[92px] flex w-[380px] flex-col",
            "overflow-hidden border-r border-border bg-panel shadow-panel"
          )}
        >
          <header className="flex flex-none items-start justify-between gap-3 border-b border-border bg-soil-raised px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-display text-xl text-text">{title}</Dialog.Title>
              <Dialog.Description className={subtitle ? "text-xs text-muted" : "sr-only"}>
                {subtitle ?? title}
              </Dialog.Description>
            </div>
            {/* A dock has no scrim/click-away (by design — the map beside it stays interactive), so
                unlike a modal it removes one of the four ways a pointer user could otherwise close
                it. This restores that affordance explicitly rather than leaving Esc as the only
                pointer-adjacent path (world-stage W65's own "four gestures" rule). */}
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid={`${testId}-close`}
                aria-label="Close"
                className="flex-none rounded-sm px-2 py-1 text-lg leading-none text-muted hover:text-text"
              >
                <span aria-hidden="true">×</span>
              </button>
            </Dialog.Close>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
            data-testid={`${testId}-body`}
          >
            {children}
          </div>
          {footer ? (
            <footer className="flex flex-none justify-end gap-2 border-t border-border bg-soil-raised px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
