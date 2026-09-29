import { createSurfaceBus } from "@/features/gui-lego/createSurfaceBus";
import type { NotifyCategoryId, NotifyChannel } from "@/shell/notify/catalog";
import type { NotifyTarget } from "@/shell/notify/format/translator";

/** notify-centre spec §2 step 5 — the closed catalog for the "Notices" surface. Exactly these
 * seven; there is no other event. */
export type NoticesEvent =
  | "notices.select-category"
  | "notices.mark-read"
  | "notices.dismiss"
  | "notices.undo-dismiss"
  | "notices.load-older"
  | "notices.open-target"
  | "notices.set-channel";

export const NOTICES_EVENTS: readonly NoticesEvent[] = [
  "notices.select-category",
  "notices.mark-read",
  "notices.dismiss",
  "notices.undo-dismiss",
  "notices.load-older",
  "notices.open-target",
  "notices.set-channel"
] as const;

export function createNoticesBus() {
  return createSurfaceBus<NoticesEvent>();
}

export type NoticesBus = ReturnType<typeof createNoticesBus>;

export type NoticesSelectCategoryPayload = { category: NotifyCategoryId };
export type NoticesMarkReadPayload = { seqs: number[] };
export type NoticesDismissPayload = { seqs: number[] };
export type NoticesUndoDismissPayload = { seq: number };
export type NoticesLoadOlderPayload = { beforeSeq: number };
export type NoticesOpenTargetPayload = { target: NotifyTarget };
export type NoticesSetChannelPayload = { category: NotifyCategoryId; channel: NotifyChannel };

/** One real function per event (spec §2 step 5's Effect column) — `NoticesSurface` (NS6.11)
 * supplies the real implementations; this file only proves the wiring is exhaustive and exact. */
export type NoticesBusEffects = {
  selectCategory: (category: NotifyCategoryId) => void;
  markRead: (seqs: number[]) => void;
  dismiss: (seqs: number[]) => void;
  undoDismiss: (seq: number) => void;
  loadOlder: (beforeSeq: number) => void;
  openTarget: (target: NotifyTarget) => void;
  setChannel: (category: NotifyCategoryId, channel: NotifyChannel) => void;
};

/**
 * Subscribes every one of the seven events to exactly its own effect (spec Testing 2). Framework-
 * free — `NoticesSurface` calls this once from a `useEffect`, passing the real mutation hooks as
 * `effects`; nothing here touches React, `fetch`, or SignalR (`gui-lego-ideal.md` principle 6).
 */
export function wireNoticesBus(bus: NoticesBus, effects: NoticesBusEffects): () => void {
  const offs = [
    bus.on("notices.select-category", (p) => effects.selectCategory((p as NoticesSelectCategoryPayload).category)),
    bus.on("notices.mark-read", (p) => effects.markRead((p as NoticesMarkReadPayload).seqs)),
    bus.on("notices.dismiss", (p) => effects.dismiss((p as NoticesDismissPayload).seqs)),
    bus.on("notices.undo-dismiss", (p) => effects.undoDismiss((p as NoticesUndoDismissPayload).seq)),
    bus.on("notices.load-older", (p) => effects.loadOlder((p as NoticesLoadOlderPayload).beforeSeq)),
    bus.on("notices.open-target", (p) => effects.openTarget((p as NoticesOpenTargetPayload).target)),
    bus.on("notices.set-channel", (p) => {
      const { category, channel } = p as NoticesSetChannelPayload;
      effects.setChannel(category, channel);
    })
  ];
  return () => {
    for (const off of offs) off();
  };
}
