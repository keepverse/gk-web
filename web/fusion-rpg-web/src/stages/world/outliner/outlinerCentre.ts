import { sectorCenter } from "@/game/world/layout";
import type { SectorView } from "@/contract/types";
import type { OutlinerRow } from "./outlinerModel";

/**
 * World coords for `world:camera` `{ op: "centre" }` (gaps D25).
 * Always `sectorCenter` — never arrow pin-hop / SVG `centreOn`.
 */
export function centreTargetForOutlinerRow(
  row: OutlinerRow,
  sectors: readonly SectorView[]
): { x: number; y: number } | null {
  let sector: SectorView | undefined;

  if (row.kind === "sector") {
    sector = row.sector ?? sectors.find((s) => s.sectorId === row.id);
  } else if (row.legion) {
    const pos = row.legion.position;
    const sectorId = pos.kind === "sector" ? pos.sectorId : pos.towardSectorId;
    sector = sectors.find((s) => s.sectorId === sectorId);
  }

  if (!sector) return null;
  return sectorCenter(sector.layoutX, sector.layoutY);
}
