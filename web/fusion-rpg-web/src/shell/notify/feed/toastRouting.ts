import { useToastStack } from "@/shell/toastStack";
import { channelFor } from "../channelSettings";
import { renderNotification } from "../format/render";
import { resolveTargetAction } from "../targetActions";
import type { NotificationItem, NotifySeverity } from "../catalog";
import type { FeedState } from "./feedReducer";

function toneFor(severity: NotifySeverity): "ok" | "bad" | "warn" {
  if (severity === "critical") return "bad";
  if (severity === "important") return "warn";
  return "ok";
}

/**
 * notify-client spec §4 — only items from a `live` batch (F4) reach here at all (the caller,
 * `NotificationWire`, never calls this for F1/F2/F3/F4b). Within that, an item toasts only when it
 * is not already held in the feed: `feedBeforeMerge` is the feed's state from BEFORE this batch is
 * merged in, so "already held" means "the SSOT already has this dedupKey" — no separate memory of
 * what has toasted, which would leak for the life of the session and desync from an F3 reset (a
 * save switch legitimately clears what counts as "already held").
 *
 * `off` never toasts (Critical included — the player's channel setting is authoritative, map
 * §Open questions); `rail` never toasts either — only `channel === "toast"` does.
 */
export function routeLiveBatchToToasts(items: readonly NotificationItem[], feedBeforeMerge: Pick<FeedState, "byKey">): void {
  for (const item of items) {
    if (feedBeforeMerge.byKey[item.dedupKey]) continue; // a live re-delivery of a held item never re-toasts
    if (channelFor(item.category) !== "toast") continue;
    const text = renderNotification(item);
    const action = resolveTargetAction(text.target) ?? undefined; // §6: a button only when a mount claims this target kind
    useToastStack.getState().push({
      tone: toneFor(item.severity),
      title: text.title,
      message: text.body,
      category: item.category,
      severity: item.severity,
      action
    });
  }
}
