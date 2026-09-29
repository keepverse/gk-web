/**
 * Structured observability for ActorSheet open / tab changes.
 * E2E and debug tools read window.__fusionRpgActorSheetObs.
 */
export type ActorSheetObsEvent = {
  channel: string;
  payload: Record<string, unknown>;
  t: number;
};

const ring: ActorSheetObsEvent[] = [];
// Structural: ring buffer length — not a progression ceiling.
const ACTOR_SHEET_OBS_RING_MAX = 64;

declare global {
  interface Window {
    __fusionRpgActorSheetObs?: ActorSheetObsEvent[];
  }
}

export function emitActorSheetObs(channel: string, payload: Record<string, unknown>): void {
  const row: ActorSheetObsEvent = { channel, payload, t: Date.now() };
  ring.push(row);
  while (ring.length > ACTOR_SHEET_OBS_RING_MAX) ring.shift();
  if (typeof window !== "undefined") {
    window.__fusionRpgActorSheetObs = ring.slice();
  }
  console.info(`[${channel}]`, payload);
}

export function resetActorSheetObsForTests(): void {
  ring.length = 0;
  if (typeof window !== "undefined") delete window.__fusionRpgActorSheetObs;
}
