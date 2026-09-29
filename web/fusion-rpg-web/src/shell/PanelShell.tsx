import { type ReactNode, useEffect, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { useLayerStack, type Band } from "./layerStack";

export type PanelShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** GG-5's band this shell occupies in the stack — "panel" (band-2) for every ordinary layer;
   * "system" (band-5, T20) for the one settings shell reachable from an empty stack. */
  band?: Extract<Band, "panel" | "system">;
  /** ActorSheet alone uses the near-fullscreen GG-61 bound; ordinary panels keep the compact default. */
  size?: "default" | "actorSheet";
  /**
   * `none` — no header chrome; title/description are sr-only (ActorSheet owns Esc in the left rail).
   * Default keeps the visible title header.
   */
  headerMode?: "default" | "none";
};

/**
 * Band-2 shell (GG-5): Roster, inventory, almanac, log, shop, progression.
 * Bounded per GG-61 — header/footer are `flex-none`, the body is the only
 * part that scrolls, and the shell itself never grows past
 * `min(720px, 82vh)`. Focus trap and focus-restore-to-opener come from Radix
 * Dialog's own FocusScope; this wrapper does not override either.
 */
export function PanelShell({
  open,
  onOpenChange,
  title,
  subtitle,
  footer,
  children,
  testId = "panel-shell",
  band = "panel",
  size = "default",
  headerMode = "default"
}: PanelShellProps) {
  const id = useId();
  const push = useLayerStack((state) => state.push);
  const pop = useLayerStack((state) => state.pop);

  useEffect(() => {
    if (!open) return;
    push({ id, band, close: () => onOpenChange(false) });
    return () => pop(id);
  }, [open, id, band, push, pop, onOpenChange]);

  // Radix restores focus to its own Trigger by default; PanelShell is fully
  // controlled and has no Dialog.Trigger, so that default is a no-op. Capture
  // whatever had focus just before this open (during render, so it runs
  // before any child mounts and steals focus) and restore it ourselves.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  if (open && !wasOpenRef.current) {
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
  }
  wasOpenRef.current = open;

  const actorSheetBody = size === "actorSheet" && headerMode === "none";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* GG-5 amendment (world-stage W55, owner-authorised 2026-09-04): the dimming scrim is not
            the panel's own content stacking. A band-2 (Panel) scrim sits at its own tier strictly
            between Stage and HUD (`--band-scrim`) so it covers only the Stage — the HUD (band 1)
            stays fully legible and interactive above it. `band === "system"` is unaffected: the
            amendment only ever named the Panel band's scrim. */}
        <Dialog.Overlay
          className={cn(band === "system" ? "band-system" : "band-scrim", "fixed inset-0 bg-black/50")}
          data-testid={`${testId}-overlay`}
        />
        <Dialog.Content
          data-testid={testId}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // GG-6: the stack is the single source of truth for Esc. The
            // global keymap (useGlobalKeys) owns it and calls this shell's
            // registered `close`; Radix's own built-in Escape handling would
            // race it, so it's suppressed here.
            event.preventDefault();
          }}
          className={cn(
            band === "system" ? "band-system" : "band-panel",
            "fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2",
            "flex-col overflow-hidden rounded-md border border-border bg-panel shadow-panel",
            size === "actorSheet"
              ? "h-[min(960px,92vh)] w-[min(1800px,96vw)]"
              : "max-h-[min(720px,82vh)] w-[min(640px,92vw)]"
          )}
        >
          {headerMode === "none" ? (
            <div className="sr-only" data-testid={`${testId}-header`} data-header-mode="none">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{subtitle ?? title}</Dialog.Description>
            </div>
          ) : (
            <header
              className="flex flex-none items-start gap-3 border-b border-border bg-soil-raised px-4 py-3"
              data-testid={`${testId}-header`}
              data-header-mode="default"
            >
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-xl text-text">{title}</Dialog.Title>
                <Dialog.Description className={subtitle ? "text-xs text-muted" : "sr-only"}>
                  {subtitle ?? title}
                </Dialog.Description>
              </div>
            </header>
          )}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden",
              actorSheetBody ? "flex overflow-hidden p-0" : "overflow-y-auto px-4 py-4"
            )}
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
