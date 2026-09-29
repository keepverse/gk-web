/** Pure Phaser sync gates — no scene (RT-08). */

export function shouldSyncLawnSprites(opts: {
  revision: number;
  lastApplied: number;
  canvasKey: string;
  lastCanvasKey: string;
}): boolean {
  if (opts.revision > opts.lastApplied) return true;
  if (opts.canvasKey !== opts.lastCanvasKey) return true;
  return false;
}

/** When canvas set changes at the same revision, pass revision-1 so syncFromModel still runs (incl. rev 0). */
export function forceSyncLastApplied(
  revision: number,
  lastApplied: number,
  canvasChanged: boolean
): number {
  if (canvasChanged && revision <= lastApplied) return revision - 1;
  return lastApplied;
}

export function noteIconLoadFailure(
  loads: Set<string>,
  fails: Set<string>,
  fileKey: string | undefined
): boolean {
  if (!fileKey) return false;
  loads.delete(fileKey);
  fails.add(fileKey);
  return true;
}
