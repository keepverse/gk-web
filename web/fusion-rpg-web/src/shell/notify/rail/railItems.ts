import { channelFor } from "../channelSettings";
import { renderNotification } from "../format/render";
import type { NotifyCategoryId } from "../catalog";
import type { FeedState } from "../feed/feedReducer";
import type { RailMountPolicy } from "./mountPolicies";
import type { RailItem, RailItemState } from "./railStore";

/**
 * notify-client spec §5 — maps the feed's server-owned state onto the rail's five states:
 *
 * | Rail state              | From |
 * |--------------------------|------|
 * | `unread` / `opened`      | Server `unread` / `read` |
 * | `dismissed`               | Server `dismissed` |
 * | `minimized`                | `minimizedCategories` — a per-category LOCAL setting this module does not own or compute (spec §5: "unchanged"); the caller passes it through |
 * | `blocking`                  | `world-turn`'s declared list, which ships empty (spec-world-notify.md §5) — no v1 source sets this, so `blocking` is always `false` here |
 *
 * Items whose resolved channel is `off` are excluded (spec §5).
 */
export function railItemsFrom<Ctx>(
  feed: FeedState,
  policy: RailMountPolicy<Ctx>,
  ctx: Ctx,
  minimizedCategories: ReadonlySet<NotifyCategoryId> = new Set()
): RailItem[] {
  const items: RailItem[] = [];
  for (const item of Object.values(feed.byKey)) {
    if (!policy.includes(item, ctx)) continue;
    if (channelFor(item.category) === "off") continue;

    const state: RailItemState = minimizedCategories.has(item.category)
      ? "minimized"
      : item.state === "unread"
        ? "unread"
        : item.state === "read"
          ? "opened"
          : "dismissed";

    const text = renderNotification(item);
    items.push({
      id: item.dedupKey,
      dedupKey: item.dedupKey,
      seq: item.seq,
      category: item.category,
      severity: item.severity,
      title: text.title,
      body: text.body,
      state,
      worldId: item.worldId ?? null,
      worldTurn: item.worldTurn ?? null,
      blocking: false
    });
  }
  return items;
}
