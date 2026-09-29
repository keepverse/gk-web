import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForF10Bindings, scanForStrayGlobalKeydownBindings } from "./keymapGuard";

const srcDir = join(__dirname, "..");

describe("keymapGuard — real tree", () => {
  it("nothing outside keymap.ts's own rejection mentions F10", () => {
    expect(scanForF10Bindings(srcDir)).toEqual([]);
  });

  it("no global keydown listener exists outside useGlobalKeys.ts, other than the one accepted legacy exception", () => {
    expect(scanForStrayGlobalKeydownBindings(srcDir)).toEqual([]);
  });
});

describe("keymapGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a component that binds F10", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "keymap-guard-"));
    mkdirSync(join(fixtureDir, "features"));
    writeFileSync(
      join(fixtureDir, "features", "Rogue.tsx"),
      'if (e.key === "F10") resumeOverlay();\n'
    );
    expect(scanForF10Bindings(fixtureDir)).toHaveLength(1);
  });

  it("does not flag keymap.ts's own rejection of F10", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "keymap-guard-"));
    mkdirSync(join(fixtureDir, "shell"));
    writeFileSync(join(fixtureDir, "shell", "keymap.ts"), 'const FORBIDDEN = new Set(["F10"]);\n');
    expect(scanForF10Bindings(fixtureDir)).toEqual([]);
  });

  it("flags a component installing its own global keydown listener", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "keymap-guard-"));
    mkdirSync(join(fixtureDir, "features"));
    writeFileSync(
      join(fixtureDir, "features", "Rogue.tsx"),
      'window.addEventListener("keydown", onKey);\n'
    );
    expect(scanForStrayGlobalKeydownBindings(fixtureDir)).toHaveLength(1);
  });

  it("does not flag useGlobalKeys.ts itself", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "keymap-guard-"));
    mkdirSync(join(fixtureDir, "shell"));
    writeFileSync(
      join(fixtureDir, "shell", "useGlobalKeys.ts"),
      'window.addEventListener("keydown", onKeyDown);\n'
    );
    expect(scanForStrayGlobalKeydownBindings(fixtureDir)).toEqual([]);
  });

  it("does not flag the one accepted legacy exception", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "keymap-guard-"));
    mkdirSync(join(fixtureDir, "ui"));
    writeFileSync(
      join(fixtureDir, "ui", "ConfirmDialog.tsx"),
      'window.addEventListener("keydown", onKey);\n'
    );
    expect(scanForStrayGlobalKeydownBindings(fixtureDir)).toEqual([]);
  });
});
