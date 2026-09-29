import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForBareTMacroInComponents } from "./reactivityGuard";

const srcDir = join(__dirname, "..");

describe("reactivityGuard — real tree", () => {
  it("no .tsx component imports the bare t macro (use useLingui()'s _ with msg instead)", () => {
    expect(scanForBareTMacroInComponents(srcDir)).toEqual([]);
  });
});

describe("reactivityGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a component importing the bare t macro", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "reactivity-guard-"));
    mkdirSync(join(fixtureDir, "stages"));
    writeFileSync(
      join(fixtureDir, "stages", "Rogue.tsx"),
      'import { t } from "@lingui/macro";\nexport const x = t`hi`;\n'
    );
    expect(scanForBareTMacroInComponents(fixtureDir)).toHaveLength(1);
  });

  it("does not flag a component importing msg instead", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "reactivity-guard-"));
    mkdirSync(join(fixtureDir, "stages"));
    writeFileSync(
      join(fixtureDir, "stages", "Fine.tsx"),
      'import { msg } from "@lingui/macro";\nimport { useLingui } from "@lingui/react";\n'
    );
    expect(scanForBareTMacroInComponents(fixtureDir)).toEqual([]);
  });

  it("does not flag a msg-only import that happens to contain the letter t elsewhere", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "reactivity-guard-"));
    mkdirSync(join(fixtureDir, "stages"));
    writeFileSync(join(fixtureDir, "stages", "Fine2.tsx"), 'import { msg, Trans } from "@lingui/macro";\n');
    expect(scanForBareTMacroInComponents(fixtureDir)).toEqual([]);
  });
});
