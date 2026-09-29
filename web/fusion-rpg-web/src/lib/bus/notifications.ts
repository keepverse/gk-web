import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { getHubConnection } from "./hub";
import { getJson, sendJson } from "./rest";
import { useNotificationFeed } from "@/shell/notify/feed/feedStore";
import type {
  NotificationBatch,
  NotificationPage,
  NotificationStateChangedEvent,
  NotifyCategoryId,
  NotifySetState
} from "@/shell/notify/catalog";

/**
 * notify-client spec §1 — one responsibility per file: this module is the ONLY place that touches
 * the SignalR connection or the REST endpoints for notifications. `getHubConnection()` directly,
 * never a new `HubProvider` handler (`hub-provider.tsx`'s own list is for query-invalidation
 * events; notifications have their own feed, not a TanStack query cache entry).
 */

export function subscribeNotificationBatch(listener: (batch: NotificationBatch) => void): () => void {
  const c = getHubConnection();
  const handler = (batch: NotificationBatch) => listener(batch);
  c.on("NotificationBatch", handler);
  return () => c.off("NotificationBatch", handler);
}

export function subscribeNotificationStateChanged(listener: (event: NotificationStateChangedEvent) => void): () => void {
  const c = getHubConnection();
  const handler = (event: NotificationStateChangedEvent) => listener(event);
  c.on("NotificationStateChanged", handler);
  return () => c.off("NotificationStateChanged", handler);
}

/**
 * notify-service spec §4's catch-up GET, paged until `hasMore` is false. Returns every item
 * fetched across every page, plus the final cursor to replay on the caller's NEXT catch-up call.
 */
export async function fetchNotificationsSince(playerId: number, since: number): Promise<NotificationPage> {
  let cursor = since;
  let items: NotificationPage["items"] = [];
  for (;;) {
    const page = await getJson<NotificationPage>(`/api/notifications/${playerId}?since=${cursor}`);
    items = items.concat(page.items);
    cursor = page.nextSince;
    if (!page.hasMore) break;
  }
  return { items, nextSince: cursor, hasMore: false };
}

type SetNotificationStateVars = { playerId: number; seqs: number[]; state: NotifySetState };
type SetNotificationStateResponse = { changed: { seq: number; rev: number }[] };

/**
 * F6 (notify-client spec §2) — read/dismiss/undo. Applies the server's response through the SAME
 * reducer path as a pushed `NotificationStateChanged` (F5), and only on success: GG-15's "never
 * paint the new state before the server returns" holds by construction because the feed is not
 * touched until `onSuccess`. The caller shows its own pending affordance from `mutation.isPending`.
 *
 * `silent: true` — read/dismiss is a frequent, low-stakes UI action whose own visible state change
 * (the item moving to read/dismissed) is already its feedback; a "Notification updated" toast on
 * every click would be exactly the noise `useLawnDebugPost`'s own `silent` precedent (mutations.ts)
 * exists to avoid.
 */
export function useSetNotificationState() {
  return useMutation({
    meta: { entity: "Notification", silent: true },
    mutationFn: async (vars: SetNotificationStateVars): Promise<SetNotificationStateResponse & { playerId: number; state: NotifySetState }> => {
      const res = await sendJson<SetNotificationStateResponse>(`/api/notifications/${vars.playerId}/state`, "POST", {
        seqs: vars.seqs,
        state: vars.state
      });
      return { ...res, playerId: vars.playerId, state: vars.state };
    },
    onSuccess: (res) => {
      useNotificationFeed.getState().applyStateChange({ playerId: res.playerId, state: res.state, changes: res.changed });
    }
  });
}

/**
 * notify-centre spec §2 step 4 — `GET …/history?category=&before=`, newest first (`seq desc`,
 * `notify-service` §4). Built on `useInfiniteQuery` (already the locked data-fetching library;
 * this is its own infinite-pagination primitive, not a new dependency) rather than a hand-rolled
 * accumulate-and-fetch hook: `fetchNextPage()` IS "load older," and it derives its own `before`
 * from the previous page's last item — the oldest item so far, since the server orders newest
 * first — exactly the cursor `notify-service`'s `history` endpoint expects. A failed page surfaces
 * through the query's own `status === "error"` (GG-17); no separate error state is invented here.
 */
/** The oldest-so-far cursor `fetchNextPage` continues from — `undefined` (no next page) once the
 * server says `hasMore: false`. A pure function so the "no more pages" edge case is a fast,
 * deterministic unit test rather than an assertion on react-query's own internal timing. */
export function nextHistoryPageParam(lastPage: NotificationPage): number | undefined {
  return lastPage.hasMore && lastPage.items.length > 0 ? lastPage.items[lastPage.items.length - 1]!.seq : undefined;
}

export function useNotificationHistory(playerId: number | null, category: NotifyCategoryId) {
  return useInfiniteQuery({
    queryKey: ["notificationHistory", playerId, category],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) => {
      const q = pageParam !== undefined ? `&before=${pageParam}` : "";
      return getJson<NotificationPage>(`/api/notifications/${playerId}/history?category=${encodeURIComponent(category)}${q}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: nextHistoryPageParam,
    enabled: playerId != null
  });
}
