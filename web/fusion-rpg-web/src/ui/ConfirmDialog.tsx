import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  testId = "confirm-dialog"
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="band-dialog fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      data-testid={`${testId}-backdrop`}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid={testId}
        className={cn(
          "w-full max-w-md rounded-md border border-border bg-panel p-4 shadow-panel"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-xl text-text">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-muted">
          {message}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            data-testid={`${testId}-cancel`}
            size="sm"
            variant="ghost"
            disabled={busy}
            title={busy ? "Working — can't cancel mid-request" : undefined}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            data-testid={`${testId}-confirm`}
            size="sm"
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={busy}
            title={busy ? "Working…" : undefined}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
