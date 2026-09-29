import { useEffect, useRef } from "react";
import { useExpeditions } from "@/lib/bus/expeditions";
import { useToastStack } from "@/shell/toastStack";

/** Same rule `expeditionTime.ts`'s `expeditionProgress().due` uses — pulled out standalone since
 * only the boolean is needed here, not the tick/progress math that function also computes. */
function isDue(dueUtc: string, nowMs: number): boolean {
  return nowMs >= Date.parse(dueUtc);
}

/**
 * Plate 03 §C / GG-53: "a returned expedition is a band-4 toast and a rail badge, never a
 * dialog." Polls the same real `useExpeditions` data every other consumer reads (no separate
 * mechanism) and diffs against what it has already announced, so a dispatched expedition whose
 * `dueUtc` has passed produces exactly one toast the moment this hook first observes it — not
 * once per poll, and not for expeditions that were already returned before this session started
 * (those already show up in the badge and the Expeditions layer itself; a toast for something
 * the player has had all along would be noise, not news).
 */
export function useExpeditionReturnWatcher(playerId: number) {
  const query = useExpeditions(playerId);
  const push = useToastStack((s) => s.push);
  const announced = useRef<Set<number> | null>(null);

  const items = query.data?.items ?? [];
  const serverNowMs = query.data ? Date.parse(query.data.serverUtc) : Date.now();
  const returned = items.filter((e) => e.state === "Dispatched" && isDue(e.dueUtc, serverNowMs));

  useEffect(() => {
    if (!query.data) return;
    if (announced.current === null) {
      // First observation this session: these are already-returned expeditions from before the
      // player opened the app, not new news — seed the set silently instead of toasting a batch.
      announced.current = new Set(returned.map((e) => e.id));
      return;
    }
    for (const e of returned) {
      if (announced.current.has(e.id)) continue;
      announced.current.add(e.id);
      push({ tone: "ok", title: "Expedition returned", message: `Ready to collect on the rail.` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return { returnedCount: returned.length };
}
