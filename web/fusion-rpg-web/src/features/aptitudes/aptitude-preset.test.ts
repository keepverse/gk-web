import { describe, expect, it } from "vitest";
import { evenPermilleRows, permilleMapToRows, sumTargetPermille } from "./evenPermille";
import { APTITUDE_IDS } from "./autoAssign";
import { foldPresetConsoleVm } from "@/features/gui-lego/foldPresetConsoleVm";

describe("evenPermille", () => {
  it("sums to exactly 1000 across twelve primaries", () => {
    const rows = evenPermilleRows();
    expect(rows).toHaveLength(12);
    expect(sumTargetPermille(rows)).toBe(1000);
    expect(rows.map((r) => r.aptitudeId)).toEqual(APTITUDE_IDS);
  });

  it("maps favour permille into full row list", () => {
    const rows = permilleMapToRows({ Might: 500, Vigor: 300, Fortitude: 200 });
    expect(sumTargetPermille(rows)).toBe(1000);
    expect(rows.find((r) => r.aptitudeId === "Might")?.targetPermille).toBe(500);
  });
});

describe("foldPresetConsoleVm", () => {
  it("disables Save when permille sum is not 1000 (E5)", () => {
    const rows = evenPermilleRows();
    rows[0]!.targetPermille = 1;
    const vm = foldPresetConsoleVm({
      presets: [],
      selectedPresetId: null,
      activePresetId: null,
      editorName: "Bad",
      editorRows: rows,
      displayNames: {},
      budget: 100,
      previewShares: {},
      previewLeftover: 100,
      revision: 1,
      mode: "commander",
      saving: false,
      activating: false
    });
    expect(vm.editor.sumOk).toBe(false);
    expect(vm.actions.saveEnabled).toBe(false);
  });

  it("enables Save when sum is 1000 and name present", () => {
    const vm = foldPresetConsoleVm({
      presets: [
        {
          presetId: "p1",
          playerId: 1,
          name: "Even",
          kind: "player",
          rows: evenPermilleRows()
        }
      ],
      selectedPresetId: "p1",
      activePresetId: "p1",
      editorName: "Even",
      editorRows: evenPermilleRows(),
      displayNames: { Might: "Might" },
      budget: 200,
      previewShares: {},
      previewLeftover: 8,
      revision: 2,
      mode: "unique",
      saving: false,
      activating: false
    });
    expect(vm.editor.sumOk).toBe(true);
    expect(vm.actions.saveEnabled).toBe(true);
    expect(vm.actions.applyEnabled).toBe(true);
    expect(vm.actions.activateEnabled).toBe(true);
    expect(vm.chart.segments.length).toBe(12);
  });
});
