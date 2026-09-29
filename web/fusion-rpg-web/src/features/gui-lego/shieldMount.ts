/** Q3 — shield glance mounts only when summary is present and current > 0. */
export function isShieldSummaryMountable(
  summary: { current?: number | null } | null | undefined
): boolean {
  return summary != null && (summary.current ?? 0) > 0;
}
