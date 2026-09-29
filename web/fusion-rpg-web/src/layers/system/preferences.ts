/**
 * T20's player-facing toggles (plate 06 §C). Persisted to `localStorage` — real, and they survive
 * the server being unreachable, matching the acceptance line exactly, since nothing here reads
 * from the network at all.
 *
 * Honest scoping note: "pause while away" / "damage numbers" / "skip reward moments" are
 * described in the plate as toggles "the injector already owns" (`OverlaySettingsGui.cs` is real
 * and does own equivalents) — but there is no REST bridge exposing those injector-side settings
 * to the web FE yet, and standalone-first (`decisions.md`) means this layer cannot depend on the
 * injector being present anyway. These four toggles are real, real UI, and really persist — they
 * are just not wired to the injector's own copy yet; that bridge is honest future scope, not
 * built here. "Reduce motion" has no injector equivalent at all — it's a pure web-FE setting.
 */

export type MotionPreference = "system" | "on" | "off";

export type SystemPreferences = {
  pauseWhileAway: boolean;
  damageNumbers: boolean;
  skipRewardMoments: boolean;
  reduceMotion: MotionPreference;
};

export const DEFAULT_PREFERENCES: SystemPreferences = {
  pauseWhileAway: true,
  damageNumbers: true,
  skipRewardMoments: false,
  reduceMotion: "system"
};

const STORAGE_KEY = "fusionrpg.preferences.v1";

export function readPreferences(): SystemPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<SystemPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(prefs: SystemPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences degrade to session-only if storage is unavailable — never throw.
  }
}
