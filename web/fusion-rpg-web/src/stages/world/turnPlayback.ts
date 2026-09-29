import type { WorldTurnEntryDto, WorldTurnReportDto } from "@/lib/bus/world";

/**
 * A turn report, folded into something a viewer can watch. Pure: the report the server wrote is the
 * script, and playback never invents an event that is not in it — if the map shows a battle, the
 * turn had one.
 */

export type KeyframeKind =
  | "order"
  | "march"
  | "halt"
  | "battle"
  | "claim"
  | "supply"
  | "calendar"
  | "note";

export type Keyframe = {
  index: number;
  phase: string;
  kind: KeyframeKind;
  subject: string;
  /** One line of plain English for the playback rail. */
  text: string;
  /** The sector or lane this is about, when it names one — the thing to highlight. */
  focusId: string | null;
};

/** Report entries the playback rail has nothing to say about. */
const SKIPPED_KINDS = new Set(["command.accepted"]);

function classify(entry: WorldTurnEntryDto): KeyframeKind {
  if (entry.kind === "battle") return "battle";
  if (entry.kind === "calendar") return "calendar";
  if (entry.kind === "command.dropped") return "order";
  if (entry.detail.startsWith("arrival:")) return "march";
  if (entry.detail.startsWith("halt:") || entry.detail.startsWith("zoc:")) return "halt";
  if (entry.detail.startsWith("claim.")) return "claim";
  if (entry.detail.startsWith("supply.cut:")) return "supply";
  return "note";
}

/** The id after the last `:` — sector ids and lane ids never contain one. */
function tailOf(detail: string): string | null {
  const parts = detail.split(":");
  if (parts.length < 2) return null;
  const tail = parts[parts.length - 1].trim();
  return tail.length > 0 && tail !== "none" ? tail : null;
}

/**
 * What the map should highlight. For most entries that is the id at the end of the detail; a battle
 * puts the *winner* there and the place in the middle, and it is the place a viewer wants lit up.
 */
function focusOf(entry: WorldTurnEntryDto, kind: KeyframeKind): string | null {
  if (kind === "battle") {
    const parts = entry.detail.split(":");
    return parts.length >= 2 ? parts[1] : null;
  }

  return tailOf(entry.detail);
}

/** Who won, for a battle line. Null means mutual destruction, or a guard that held. */
function winnerOf(detail: string): string | null {
  return tailOf(detail);
}

function describe(entry: WorldTurnEntryDto, kind: KeyframeKind): string {
  const target = focusOf(entry, kind);
  switch (kind) {
    case "march":
      return `${entry.subject} reaches ${target ?? "the lane"}`;
    case "halt":
      return `${entry.subject} is halted at ${target ?? "the frontier"}`;
    case "battle": {
      const where = entry.detail.split(":")[0];
      const winner = winnerOf(entry.detail);
      return winner ? `${where} battle at ${target} — ${winner} wins` : `${where} battle at ${target} — nobody wins`;
    }
    case "claim":
      return entry.detail.startsWith("claim.held")
        ? `${target} changes hands`
        : `claim refused — ${entry.detail}`;
    case "supply":
      return `${target} is cut off`;
    case "order":
      return `${entry.subject} dropped — ${entry.detail}`;
    case "calendar":
      return `${entry.subject}: ${entry.detail}`;
    default:
      return `${entry.subject} ${entry.detail}`;
  }
}

/**
 * Report → keyframes, in report order. The engine already wrote the report in the order the turn
 * unfolded (movement resolves through a discrete-event queue), so playback is a straight walk —
 * re-sorting here would tell a different story than the one the server recorded.
 */
export function toKeyframes(report: WorldTurnReportDto | null | undefined): Keyframe[] {
  if (!report) return [];

  const frames: Keyframe[] = [];
  for (const entry of report.entries) {
    if (SKIPPED_KINDS.has(entry.kind)) continue;
    const kind = classify(entry);
    frames.push({
      index: frames.length,
      phase: entry.phase,
      kind,
      subject: entry.subject,
      text: describe(entry, kind),
      focusId: focusOf(entry, kind)
    });
  }

  return frames;
}

/** Where playback should go next — clamped, so pressing past the end simply stops. */
export function stepPlayback(current: number, frames: Keyframe[], delta: number): number {
  if (frames.length === 0) return 0;
  return Math.max(0, Math.min(frames.length - 1, current + delta));
}
