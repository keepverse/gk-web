/**
 * Battle playback frame apply — BoardView is produced outside the kernel (stages/battle/).
 * Signature freeze for lock 5a; body stays thin until base-defense unpause.
 */
export function applyPlaybackFrame(_view: unknown, cursor: number): void {
  if (import.meta.env.DEV) {
    console.info("[applyPlaybackFrame]", { event: "apply", cursor });
  }
}
