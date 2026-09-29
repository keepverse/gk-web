/**
 * Pure timing helpers for the scene-switch POC — unit-tested under jsdom; no Phaser.
 */

export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return NaN;
  if (p <= 0) return sortedAscending[0]!;
  if (p >= 100) return sortedAscending[sortedAscending.length - 1]!;
  const rank = (p / 100) * (sortedAscending.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAscending[lo]!;
  const t = rank - lo;
  return sortedAscending[lo]! * (1 - t) + sortedAscending[hi]! * t;
}

export type TimingSummary = {
  count: number;
  p50: number;
  p95: number;
  max: number;
  samples: number[];
};

export function summarizeTimings(samplesMs: number[]): TimingSummary {
  const samples = samplesMs.filter((n) => Number.isFinite(n) && n >= 0);
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.length === 0 ? NaN : sorted[sorted.length - 1]!,
    samples: [...samples]
  };
}

/** Track A bar: ≤2 frames @ 60 Hz. */
export const TRACK_A_P95_MS = 1000 / 60 * 2;

/** Track B bar: cold Game swap. */
export const TRACK_B_P95_MS = 300;

export function trackAPasses(p95Ms: number): boolean {
  return Number.isFinite(p95Ms) && p95Ms <= TRACK_A_P95_MS;
}

export function trackBPasses(p95Ms: number): boolean {
  return Number.isFinite(p95Ms) && p95Ms <= TRACK_B_P95_MS;
}
