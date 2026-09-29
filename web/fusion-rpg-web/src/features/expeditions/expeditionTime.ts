/**
 * Pure expedition timeline display math (spec-expeditions.md): tick pro-rating mirrors the
 * server (elapsed ticks = whole tick boundaries crossed, clamped to the tier's tick count).
 */

export type ExpeditionProgress = {
  due: boolean;
  elapsedTicks: number;
  remainingMs: number;
  /** 0..1 fraction of the full duration. */
  progress: number;
};

export function expeditionProgress(
  dispatchedUtc: string,
  dueUtc: string,
  tickMinutes: number,
  tickCount: number,
  nowMs: number
): ExpeditionProgress {
  const dispatched = Date.parse(dispatchedUtc);
  const due = Date.parse(dueUtc);
  const total = Math.max(1, due - dispatched);
  const elapsed = Math.max(0, nowMs - dispatched);
  const tickMs = Math.max(1, tickMinutes * 60_000);
  return {
    due: nowMs >= due,
    elapsedTicks: Math.min(tickCount, Math.floor(elapsed / tickMs)),
    remainingMs: Math.max(0, due - nowMs),
    progress: Math.min(1, elapsed / total)
  };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "due";
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
