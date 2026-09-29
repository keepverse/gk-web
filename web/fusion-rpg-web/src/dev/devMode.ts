/**
 * The developer tree's own persisted flag (T12) — `localStorage`, per T4's
 * decision that preferences live there. Default off; nothing about the
 * player build turns it on by itself.
 *
 * `?dev=1` / `?dev=0` on any URL flips and persists it — the "give me the
 * cheat code" pattern most apps use before a real settings toggle exists
 * (that's T20's job; System is where a durable UI for this belongs).
 */
const STORAGE_KEY = "fusionrpg.devMode";

export function isDevModeEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevModeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* localStorage unavailable (private mode, etc.) — dev mode just won't persist */
  }
}
