import { useEffect } from "react";
import {
  fetchNotificationsSince,
  subscribeNotificationBatch,
  subscribeNotificationStateChanged
} from "@/lib/bus/notifications";
import { subscribePlayerJoined } from "@/lib/bus/playerRouting";
import { useNotificationFeed } from "./feed/feedStore";
import { routeLiveBatchToToasts } from "./feed/toastRouting";
import type { NotificationBatch, NotificationStateChangedEvent } from "./catalog";

// Module-level, not component state: `NotificationWire` mounts exactly once app-wide (spec "One
// app-level mount", beside `<Toasts />`), and a retry triggered from elsewhere (the rail/centre's
// designed failed state) must cooperate with the SAME in-flight guard as the wire's own F1/F2/F3
// triggers — otherwise a stale response could land after a newer save switch already reset the feed.
let catchUpToken = 0;

async function runCatchUp(playerId: number, since: number, reset: boolean): Promise<void> {
  const token = ++catchUpToken;
  if (reset) useNotificationFeed.getState().resetForPlayer(playerId);
  try {
    const page = await fetchNotificationsSince(playerId, since);
    if (token !== catchUpToken) return; // superseded by a later trigger
    useNotificationFeed.getState().applyItems(page.items, playerId);
  } catch {
    if (token !== catchUpToken) return;
    useNotificationFeed.getState().setStatus("error");
  }
}

/**
 * GG-17 — the retry the designed failed state (rail/centre) calls. Re-attempts from the last known
 * cursor for the currently shown save; a no-op before the first `player-joined`.
 */
export function retryNotificationCatchUp(): void {
  const s = useNotificationFeed.getState();
  if (s.playerId === null) return;
  void runCatchUp(s.playerId, s.maxRev, false);
}

/**
 * notify-client spec §1, §2 — F1 through F7 wiring. Mounted once beside `<Toasts />` in `App.tsx`;
 * renders nothing. The server is the one source for the feed (boundary: "Never: a client-side
 * local push into the feed") — every trigger here resets, pages the catch-up GET, or applies a
 * pushed batch; nothing here invents an item.
 */
export function NotificationWire() {
  useEffect(() => {
    // F1 (first join, `playerId` was null) / F2 (reconnect — `player-routing` T2 re-emits
    // `player-joined` for the SAME id, no reset) / F3 (save switch — a DIFFERENT id, reset).
    const offPlayerJoined = subscribePlayerJoined((playerId) => {
      const s = useNotificationFeed.getState();
      const isFirstOrSwitch = s.playerId === null || s.playerId !== playerId;
      void runCatchUp(playerId, isFirstOrSwitch ? 0 : s.maxRev, isFirstOrSwitch);
    });

    // F4 (delivery = live) / F4b (delivery = catchUp) / F7 (another save's batch, dropped).
    const offBatch = subscribeNotificationBatch((batch: NotificationBatch) => {
      const s = useNotificationFeed.getState();
      if (batch.playerId !== s.playerId) return; // F7
      if (batch.delivery === "live") {
        routeLiveBatchToToasts(batch.items, s); // only items not already held toast (§4)
      }
      useNotificationFeed.getState().applyItems(batch.items, batch.playerId);
    });

    // F5 — a state change made elsewhere (another session, or this one's own push echo).
    const offStateChanged = subscribeNotificationStateChanged((event: NotificationStateChangedEvent) => {
      useNotificationFeed.getState().applyStateChange(event);
    });

    return () => {
      offPlayerJoined();
      offBatch();
      offStateChanged();
    };
  }, []);

  return null;
}
