/** Projector layout: Split (inspector beside), Large (canvas-first), Stack (large + cell stacks). */

export type LawnViewMode = "split" | "large" | "stack";

const KEY = "fusionrpg.lawn.viewMode";

export function parseLawnViewMode(raw: string | null | undefined): LawnViewMode {
  if (raw === "large" || raw === "stack" || raw === "split") return raw;
  return "split";
}

export function loadLawnViewMode(): LawnViewMode {
  try {
    return parseLawnViewMode(localStorage.getItem(KEY));
  } catch {
    return "split";
  }
}

export function saveLawnViewMode(mode: LawnViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* */
  }
}

export function isLargeCanvas(mode: LawnViewMode): boolean {
  return mode === "large" || mode === "stack";
}
