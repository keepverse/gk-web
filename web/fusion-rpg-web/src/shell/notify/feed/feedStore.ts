import { create } from "zustand";
import type { NotificationItem, NotificationStateChangedEvent } from "../catalog";
import {
  applyItems as applyItemsPure,
  applyStateChange as applyStateChangePure,
  initialFeedState,
  resetForPlayer as resetForPlayerPure,
  type FeedState,
  type FeedStatus
} from "./feedReducer";

type FeedStoreState = FeedState & {
  resetForPlayer: (playerId: number) => void;
  applyItems: (items: readonly NotificationItem[], playerId: number) => void;
  applyStateChange: (event: NotificationStateChangedEvent) => void;
  setStatus: (status: FeedStatus) => void;
};

/**
 * notify-client spec §2 — zustand, like `toastStack.ts`. Every mutating action here is a thin
 * wrapper over `feedReducer.ts`'s pure functions; this file owns no merge logic of its own.
 */
export const useNotificationFeed = create<FeedStoreState>((set) => ({
  ...initialFeedState,
  resetForPlayer: (playerId) => set(resetForPlayerPure(playerId)),
  applyItems: (items, playerId) => set((s) => applyItemsPure(s, items, playerId)),
  applyStateChange: (event) => set((s) => applyStateChangePure(s, event)),
  setStatus: (status) => set({ status })
}));

/** Test isolation — not for production. */
export function resetNotificationFeedForTests(): void {
  useNotificationFeed.setState(initialFeedState);
}
