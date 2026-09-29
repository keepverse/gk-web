import type { NotifyCategoryId, NotifyChannel } from "./catalog";
import { defaultChannelOf } from "./catalog";

/**
 * notify-client spec §3 — the open-id successor to `stages/world/notify/channelSettings.ts`. Same
 * shape (localStorage behind a try/catch; a change event so two mounted controls cannot drift
 * apart, live, without a reload), an open `NotifyCategoryId` instead of the closed world-notify
 * enum, and defaults from `defaultChannelOf` (notify-vocabulary §4) instead of a static table.
 *
 * REUSES the storage key from the world copy so a player's existing choices survive the move — a
 * one-wave overlap named here (spec §3), removed when `world-notify-source` deletes the old file.
 * The player's setting is authoritative for every category, Critical included (map §Open questions).
 */
const STORAGE_KEY = "fusionrpg.world-notify.channels.v1";
export const CHANNEL_SETTINGS_CHANGED_EVENT = "fusionrpg:world-notify-channels-changed";

function notifyChanged(): void {
  window.dispatchEvent(new Event(CHANNEL_SETTINGS_CHANGED_EVENT));
}

function readOverrides(): Partial<Record<NotifyCategoryId, NotifyChannel>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Partial<Record<NotifyCategoryId, NotifyChannel>>;
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Partial<Record<NotifyCategoryId, NotifyChannel>>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Preferences degrade to session-only if storage is unavailable — never throw.
  }
}

export function channelFor(id: NotifyCategoryId): NotifyChannel {
  const overrides = readOverrides();
  return overrides[id] ?? defaultChannelOf(id);
}

/** Applied to the category, never to one message (spec §6's "sentence naming the category"). */
export function setChannel(id: NotifyCategoryId, channel: NotifyChannel): void {
  const next = { ...readOverrides(), [id]: channel };
  writeOverrides(next);
  notifyChanged();
}

/** Test-only: clears the persisted table without going through `setChannel`'s own change event. */
export function clearChannelSettingsForTests(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
