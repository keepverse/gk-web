import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForDevCopyInPlayerStrings } from "./pendingCopyGuard";

const srcDir = join(__dirname, "..");

describe("pendingCopyGuard — real tree", () => {
  it("no player surface ships dev jargon in pending reasons or UI copy (R1b)", () => {
    expect(scanForDevCopyInPlayerStrings(srcDir)).toEqual([]);
  });
});

describe("pendingCopyGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags AGENTS.md in a pendingWithReason string", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "pending-copy-guard-"));
    mkdirSync(join(fixtureDir, "stages"));
    writeFileSync(
      join(fixtureDir, "stages", "Bad.tsx"),
      'import { pendingWithReason } from "@/contract/pending";\nexport const x = pendingWithReason("product direction (AGENTS.md)");\n'
    );
    expect(scanForDevCopyInPlayerStrings(fixtureDir).length).toBeGreaterThanOrEqual(1);
  });

  it("flags spec filenames in player-surface JSX", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "pending-copy-guard-"));
    mkdirSync(join(fixtureDir, "ui"));
    writeFileSync(
      join(fixtureDir, "ui", "Bad.tsx"),
      'export const Bad = () => <p>See spec-equip-and-paperdoll.md for details</p>;\n'
    );
    expect(scanForDevCopyInPlayerStrings(fixtureDir)).toHaveLength(1);
  });

  it("flags task ids in player-surface title attributes", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "pending-copy-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Bad.tsx"),
      'export const Bad = () => <button title="Not built yet (T21)">Go</button>;\n'
    );
    expect(scanForDevCopyInPlayerStrings(fixtureDir)).toHaveLength(1);
  });

  it("does not flag developer surfaces (GG-41 allow-list)", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "pending-copy-guard-"));
    mkdirSync(join(fixtureDir, "dev"));
    writeFileSync(
      join(fixtureDir, "dev", "Fine.tsx"),
      'export const x = pendingWithReason("UniqueActor endpoint on T12");\n'
    );
    expect(scanForDevCopyInPlayerStrings(fixtureDir)).toEqual([]);
  });

  it("does not flag contract/adapt.ts player copy constants", () => {
    expect(scanForDevCopyInPlayerStrings(srcDir).filter((v) => v.file === "contract/adapt.ts")).toEqual([]);
  });
});
