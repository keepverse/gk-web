/**
 * Centralized user settings (`solid-remediation`, 2026-09-17).
 *
 * Owner: *"Make new user setting module if we dont have centralize user settings"* — we did not.
 * The server's `settings` table is singleton app state (stats/cheats/current_player_id) with no
 * player column, and the one real preference that had shipped, `lawnViewMode`, lived in
 * `localStorage`. That cannot reach the injector and does not follow the player to another browser,
 * so a preference the GAME must honour could not live there.
 *
 * This module is the client half: the key vocabulary is closed and owned by
 * `FusionRpg.Core.Settings.UserSettingKeys`, the server persists per player, and the injector pulls
 * the value once per session. Nothing here is cached in `localStorage` — the server is the source of
 * truth, on purpose.
 */

export type UserSettingKind = "Bool";

export type UserSettingEntry = {
  key: string;
  kind: UserSettingKind;
  summary: string;
  /** JSON text as stored — `"true"` / `"false"` for a Bool. */
  value: string;
  /** True when the player has never chosen, so the value shown is the declared default. */
  isDefault: boolean;
};

export type UserSettingsResponse = {
  playerId: number;
  entries: UserSettingEntry[];
};

/** The in-world actor HUD toggle. Mirrors `UserSettingKeys.WorldHud`. */
export const WORLD_HUD_KEY = "lawn.worldHud";

/** Cosmetic VFX toggle. Mirrors `UserSettingKeys.VisualEffects`. */
export const VISUAL_EFFECTS_KEY = "lawn.visualEffects";

/**
 * Reads one boolean out of a settings response.
 *
 * Returns `fallback` when the key is absent or its value is not a JSON boolean, rather than
 * coercing: a setting that silently reads `false` because it failed to parse is indistinguishable
 * from one the player turned off.
 */
export function readBoolSetting(
  res: UserSettingsResponse | null | undefined,
  key: string,
  fallback = false,
): boolean {
  const entry = res?.entries?.find((e) => e.key === key);
  if (!entry) return fallback;
  const raw = (entry.value ?? "").trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

/** True when the player has explicitly chosen this setting (rather than inheriting the default). */
export function isExplicitlySet(
  res: UserSettingsResponse | null | undefined,
  key: string,
): boolean {
  const entry = res?.entries?.find((e) => e.key === key);
  return entry ? !entry.isDefault : false;
}

export async function fetchUserSettings(): Promise<UserSettingsResponse> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error(`settings -> ${res.status}`);
  return (await res.json()) as UserSettingsResponse;
}

/**
 * Persists one setting. The server also pushes injector-affecting keys to the running game, so the
 * caller does not have to know which ones those are.
 */
export async function putUserSetting(key: string, value: boolean): Promise<void> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`settings ${key} -> ${res.status}`);
}
