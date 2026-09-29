import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForUnvettedDialogBandOwners } from "@/shell/bandGuard";

const srcDir = join(__dirname, "..", "..");

/** `stages/delve/`'s own real subset of the whole-tree scan `shell/bandGuard.test.ts` already runs
 * (`scanForUnvettedDialogBandOwners`) — not a second, hand-rolled scanner: the same real, already-unit-
 * tested mechanism (fixture-proven both directions in `bandGuard.test.ts`), just narrowed to the two
 * directories spec §7's own lint names, over the real working tree, not a hardcoded file list — the
 * "scan the real tree" methodology `ui/volumeMatrix.test.ts`'s own `Map_FE_files_are_untouched` (D5.12)
 * already established as this program's precedent for a permanent, tree-scanning regression guard. */
function delveDialogViolations(root: string) {
  return scanForUnvettedDialogBandOwners(root).filter(
    (v) => v.file.startsWith("stages/delve/") || v.file.startsWith("layers/delve/")
  );
}

describe('delve band-3 discipline (spec-delve-stage.md §7: "nothing but the extraction summary and the three confirms may push a dialog entry from stages/delve/")', () => {
  it("Only_the_summary_and_three_confirms_open_band_3", () => {
    // `ExtractionSummary.tsx` is the one file this task adds to `bandGuard.ts`'s own
    // `DIALOG_BAND_ALLOWED_PATHS` (D5.9). D5.8's three confirms (Descend/Extract/Retreat,
    // `stages/delve/confirms/`) are a sibling task's own scope and had not landed as of this session
    // (`git status` showed no `confirms/` directory) — this assertion holds today because nothing else
    // under either directory opens a band-3 dialog yet, and it will keep holding once D5.8 lands only
    // if that task adds its own three paths to the same allow-list, exactly as this task added its own
    // one. A drop, join or level-up (or anything else) opening a `dialog` band from either directory
    // without being allow-listed is caught here, real-tree, every run — the failure the review found
    // (`audit-2026-09-05.md:224`).
    expect(delveDialogViolations(srcDir)).toEqual([]);
  });

  describe("fixture proof — the filter above actually catches a rogue opener, and actually stays scoped", () => {
    let fixtureDir: string;

    afterEach(() => {
      if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
    });

    it("a rogue dialog opener under stages/delve/ is caught", () => {
      fixtureDir = mkdtempSync(join(tmpdir(), "delve-band-discipline-"));
      mkdirSync(join(fixtureDir, "stages", "delve", "layers"), { recursive: true });
      writeFileSync(
        join(fixtureDir, "stages", "delve", "layers", "RogueDropPanel.tsx"),
        'export const RogueDropPanel = () => <DialogShell open onOpenChange={() => {}} title="A drop!" />;\n'
      );
      expect(delveDialogViolations(fixtureDir)).toHaveLength(1);
      expect(delveDialogViolations(fixtureDir)[0]).toMatchObject({ file: "stages/delve/layers/RogueDropPanel.tsx" });
    });

    it("a rogue dialog opener under layers/delve/ is caught too", () => {
      fixtureDir = mkdtempSync(join(tmpdir(), "delve-band-discipline-"));
      mkdirSync(join(fixtureDir, "layers", "delve"), { recursive: true });
      writeFileSync(
        join(fixtureDir, "layers", "delve", "RogueLayer.tsx"),
        'export const x = <div className="band-dialog" />;\n'
      );
      expect(delveDialogViolations(fixtureDir)).toHaveLength(1);
    });

    it("a rogue dialog opener OUTSIDE both directories is correctly excluded by this filter (it stays the whole-tree guard's own concern, not this one's)", () => {
      fixtureDir = mkdtempSync(join(tmpdir(), "delve-band-discipline-"));
      mkdirSync(join(fixtureDir, "stages", "world"), { recursive: true });
      writeFileSync(
        join(fixtureDir, "stages", "world", "RogueWorldDialog.tsx"),
        'export const x = <div className="band-dialog" />;\n'
      );
      // The underlying whole-tree scanner still flags it...
      expect(scanForUnvettedDialogBandOwners(fixtureDir)).toHaveLength(1);
      // ...but this task's own delve-scoped filter correctly excludes it — proving the filter is
      // actually narrowing, not accidentally passing the whole-tree result through unfiltered.
      expect(delveDialogViolations(fixtureDir)).toEqual([]);
    });

    it("does not flag ExtractionSummary.tsx itself once allow-listed the same way ConfirmDialog.tsx already is", () => {
      fixtureDir = mkdtempSync(join(tmpdir(), "delve-band-discipline-"));
      mkdirSync(join(fixtureDir, "stages", "delve", "summary"), { recursive: true });
      writeFileSync(
        join(fixtureDir, "stages", "delve", "summary", "ExtractionSummary.tsx"),
        'export const x = <div className="band-dialog" />;\n'
      );
      expect(delveDialogViolations(fixtureDir)).toEqual([]);
    });
  });
});
