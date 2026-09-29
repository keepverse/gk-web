import type { ToastEntry } from "./toastStack";

export type ToastSelection = {
  visible: ToastEntry[];
  hiddenCount: number;
};

/**
 * notify-client spec §4 (R-N4, R-N6) — pure, so `Toasts.tsx` never computes selection order
 * itself. Reads the WHOLE stack rather than only its tail: a Critical toast pushed while `cap`
 * routine toasts are already showing must still surface, not stay buried behind the count. Every
 * Critical shows first (newest first), then the remaining slots fill with the rest (newest first).
 *
 * Deterministic (R-N6: a batch is one ordered set): the result depends only on the current stack's
 * contents, never on which order its items were pushed in — the same set pushed in two different
 * orders selects the same visible toasts.
 */
export function selectVisibleToasts(toasts: readonly ToastEntry[], cap: number): ToastSelection {
  const critical: ToastEntry[] = [];
  const rest: ToastEntry[] = [];
  for (const t of toasts) (t.severity === "critical" ? critical : rest).push(t);

  // Toasts are pushed oldest-first; "newest first" is each group reversed independently, then
  // Critical ahead of the rest.
  const ordered = critical.slice().reverse().concat(rest.slice().reverse());
  return {
    visible: ordered.slice(0, cap),
    hiddenCount: Math.max(0, ordered.length - cap)
  };
}
