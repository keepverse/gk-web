import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("cell-boot Boot({ nextScene })", () => {
  it("BootScene accepts injected nextScene (not lawn-hardcoded-only)", () => {
    const src = readFileSync(join(__dirname, "BootScene.ts"), "utf8");
    expect(src).toMatch(/nextScene/);
    expect(src).toMatch(/bootNextScene/);
    expect(src).toMatch(/this\.scene\.start\(this\.nextScene/);
  });

  it("world MapScene still has no BootScene dependency", () => {
    const src = readFileSync(
      join(__dirname, "../world/scenes/WorldMapScene.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/^\s*import\s+.*BootScene/m);
    expect(src).not.toMatch(/scene\.start\(\s*["']BootScene/);
  });
});
