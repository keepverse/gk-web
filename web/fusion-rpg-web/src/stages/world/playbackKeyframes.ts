import type { WorldTurnReportDto } from "@/lib/bus/world";
import { describePlaybackEntry } from "./playbackTable";

/** Report entries the rail has nothing to say about. */
const SKIPPED_KINDS = new Set(["command.accepted"]);

/** One real, playable moment on the rail — never a phase heading, which has no keyframe of its own. */
export type PlaybackKeyframe = {
  index: number;
  phase: string;
  text: string;
  focusId: string | null;
};

/** One phase's own rail section, in report order — `keyframes` is empty for a phase that ran with
 * nothing to report (`Growth`'s own named no-op, most turns), which is exactly when the rail must
 * say so rather than show a blank gap (GG-17). */
export type PlaybackPhase = {
  phase: string;
  keyframes: PlaybackKeyframe[];
};

/**
 * Report → phases → keyframes, walked in report order (world-stage W75). The engine already wrote
 * the turn in the order it unfolded (movement resolves through a discrete-event queue), so
 * re-sorting here would tell a different story than the one the server recorded — the same
 * constraint `turnPlayback.ts`'s own `toKeyframes` documents. `report.phases` is the full ordered
 * list of every phase the *engine* ran this turn (`TurnEngine.cs:44-63`, `BeginPhase` called
 * unconditionally per phase), including one with zero entries — grouping by that list, not by the
 * entries actually seen, is what keeps an empty phase from silently vanishing instead of rendering
 * its own "nothing happened" heading. `focusId` reads the entry's own `sectorId` field directly
 * (`WorldDtos.cs:485`, "where it happened, when it happened anywhere") rather than parsing it back
 * out of `detail`, which `turnPlayback.ts`'s older `focusOf` had to do before that field existed.
 */
export function foldTurnReport(report: WorldTurnReportDto | null | undefined): PlaybackPhase[] {
  if (!report) return [];

  let index = 0;
  return report.phases.map((phase) => {
    const keyframes: PlaybackKeyframe[] = [];
    for (const entry of report.entries) {
      if (entry.phase !== phase || SKIPPED_KINDS.has(entry.kind)) continue;
      keyframes.push({
        index: index++,
        phase,
        text: describePlaybackEntry({
          kind: entry.kind,
          subject: entry.subject,
          detail: entry.detail,
          sectorId: entry.sectorId ?? null
        }),
        focusId: entry.sectorId ?? null
      });
    }
    return { phase, keyframes };
  });
}

/** Flattened, in the same order — what the transport actually steps through; a phase heading with
 * no entries contributes nothing here, so the rail's own length never changes because of one. */
export function flattenKeyframes(phases: readonly PlaybackPhase[]): PlaybackKeyframe[] {
  return phases.flatMap((p) => p.keyframes);
}

/** Where the transport should land next — clamped, so pressing past either end simply stops
 * (matching `turnPlayback.ts`'s own `stepPlayback`). `delta` of `±Infinity` jumps to either end. */
export function stepKeyframe(current: number, total: number, delta: number): number {
  if (total === 0) return 0;
  return Math.max(0, Math.min(total - 1, current + delta));
}
