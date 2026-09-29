import { getJson, sendJson } from "./rest";

/**
 * rift-gate first-open-signal: the durable once-per-player "the web FE has been opened" fact.
 *
 * Trigger only — the capture mechanism that consumes it (text sweep, portrait traversal, manifest,
 * progress UI) is a **separate program**. This writes the fact and reads back whether it can be acted
 * on; it builds no capture.
 *
 * Keyed on the FE being opened, deliberately NOT on the tombstone or the embed marker: it must be
 * equally correct for the menu tombstone, the host hotkey, the launcher's "Open RPG UI", or a plain
 * browser visit.
 *
 * The write is best-effort: a failure is retried on the next load and never blocks the FE.
 */
export type FirstOpenDto = {
  playerId: number;
  opened: boolean;
  openedUtc?: string | null;
  revision: number;
  /** True when an injector is connected, i.e. the capture trigger can fire. */
  actionable: boolean;
};

export function getFirstOpen(playerId: number): Promise<FirstOpenDto> {
  return getJson<FirstOpenDto>(`/api/onboarding/${playerId}/first-open`);
}

/** Records the first open. Idempotent server-side — a second call is a no-op, not a conflict. */
export function recordFirstOpen(playerId: number): Promise<FirstOpenDto> {
  return sendJson<FirstOpenDto>(`/api/onboarding/${playerId}/first-open`, "POST");
}
