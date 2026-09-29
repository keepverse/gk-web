import { create } from "zustand";
import type { NotifySeverity } from "./notify/catalog";

export type ToastTone = "ok" | "bad" | "warn";

export type ToastEntry = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  /** world-stage W84: an optional action the toast itself can run — running it also dismisses the
   * toast, the same as any other resolution. Additive: a toast built without one renders exactly as
   * it always did. */
  action?: { label: string; run: () => void };
  /** world-stage W84: which `world-notify` category (§4) this toast belongs to, when it has one.
   * Absent for every non-`world-notify` toast in the app today — additive, not a required field. */
  category?: string;
  /** notify-client spec §4 — additive. Absent for every non-notification toast (mutation feedback
   * has none and counts as routine in `selectVisibleToasts`, `toastSelection.ts`). */
  severity?: NotifySeverity;
};

type ToastStackState = {
  toasts: ToastEntry[];
  push: (toast: Omit<ToastEntry, "id">, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

let nextId = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_DURATION_MS = 5000;

/**
 * Band-4 (GG-5): auto-expiring, never blocks input, no Esc/close affordance
 * — the one band that dismisses itself. Every mutation's result (T11) lands
 * here via the global `MutationCache` listener in `app/providers.tsx`.
 */
export const useToastStack = create<ToastStackState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = DEFAULT_DURATION_MS) => {
    const id = `toast-${(nextId += 1)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const timer = setTimeout(() => get().dismiss(id), durationMs);
    timers.set(id, timer);
    return id;
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clear: () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    set({ toasts: [] });
  }
}));
