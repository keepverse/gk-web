import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForLayerStackImports, scanForStrayZIndex, scanForUnvettedDialogBandOwners } from "./bandGuard";

const srcDir = join(__dirname, "..");

describe("bandGuard — real tree", () => {
  it("the shipped src/ tree has no stray z-index outside the six band tokens", () => {
    expect(scanForStrayZIndex(srcDir)).toEqual([]);
  });

  it("nothing outside the shells imports layerStack directly", () => {
    expect(scanForLayerStackImports(srcDir)).toEqual([]);
  });

  it("nothing outside ConfirmDialog/dev surfaces opens a band-3 dialog unprompted (GG-53)", () => {
    expect(scanForUnvettedDialogBandOwners(srcDir)).toEqual([]);
  });
});

describe("bandGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a raw CSS z-index outside theme/tokens.css", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "features"));
    writeFileSync(
      join(fixtureDir, "features", "rogue.css"),
      ".toast-clone { z-index: 5; }\n"
    );
    const violations = scanForStrayZIndex(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "features/rogue.css", line: 1 });
  });

  it("flags a Tailwind z-* class outside theme/tokens.css", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "features"));
    writeFileSync(
      join(fixtureDir, "features", "Rogue.tsx"),
      'export const Rogue = () => <div className="fixed z-50 inset-0" />;\n'
    );
    expect(scanForStrayZIndex(fixtureDir)).toHaveLength(1);
  });

  it("does not flag the band token definitions in theme/tokens.css", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "theme"));
    writeFileSync(
      join(fixtureDir, "theme", "tokens.css"),
      ".band-panel { z-index: var(--band-panel); }\n"
    );
    expect(scanForStrayZIndex(fixtureDir)).toEqual([]);
  });

  it("flags a component importing layerStack outside src/shell/", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "features"));
    writeFileSync(
      join(fixtureDir, "features", "Rogue.tsx"),
      'import { useLayerStack } from "@/shell/layerStack";\nexport const x = useLayerStack;\n'
    );
    expect(scanForLayerStackImports(fixtureDir)).toHaveLength(1);
  });

  it("does not flag imports from inside src/shell/", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "shell"));
    writeFileSync(
      join(fixtureDir, "shell", "PanelShell.tsx"),
      'import { useLayerStack } from "./layerStack";\n'
    );
    expect(scanForLayerStackImports(fixtureDir)).toEqual([]);
  });

  it("flags a new component rendering DialogShell directly (GG-53 unvetted)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      "export const Rogue = () => <DialogShell open onOpenChange={() => {}} title=\"Surprise\" />;\n"
    );
    expect(scanForUnvettedDialogBandOwners(fixtureDir)).toHaveLength(1);
  });

  it("does not flag ConfirmDialog itself", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "ui"));
    writeFileSync(
      join(fixtureDir, "ui", "ConfirmDialog.tsx"),
      'export const x = <div className="band-dialog" />;\n'
    );
    expect(scanForUnvettedDialogBandOwners(fixtureDir)).toEqual([]);
  });

  it("does not flag a dev surface (GG-41 exempts GG-53 there)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "band-guard-"));
    mkdirSync(join(fixtureDir, "features", "cheats"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "features", "cheats", "CheatsPage.tsx"),
      'export const x = <div className="band-dialog" />;\n'
    );
    expect(scanForUnvettedDialogBandOwners(fixtureDir)).toEqual([]);
  });
});
