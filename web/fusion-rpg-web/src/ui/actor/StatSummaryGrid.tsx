import type { ActorChannelDetail } from "@/contract/types";

/**
 * actor-sheet program, derived-stats-tab — a small, new key-value grid. `.statgrid` is a design-plate
 * CSS class only (00-foundation.html); this is its first real React equivalent, plain Tailwind, no
 * new CSS file.
 */
export function StatSummaryGrid({ channels }: { channels: ActorChannelDetail[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="derived-stats-summary-grid">
      {channels.slice(0, 4).map((c) => (
        <div key={c.channelId} className="rounded-sm border border-border-control bg-panel-inset p-2" data-testid={`derived-stat-${c.channelId}`}>
          <div className="text-2xs uppercase tracking-wide text-muted">{c.channelId}</div>
          <div className="font-mono text-lg text-text">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
