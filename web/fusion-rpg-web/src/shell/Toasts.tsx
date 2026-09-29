import { cn } from "@/lib/cn";
import { useToastStack } from "./toastStack";
import { selectVisibleToasts } from "./toastSelection";

/**
 * Band-4. Corner-positioned and `pointer-events-none` on the container so it
 * never blocks input and never sits over a centered Dialog (GG-5's "blocks
 * input below: no" plus a layout choice, not a z-index fight — Toast (400)
 * outranks Dialog (300) in the band order, so staying out of the dialog's
 * footprint is what keeps this true rather than the stacking order alone).
 */
/** world-stage W89 (spec-world-notify.md §1) — at most three at once, newest on top, the remainder
 * behind a count rather than an ever-growing column. */
const VISIBLE_CAP = 3;

export function Toasts() {
  const toasts = useToastStack((s) => s.toasts);
  const dismiss = useToastStack((s) => s.dismiss);
  // notify-client spec §4 (R-N4) — Critical first at the cap, deterministic regardless of push order.
  const { visible, hiddenCount } = selectVisibleToasts(toasts, VISIBLE_CAP);

  return (
    <div
      className="band-toast pointer-events-none fixed bottom-4 right-4 flex flex-col items-end gap-2"
      data-testid="toast-stack"
      aria-live="polite"
    >
      {hiddenCount > 0 ? (
        <p className="pointer-events-none text-xs text-muted" data-testid="toast-hidden-count">
          +{hiddenCount} more
        </p>
      ) : null}
      {visible.map((toast) => (
        <div
          key={toast.id}
          data-testid={`toast-${toast.id}`}
          data-tone={toast.tone}
          role="status"
          className={cn(
            "pointer-events-auto min-w-[280px] max-w-[380px] rounded-sm border-l-4 bg-panel-raised px-3 py-2 text-sm shadow-panel",
            toast.tone === "ok" && "border-ok",
            toast.tone === "bad" && "border-bad",
            toast.tone === "warn" && "border-warn"
          )}
        >
          <p className="font-semibold text-text" data-testid="toast-title">
            {toast.title}
          </p>
          {toast.message ? (
            <p className="text-muted" data-testid="toast-message">
              {toast.message}
            </p>
          ) : null}
          {toast.action ? (
            <button
              type="button"
              data-testid="toast-action"
              className="mt-1 rounded-sm border border-border-control px-2 py-1 text-xs text-text hover:bg-panel"
              onClick={() => {
                toast.action!.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
