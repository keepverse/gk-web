import { renderNotification } from "@/shell/notify/format/render";
import { resolveTargetAction, type TargetAction } from "@/shell/notify/targetActions";
import type { NotificationItem, NotifyCategoryId, NotifyChannel, NotifySeverity, NotifyState } from "@/shell/notify/catalog";

export type NoticesCategoryVm = {
  id: NotifyCategoryId;
  name: string;
  channel: NotifyChannel;
  unread: number;
};

export type NoticesRowVm = {
  seq: number;
  dedupKey: string;
  title: string;
  body: string;
  state: NotifyState;
  severity: NotifySeverity;
  category: NotifyCategoryId;
  /** §6's "act on one important event = 1 click" — `null` when no mount has registered a
   * resolver for this row's target kind (or the row carries none). A `null` action is a HIDDEN
   * button, never a disabled one (GG-55 does not apply, notify-centre spec §Design bullet 3). */
  action: TargetAction | null;
};

export type NoticesVm = {
  categories: NoticesCategoryVm[];
  rows: NoticesRowVm[];
  selected: NotifyCategoryId | null;
};

export type NoticesFeedInput = { byKey: Readonly<Record<string, NotificationItem>> };
export type NoticesCatalogInput = { categories: readonly { id: NotifyCategoryId; displayName: string }[] };
export type NoticesChannelsInput = Readonly<Record<NotifyCategoryId, NotifyChannel>>;

export type NoticesInput = {
  /** The persisted selection (`noticesUiStore.ts`) — `null` before any category was ever chosen. */
  selected: NotifyCategoryId | null;
  catalog: NoticesCatalogInput;
  channels: NoticesChannelsInput;
  feed: NoticesFeedInput;
  /** Flattened history page items for `selected` only — the caller (`NoticesSurface`) flattens
   * `useNotificationHistory`'s own `data.pages`; this fold stays agnostic to react-query's shape. */
  history: readonly NotificationItem[];
};

function countUnread(feed: NoticesFeedInput, categoryId: NotifyCategoryId): number {
  let n = 0;
  for (const item of Object.values(feed.byKey)) {
    if (item.category === categoryId && item.state === "unread") n++;
  }
  return n;
}

function toNoticeRow(item: NotificationItem): NoticesRowVm {
  const text = renderNotification(item);
  return {
    seq: item.seq,
    dedupKey: item.dedupKey,
    title: text.title,
    body: text.body,
    state: item.state,
    severity: item.severity,
    category: item.category,
    action: resolveTargetAction(text.target)
  };
}

/**
 * Merges the live feed's items for `category` with the paged history's, deduped on `dedupKey`
 * (the higher `rev` wins — `feedReducer.ts`'s own merge rule, so a rail dismiss and a centre
 * dismiss of the same row always agree, spec Testing 6), newest first (`seq desc`, matching
 * `notify-service` spec §4's own history ordering).
 */
function rowsFor(feed: NoticesFeedInput, history: readonly NotificationItem[], category: NotifyCategoryId): NotificationItem[] {
  const byKey = new Map<string, NotificationItem>();
  for (const item of history) {
    if (item.category !== category) continue;
    byKey.set(item.dedupKey, item);
  }
  for (const item of Object.values(feed.byKey)) {
    if (item.category !== category) continue;
    const held = byKey.get(item.dedupKey);
    if (!held || item.rev > held.rev) byKey.set(item.dedupKey, item);
  }
  return [...byKey.values()].sort((a, b) => b.seq - a.seq);
}

/**
 * notify-centre spec §2 step 4 — pure; the surface renders what this returns and nothing else
 * (`gui-lego-ideal.md` principle 6: pieces never fetch). Every registered category appears,
 * including one with zero rows or routed `off` — the centre is the only place a player can find a
 * category they silenced (spec §Objective).
 */
export function foldNoticesVm(input: NoticesInput): NoticesVm {
  const category = input.selected ?? input.catalog.categories[0]?.id ?? null;
  return {
    categories: input.catalog.categories.map((c) => ({
      id: c.id,
      name: c.displayName,
      channel: input.channels[c.id] ?? "rail",
      unread: countUnread(input.feed, c.id)
    })),
    rows: category ? rowsFor(input.feed, input.history, category).map(toNoticeRow) : [],
    selected: category
  };
}
