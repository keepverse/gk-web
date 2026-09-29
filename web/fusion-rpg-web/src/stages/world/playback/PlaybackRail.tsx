import type { PlaybackPhase } from "@/stages/world/playbackKeyframes";

export type PlaybackRailProps = {
  phases: readonly PlaybackPhase[];
  activeIndex: number;
};

/** `Growth` is a named engine no-op (`TurnEngine.cs:196-200`, `BeginPhase` with nothing added after
 * it) — most turns it runs and reports nothing, and a blank gap there reads as a loading failure
 * (GG-17), not as "nothing grew." Any other phase turning up empty gets the same honest treatment
 * rather than silently disappearing, since the engine's own phase list (§8d.1) is not guaranteed to
 * stay closed at nine forever. */
const EMPTY_PHASE_COPY: Record<string, string> = {
  Growth: "Nothing grew this night."
};

function emptyPhaseCopy(phase: string): string {
  return EMPTY_PHASE_COPY[phase] ?? "Nothing to report this phase.";
}

/**
 * The keyframe rail (world-stage W75) — a straight walk through `foldTurnReport`'s phases, in the
 * order the engine actually ran them (re-sorting here would tell a different story than the one the
 * server recorded). A phase with zero keyframes still gets its own heading and a named "nothing
 * happened" line, never a silent gap.
 *
 * Purely presentational: this component reads `activeIndex`, it does not own it — `PlaybackTransport`
 * is what advances it, and `foldTurnReport`/`flattenKeyframes` (`stages/world/playbackKeyframes.ts`)
 * already did all the folding, so this file never touches a `*Dto` type at all.
 */
export function PlaybackRail({ phases, activeIndex }: PlaybackRailProps) {
  if (phases.length === 0) {
    return (
      <p data-testid="playback-rail-empty" className="text-xs text-muted">
        No turn report to play back yet.
      </p>
    );
  }

  return (
    <div data-testid="playback-rail" className="flex flex-col gap-2 text-xs">
      {phases.map((section) => (
        <section key={section.phase} data-testid={`playback-phase-${section.phase}`}>
          <h3 className="font-display uppercase tracking-wide text-muted">{section.phase}</h3>
          {section.keyframes.length === 0 ? (
            <p data-testid={`playback-phase-empty-${section.phase}`} className="text-muted">
              {emptyPhaseCopy(section.phase)}
            </p>
          ) : (
            <ol className="flex flex-col gap-0.5">
              {section.keyframes.map((frame) => (
                <li
                  key={frame.index}
                  data-testid={`playback-keyframe-${frame.index}`}
                  data-active={frame.index === activeIndex}
                  className={frame.index === activeIndex ? "text-text" : "text-muted"}
                >
                  {frame.text}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
