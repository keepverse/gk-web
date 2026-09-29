import { describe, expect, it } from "vitest";
import { sectorCenter } from "@/game/world/layout";
import { centreTargetForOutlinerRow } from "./outlinerCentre";
import type { OutlinerRow } from "./outlinerModel";
import { EMPIRE_28_LEGIONS, EMPIRE_28_SECTORS } from "./fixtures/empire28";

describe("centreTargetForOutlinerRow — sectorCenter, not pin-hop (gaps D25)", () => {
  it("centres a sector row on that sector's layout cell centre", () => {
    const sector = EMPIRE_28_SECTORS[0]!;
    const row: OutlinerRow = {
      kind: "sector",
      id: sector.sectorId,
      flagged: false,
      sector
    };

    expect(centreTargetForOutlinerRow(row, EMPIRE_28_SECTORS)).toEqual(
      sectorCenter(sector.layoutX, sector.layoutY)
    );
  });

  it("centres a legion-at-sector row via the legion's sector, not arrow hop", () => {
    const sector = EMPIRE_28_SECTORS[2]!;
    const base = EMPIRE_28_LEGIONS[0]!;
    const legion = {
      ...base,
      position: { kind: "sector" as const, sectorId: sector.sectorId }
    };
    const row: OutlinerRow = {
      kind: "legion",
      id: legion.entityId,
      flagged: false,
      legion
    };

    expect(centreTargetForOutlinerRow(row, EMPIRE_28_SECTORS)).toEqual(
      sectorCenter(sector.layoutX, sector.layoutY)
    );
  });

  it("returns null when the subject sector is missing", () => {
    const row: OutlinerRow = {
      kind: "sector",
      id: "missing",
      flagged: false
    };
    expect(centreTargetForOutlinerRow(row, EMPIRE_28_SECTORS)).toBeNull();
  });
});
