import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForHexLiterals } from "./hexGuard";

const srcDir = join(__dirname, "..");

describe("hexGuard — real tree", () => {
  it("no hex colour literal exists outside src/theme/", () => {
    expect(scanForHexLiterals(srcDir)).toEqual([]);
  });
});

describe("hexGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a 6-digit hex literal", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "ui"));
    writeFileSync(join(fixtureDir, "ui", "Rogue.tsx"), 'const c = "#ff00aa";\n');
    expect(scanForHexLiterals(fixtureDir)).toHaveLength(1);
  });

  it("flags a 3-digit hex literal in CSS", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "ui"));
    writeFileSync(join(fixtureDir, "ui", "rogue.css"), ".x { color: #f0a; }\n");
    expect(scanForHexLiterals(fixtureDir)).toHaveLength(1);
  });

  it("does not flag a router hash path", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "app"));
    writeFileSync(join(fixtureDir, "app", "Fine.tsx"), 'const href = "#/lawn";\n');
    expect(scanForHexLiterals(fixtureDir)).toEqual([]);
  });

  it("does not flag an id selector", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "app"));
    writeFileSync(join(fixtureDir, "app", "Fine2.tsx"), 'document.getElementById("root");\n');
    expect(scanForHexLiterals(fixtureDir)).toEqual([]);
  });

  it("does not scan files inside src/theme/", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "theme"));
    writeFileSync(join(fixtureDir, "theme", "tokens.css"), "--x: #16120e;\n");
    expect(scanForHexLiterals(fixtureDir)).toEqual([]);
  });

  it("does not scan src/game/ — Phaser's canvas rendering can't consume a CSS var()", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "game"), { recursive: true });
    writeFileSync(join(fixtureDir, "game", "createLawnGame.ts"), 'backgroundColor: "#16120e"\n');
    expect(scanForHexLiterals(fixtureDir)).toEqual([]);
  });

  it("scans src/features/world/ — the T16 exemption was retired by world-stage W49", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "features", "world"), { recursive: true });
    writeFileSync(join(fixtureDir, "features", "world", "LaneEdge.tsx"), 'const c = "#34d399";\n');
    expect(scanForHexLiterals(fixtureDir)).toHaveLength(1);
  });

  it("still scans other files under features/", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "hex-guard-"));
    mkdirSync(join(fixtureDir, "features", "roster"), { recursive: true });
    writeFileSync(join(fixtureDir, "features", "roster", "Rogue.tsx"), 'const c = "#34d399";\n');
    expect(scanForHexLiterals(fixtureDir)).toHaveLength(1);
  });
});
