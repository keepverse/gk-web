/**
 * Structured observability for phaser-kernel island lifecycle.
 * Survives preview builds that may filter console; e2e reads window.__fusionRpgKernelObs.
 */
export type KernelObsEvent = {
  channel: string;
  payload: Record<string, unknown>;
  t: number;
};

const ring: KernelObsEvent[] = [];
// Structural: ring buffer length — not a progression ceiling.
const KERNEL_OBS_RING_MAX = 64;

declare global {
  interface Window {
    __fusionRpgKernelObs?: KernelObsEvent[];
  }
}

export function emitKernelObs(
  channel: string,
  payload: Record<string, unknown>
): void {
  const row: KernelObsEvent = { channel, payload, t: Date.now() };
  ring.push(row);
  while (ring.length > KERNEL_OBS_RING_MAX) ring.shift();
  if (typeof window !== "undefined") {
    window.__fusionRpgKernelObs = ring.slice();
  }
  console.info(`[${channel}]`, payload);
}

export function resetKernelObsForTests(): void {
  ring.length = 0;
  if (typeof window !== "undefined") delete window.__fusionRpgKernelObs;
}
