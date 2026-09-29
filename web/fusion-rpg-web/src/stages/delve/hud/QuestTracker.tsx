import type { Pending } from "@/contract/pending";
import type { QuestView } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";

/**
 * D5.6, spec-delve-stage.md §7's HUD row ("the quest tracker"). `QuestView`/`adaptDelveQuest` are both
 * real and tested (`QuestDtoProjection.Project`), but `DelveView.quests` itself is always
 * `pendingWithReason(...)` on the live wire today — `HandleGetDelve` sends `questsJson` as a raw,
 * unparsed string, and `adaptDelve` never calls `adaptDelveQuest` at all (confirmed by reading
 * `contract/adapt.ts` directly). This component renders both states for real, honestly — the "known"
 * branch is exercised by this file's own hand-built tests today, not by the live app, exactly the
 * posture this program already established for `FightView`/`EventView`.
 */
export function QuestTracker({ quests }: { quests: Pending<QuestView[]> }) {
  return (
    <div className="rounded border border-border bg-panel p-2 text-2xs" data-testid="delve-quest-tracker">
      <h2 className="mb-1 text-2xs uppercase tracking-wide text-muted">Quests</h2>
      {quests.state === "known" ? (
        quests.value.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {quests.value.map((q) => (
              <li
                key={q.name}
                data-testid={`delve-quest-${q.name}`}
                title={q.flavor}
                className="flex items-center justify-between gap-2"
              >
                <span className={q.done ? "text-ok" : "text-text"} data-testid={`delve-quest-name-${q.name}`}>
                  {q.name}
                </span>
                <span className="text-muted" data-testid={`delve-quest-progress-${q.name}`}>
                  {formatMagnitude(q.have)} / {formatMagnitude(q.need)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="italic text-muted" data-testid="delve-quest-tracker-empty">
            No quests taken yet
          </p>
        )
      ) : (
        <p className="italic text-muted" data-testid="delve-quest-tracker-pending">
          {quests.state === "pending" ? quests.reason : "No word on quests yet"}
        </p>
      )}
    </div>
  );
}
