import type { WorldTurnCommandDto, WorldTurnReportDto } from "@/lib/bus/world";

export type CommanderIntent = {
  commanderId: string;
  commandId: string;
  /** What it did, in the order's own vocabulary. */
  action: string;
  /** Why it did it, as the policy explained itself. */
  reason: string;
};

/**
 * The orders somebody had to think about (spec-ai-commander.md §The AI explains itself).
 *
 * Under fog an opponent's mistake and a bug in the opponent look exactly alike from outside: both
 * are a legion walking somewhere that makes no sense. The reason is the only thing that separates
 * them — "expand, value 640" reads as a character acting on a six-turn-old report, and its absence
 * reads as a defect. That is why this is a shipped panel and not a log line.
 *
 * Orders without a reason are the player's own, and are left out: you already know why you did it.
 */
export function toCommanderIntents(report: WorldTurnReportDto | null | undefined): CommanderIntent[] {
  if (!report?.commands) return [];

  return report.commands
    .filter((c): c is WorldTurnCommandDto & { reason: string } => Boolean(c.reason))
    .map((c) => ({
      commanderId: c.commanderId,
      commandId: c.commandId,
      action: describe(c),
      reason: c.reason
    }));
}

/** The order as a phrase. Deliberately terse — the reason beside it carries the meaning. */
function describe(command: WorldTurnCommandDto): string {
  const subject = command.entityId ?? command.commanderId;

  switch (command.kind) {
    case "move":
      return command.sectorId ? `${subject} → ${command.sectorId}` : `${subject} marches`;
    case "clear":
      return `${subject} clears ${command.sectorId ?? "a slot"}`;
    case "claim":
      return `${subject} claims ${command.sectorId ?? "the sector"}`;
    case "stance":
      return `${subject} changes posture`;
    case "stand-fast":
      return `${subject} holds`;
    default:
      return `${subject} ${command.kind}`;
  }
}
