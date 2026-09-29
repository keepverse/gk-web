/**
 * Structured observability for aptitude allocate flows (Mode A/B/C).
 * E2E and debug tools read window.__fusionRpgAptitudeObs.
 */
export type AptitudeObsEvent = {
  channel: string;
  payload: Record<string, unknown>;
  t: number;
};

const ring: AptitudeObsEvent[] = [];
// Structural: ring buffer length — not a progression ceiling.
const APTITUDE_OBS_RING_MAX = 64;

declare global {
  interface Window {
    __fusionRpgAptitudeObs?: AptitudeObsEvent[];
  }
}

export function emitAptitudeObs(channel: string, payload: Record<string, unknown>): void {
  const row: AptitudeObsEvent = { channel, payload, t: Date.now() };
  ring.push(row);
  while (ring.length > APTITUDE_OBS_RING_MAX) ring.shift();
  if (typeof window !== "undefined") {
    window.__fusionRpgAptitudeObs = ring.slice();
  }
  console.info(`[${channel}]`, payload);
}

export function resetAptitudeObsForTests(): void {
  ring.length = 0;
  if (typeof window !== "undefined") delete window.__fusionRpgAptitudeObs;
}
