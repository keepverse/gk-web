import { type ReactNode, useEffect, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { useLayerStack } from "./layerStack";

export type DialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  onEscapeKeyDown?: () => void;
  children: ReactNode;
  testId?: string;
  /**
   * `default` — the compact bounded band-3 decision card (confirm, reward, level-up).
   * `scene` — **full-bleed** bound for an illustrated story scene (owner decision S1).
   *
   * GG-61 EXEMPTION, scoped to `size="scene"` only — read this before "fixing" it.
   * GG-61 forbids a band-2/3 shell growing to swallow the viewport, because a DENSE ENTITY
   * (an actor's 99-channel derived sheet, an item's affix list, a comparison table) needs a
   * bounded box so its body can scroll internally. A story scene is not a dense entity and
   * **never scrolls**: its content is a fixed-aspect art bed plus one line, and its overflow is
   * a content defect caught by the beat cap, not something a scrollbar absorbs. So the failure
   * GG-61 prevents cannot occur here. The scene still *fits* the viewport — full-bleed in area,
   * still bounded by the viewport contract — rather than exceeding it.
   * Every other caller keeps the bounded card unchanged and GG-61 continues to govern them.
   * See docs/architecture/story-scene-map.md §"GG-61 exemption (S1)".
   */
  size?: "default" | "scene";
};

/**
 * Band-3 shell (GG-5): confirm, reward, level-up, contract offer. Same
 * bounded-shell contract as `PanelShell` (GG-61), narrower by default since
 * band-3 content is a decision, not a browsing surface — except for
 * `size="scene"`, which is the documented full-bleed exemption above.
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  subtitle,
  footer,
  onEscapeKeyDown,
  children,
  testId = "dialog-shell",
  size = "default"
}: DialogShellProps) {
  const id = useId();
  const push = useLayerStack((state) => state.push);
  const pop = useLayerStack((state) => state.pop);

  useEffect(() => {
    if (!open) return;
    push({ id, band: "dialog", close: () => onOpenChange(false) });
    return () => pop(id);
  }, [open, id, push, pop, onOpenChange]);

  // See PanelShell for why this is needed: Radix's default onCloseAutoFocus
  // targets its own Trigger, which this fully-controlled shell never renders.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  if (open && !wasOpenRef.current) {
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
  }
  wasOpenRef.current = open;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="band-dialog fixed inset-0 bg-black/60" data-testid={`${testId}-overlay`} />
        <Dialog.Content
          data-testid={testId}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // See PanelShell — the global keymap (T3) is the single owner of
            // Esc; Radix's own built-in handling is suppressed so it can't race it.
            event.preventDefault();
            onEscapeKeyDown?.();
          }}
          className={cn(
            "band-dialog fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2",
            "flex-col overflow-hidden rounded-md border border-border bg-panel shadow-panel",
            size === "scene"
              ? // Full-bleed, viewport-fitting, non-scrolling (GG-61 exemption, see the prop doc).
                // 100dvh not 100vh so mobile browser chrome cannot clip the scene.
                "h-[100dvh] max-h-none w-[100vw] max-w-none rounded-none border-0"
              : "w-[min(440px,92vw)] max-h-[min(720px,82vh)]"
          )}
        >
          <header className="flex flex-none items-start gap-3 border-b border-border bg-soil-raised px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-display text-xl text-text">{title}</Dialog.Title>
              <Dialog.Description className={subtitle ? "text-xs text-muted" : "sr-only"}>
                {subtitle ?? title}
              </Dialog.Description>
            </div>
          </header>
          {/* `default` scrolls its body (GG-61's dense-entity case); a scene never scrolls. */}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden px-4 py-4",
              size === "scene" ? "overflow-hidden" : "overflow-y-auto"
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
