import { APTITUDE_IDS } from "./autoAssign";
import type { AptitudePresetRow } from "@/lib/bus/aptitudePresets";

/** Even target ‰ summing to exactly 1000 (mirrors BE EvenRows / Core auto-assign). */
export function evenPermilleRows(): AptitudePresetRow[] {
  return APTITUDE_IDS.map((aptitudeId, i) => ({
    aptitudeId,
    targetPermille: 83 + (i < 4 ? 1 : 0)
  }));
}

/** Favour / arbitrary permille map → full 12-row editor seed (missing ids → 0). */
export function permilleMapToRows(sharesPermille: Record<string, number>): AptitudePresetRow[] {
  return APTITUDE_IDS.map((aptitudeId) => ({
    aptitudeId,
    targetPermille: Math.trunc(Number(sharesPermille[aptitudeId]) || 0)
  }));
}

export function sumTargetPermille(rows: AptitudePresetRow[]): number {
  return rows.reduce((acc, r) => acc + (Math.trunc(Number(r.targetPermille) || 0)), 0);
}
