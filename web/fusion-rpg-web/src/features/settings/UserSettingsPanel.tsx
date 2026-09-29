import { useCallback, useEffect, useState } from "react";
import { Button, HelpText } from "@/ui";
import {
  fetchUserSettings,
  putUserSetting,
  readBoolSetting,
  VISUAL_EFFECTS_KEY,
  WORLD_HUD_KEY,
  type UserSettingsResponse,
} from "./userSettings";

/**
 * The player's own settings (`solid-remediation`, 2026-09-17).
 *
 * Server-backed rather than `localStorage`: these follow the player, and the injector pulls them so
 * the running game honours a choice made here. The key list is closed and owned by
 * `FusionRpg.Core.Settings.UserSettingKeys`, so this panel renders whatever the server declares
 * instead of hard-coding a list that would drift.
 */
export function UserSettingsPanel() {
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    try {
      setSettings(await fetchUserSettings());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "settings fetch failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (key: string, next: boolean) => {
      setBusy(key);
      try {
        await putUserSetting(key, next);
        await refresh();
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : `could not save ${key}`);
      } finally {
        setBusy("");
      }
    },
    [refresh],
  );

  const entries = settings?.entries ?? [];

  return (
    <section aria-label="Display settings" className="flex flex-col gap-3" data-testid="user-settings-panel">
      {error ? <HelpText className="text-danger">{error}</HelpText> : null}

      {entries.length === 0 && !error ? <HelpText>Loading settings…</HelpText> : null}

      {entries.map((entry) => {
        const on = readBoolSetting(settings, entry.key);
        return (
          <div key={entry.key} className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <span className="font-medium">{labelFor(entry.key)}</span>
              <HelpText>{entry.summary}</HelpText>
              {entry.isDefault ? <HelpText>Using the default.</HelpText> : null}
            </div>
            <Button
              type="button"
              aria-pressed={on}
              disabled={busy === entry.key}
              data-testid={`user-setting-${entry.key}`}
              // GG-55: a disabled control says why. Saving is the only reason this one disables.
              title={busy === entry.key ? "Saving…" : undefined}
              onClick={() => void toggle(entry.key, !on)}
            >
              {on ? "On" : "Off"}
            </Button>
          </div>
        );
      })}
    </section>
  );
}

/** Player-facing name. The server sends a developer summary; this is what the setting is called. */
function labelFor(key: string): string {
  if (key === WORLD_HUD_KEY) return "In-world actor HUD";
  if (key === VISUAL_EFFECTS_KEY) return "Visual effects";
  return key;
}
