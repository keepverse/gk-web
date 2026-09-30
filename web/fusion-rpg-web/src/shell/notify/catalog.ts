// notify-vocabulary spec §3, §4 - a category id is an open string. Promotion is read from ONE
// block. The server never routes by channel (that is a web-only setting), so NotifyChannel lives
// here, not in the wire DTOs.
import catalogJson from "@gk-core/data/tuning/notification-catalog.v3.json";

export type NotifyCategoryId = string;
export type NotifyChannel = "toast" | "rail" | "off";
export type NotifySeverity = "routine" | "important" | "critical";
export type NotifyArgKind = "magnitude" | "count" | "worldTurn" | "ref" | "domainToken";
export type NotifyDelivery = "live" | "catchUp";
export type NotifyRefKind = "sector" | "lane" | "faction" | "legion" | "structure" | "cache";
export type NotifyState = "unread" | "read" | "dismissed";

/** TS mirror of `NotifyArgDto` (notify-vocabulary spec §3). `value` is kind-shaped JSON: Magnitude
 * = {unit,value,op?,channel?}; Count = number; WorldTurn = number; Ref = {refKind,id}; DomainToken
 * = string. Only the domain translator that owns the category may read a DomainToken value. */
export interface NotifyArg {
  name: string;
  kind: NotifyArgKind;
  value: unknown;
}

/** TS mirror of `NotificationDto` (notify-vocabulary spec §3). `seq`/`rev` are `long` on the wire;
 * a per-save counter stays well under 2^53, so `number` matches this repo's existing convention
 * (e.g. `playerId: number` in `lib/bus/aptitudePresets.ts`). */
export interface NotificationItem {
  seq: number;
  rev: number;
  dedupKey: string;
  category: NotifyCategoryId;
  severity: NotifySeverity;
  sourceId: string;
  messageKey: string;
  args: NotifyArg[];
  subjectKey?: string | null;
  worldId?: string | null;
  worldTurn?: number | null;
  state: NotifyState;
  createdUtc: string;
}

// notify-client spec §1, §Design 2 — wire mirrors of the rest of notify-vocabulary's DTOs
// (`NotificationDtos.cs`), colocated with `NotificationItem` for the same reason: they mirror the
// SAME server file, and `lib/bus/notifications.ts` is the only importer outside this module.

/** TS mirror of `NotificationBatchDto` — the SignalR `NotificationBatch` payload (R-N6: one
 * ordered set). `delivery = "live"` may toast (notify-client §4); `"catchUp"` never does. */
export interface NotificationBatch {
  playerId: number;
  delivery: NotifyDelivery;
  items: NotificationItem[];
}

/** TS mirror of `NotificationStateChangeDto`. */
export interface NotificationStateChange {
  seq: number;
  rev: number;
}

/** The state a `POST …/state` call may set — never `"unread"` (server-only initial value). */
export type NotifySetState = "read" | "dismissed";

/** TS mirror of `NotificationStateChangedDto` — the SignalR `NotificationStateChanged` payload
 * (F5). One `state` for the whole `changes` list, since one POST sets one target state for many
 * seqs at once. */
export interface NotificationStateChangedEvent {
  playerId: number;
  state: NotifySetState;
  changes: NotificationStateChange[];
}

/** TS mirror of `NotificationPageDto` — the catch-up (`/api/notifications/{id}`) and history
 * (`/api/notifications/{id}/history`) GET response shape. */
export interface NotificationPage {
  items: NotificationItem[];
  nextSince: number;
  hasMore: boolean;
}

interface CatalogCategoryJson {
  id: string;
  domain: string;
  displayName: string;
  messageKeys: string[];
}
// Cast, not inference: an empty `categories: []` in v1's JSON would otherwise infer `never[]`.
const categories = catalogJson.categories as CatalogCategoryJson[];

const toastTier = new Set<string>(catalogJson.promotions.toast);
const domainById = new Map<string, string>(categories.map((c) => [c.id, c.domain]));
const displayNameById = new Map<string, string>(categories.map((c) => [c.id, c.displayName]));

/** Registered but unpromoted means the rail. A category can never grant itself the toast (R-N2). */
export function defaultChannelOf(id: NotifyCategoryId): NotifyChannel {
  return toastTier.has(id) ? "toast" : "rail";
}

/** The registry key `notify-format`'s translator registry is keyed by (map §Registry). Undefined
 * for an id the catalog does not register - the coverage guard is what keeps that from happening
 * for any category actually in the catalog. */
export function domainOf(id: NotifyCategoryId): string | undefined {
  return domainById.get(id);
}

/** The authored player-facing name (GG-62) - never a title-cased id. Falls back to the raw id only
 * for a category the catalog does not register, which the coverage guard makes unreachable for any
 * real (catalog-declared) category. */
export function displayNameOf(id: NotifyCategoryId): string {
  return displayNameById.get(id) ?? id;
}
