export type PlaybackTransportProps = {
  current: number;
  total: number;
  onStep: (delta: number) => void;
};

/**
 * The four-control transport (world-stage W75) — jump to start, step back, step forward, jump to
 * end. Never re-sorts or re-derives anything itself: every step is a plain `delta` handed to the
 * caller's own `stepKeyframe` (`stages/world/playbackKeyframes.ts`), which is the one place the
 * clamp-at-both-ends rule lives.
 */
export function PlaybackTransport({ current, total, onStep }: PlaybackTransportProps) {
  const atStart = total === 0 || current <= 0;
  const atEnd = total === 0 || current >= total - 1;

  return (
    <div className="flex items-center gap-2" data-testid="playback-transport">
      <button
        type="button"
        data-testid="playback-transport-first"
        aria-label="Jump to the first moment"
        disabled={atStart}
        onClick={() => onStep(-Infinity)}
        className="rounded-sm border border-border px-2 py-1 text-xs disabled:opacity-40"
      >
        ⏮
      </button>
      <button
        type="button"
        data-testid="playback-transport-back"
        aria-label="Step back one moment"
        disabled={atStart}
        onClick={() => onStep(-1)}
        className="rounded-sm border border-border px-2 py-1 text-xs disabled:opacity-40"
      >
        ◀
      </button>
      <span className="text-xs text-muted" data-testid="playback-transport-position">
        {total === 0 ? "Nothing to play back" : `${current + 1} / ${total}`}
      </span>
      <button
        type="button"
        data-testid="playback-transport-forward"
        aria-label="Step forward one moment"
        disabled={atEnd}
        onClick={() => onStep(1)}
        className="rounded-sm border border-border px-2 py-1 text-xs disabled:opacity-40"
      >
        ▶
      </button>
      <button
        type="button"
        data-testid="playback-transport-last"
        aria-label="Jump to the last moment"
        disabled={atEnd}
        onClick={() => onStep(Infinity)}
        className="rounded-sm border border-border px-2 py-1 text-xs disabled:opacity-40"
      >
        ⏭
      </button>
    </div>
  );
}
