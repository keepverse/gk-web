import type { Occupant } from "./lawnViewModel";
import { normalizePtr } from "./lawnViewModel";

/** Soft Phaser living-sprite budget (plants + zombies). Mowers/tiles/pets always draw. */
export const PHASER_OCCUPANT_BUDGET = 96;

function flagScore(o: Occupant): number {
  let n = 0;
  if (o.flags.unique) n += 40;
  if (o.flags.mixed) n += 30;
  if (o.flags.crashed) n += 30;
  if (o.flags.hypnotized) n += 25;
  if (o.statusChips.includes("hypno")) n += 10;
  return n;
}

function occupantScore(o: Occupant, selectedPtr?: string): number {
  const sel = selectedPtr ? normalizePtr(selectedPtr) : "";
  if (sel && normalizePtr(o.ptr) === sel) return 10_000;
  let n = flagScore(o);
  if (o.side === "plant" && o.row != null && o.col != null && o.col >= 0) n += 50;
  if (o.side === "zombie") {
    const col = o.col ?? 99;
    if (col <= 2) n += 80;
    n += Math.max(0, 20 - col);
  }
  return n;
}

/**
 * Pick which living occupants Phaser may draw. Overflow stays on the VM for the Vite list.
 * Lowest-col zombie per row is always kept (eating / near house).
 */
export function pickPhaserOccupants(
  living: readonly Occupant[],
  budget = PHASER_OCCUPANT_BUDGET,
  selectedPtr?: string
): { onCanvas: Occupant[]; overflow: Occupant[] } {
  const cap = Math.max(1, budget);
  if (living.length <= cap) return { onCanvas: [...living], overflow: [] };

  const must = new Set<string>();
  if (selectedPtr) must.add(normalizePtr(selectedPtr));

  for (const o of living) {
    if (
      o.flags.unique ||
      o.flags.mixed ||
      o.flags.crashed ||
      o.flags.hypnotized
    ) {
      must.add(normalizePtr(o.ptr));
    }
  }

  const lowestByRow = new Map<number, Occupant>();
  for (const o of living) {
    if (o.side !== "zombie" || o.row == null) continue;
    const prev = lowestByRow.get(o.row);
    const col = o.col ?? 99;
    if (!prev || (prev.col ?? 99) > col) lowestByRow.set(o.row, o);
  }
  for (const o of lowestByRow.values()) must.add(normalizePtr(o.ptr));

  const ranked = [...living].sort(
    (a, b) => occupantScore(b, selectedPtr) - occupantScore(a, selectedPtr)
  );
  const on: Occupant[] = [];
  const seen = new Set<string>();
  for (const o of ranked) {
    if (on.length >= cap) break;
    const k = normalizePtr(o.ptr);
    if (must.has(k) && !seen.has(k)) {
      on.push(o);
      seen.add(k);
    }
  }
  for (const o of ranked) {
    if (on.length >= cap) break;
    const k = normalizePtr(o.ptr);
    if (seen.has(k)) continue;
    on.push(o);
    seen.add(k);
  }
  const overflow = living.filter((o) => !seen.has(normalizePtr(o.ptr)));
  return { onCanvas: on, overflow };
}
