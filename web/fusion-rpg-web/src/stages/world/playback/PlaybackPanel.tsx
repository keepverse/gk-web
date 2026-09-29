import { useEffect, useState } from "react";
import { useWorldTurnReport } from "@/lib/bus/world";
import { foldTurnReport, flattenKeyframes, stepKeyframe } from "@/stages/world/playbackKeyframes";
import { PlaybackRail } from "./PlaybackRail";
import { PlaybackTransport } from "./PlaybackTransport";

export type PlaybackPanelProps = {
  worldId: string;
  /** The turn whose report this panel plays back — the last one that actually finished, i.e.
   * `dto.currentTurn - 1` (report index N is the step that advanced turn N to N+1). */
  turn: number;
};

/**
 * world-stage — hosts the already-built `PlaybackRail`/`PlaybackTransport` (Phase 2, W72-76) against
 * a real turn report. Neither of those two components owns any state or fetches anything themselves
 * by design; this is the container that was still missing, the same "built but never mounted" gap
 * `WorldHud`/`TurnCluster` had until this pass.
 */
export function PlaybackPanel({ worldId, turn }: PlaybackPanelProps) {
  const report = useWorldTurnReport(worldId, turn >= 0 ? turn : null);
  const phases = foldTurnReport(report.data);
  const keyframes = flattenKeyframes(phases);
  const [activeIndex, setActiveIndex] = useState(0);

  // A fresh turn's report is a different timeline — start back at its first moment rather than
  // carrying over whatever position the previous turn's report happened to be scrubbed to.
  useEffect(() => setActiveIndex(0), [turn]);

  return (
    <div data-testid="playback-panel" className="pointer-events-auto flex flex-col gap-2 rounded-md border border-border bg-panel p-3">
      <PlaybackTransport
        current={activeIndex}
        total={keyframes.length}
        onStep={(delta) => setActiveIndex((current) => stepKeyframe(current, keyframes.length, delta))}
      />
      <PlaybackRail phases={phases} activeIndex={keyframes[activeIndex]?.index ?? -1} />
    </div>
  );
}
