import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForUnexplainedDisabledControls } from "./disabledReasonGuard";

const srcDir = join(__dirname, "..");

describe("disabledReasonGuard — real tree", () => {
  it("every disabled control carries an accessible reason (GG-55)", () => {
    expect(scanForUnexplainedDisabledControls(srcDir)).toEqual([]);
  });
});

describe("disabledReasonGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a disabled control with no reason", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "disabled-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      "export const Rogue = () => <button disabled onClick={f}>Go</button>;\n"
    );
    const violations = scanForUnexplainedDisabledControls(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "layers/Rogue.tsx", line: 1 });
  });

  it("does not flag a disabled control with a title", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "disabled-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      'export const Clean = () => <button disabled title="Not ready yet" onClick={f}>Go</button>;\n'
    );
    expect(scanForUnexplainedDisabledControls(fixtureDir)).toEqual([]);
  });

  it("does not flag a disabled control with an aria-label", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "disabled-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      'export const Clean = () => <button disabled aria-label="Locked" onClick={f}>Go</button>;\n'
    );
    expect(scanForUnexplainedDisabledControls(fixtureDir)).toEqual([]);
  });

  it("handles a `disabled={...}` expression spread across multiple lines", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "disabled-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Rogue.tsx"),
      [
        "export const Rogue = () => (",
        "  <button",
        "    disabled={busy || locked}",
        "    onClick={f}",
        "  >",
        "    Go",
        "  </button>",
        ");"
      ].join("\n")
    );
    const violations = scanForUnexplainedDisabledControls(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.line).toBe(2);
  });

  it("does not false-positive on the plain English word in prose", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "disabled-guard-"));
    mkdirSync(join(fixtureDir, "layers"));
    writeFileSync(
      join(fixtureDir, "layers", "Clean.tsx"),
      "// This button used to be disabled forever, now it is not.\nexport const Clean = () => <button onClick={f}>Go</button>;\n"
    );
    expect(scanForUnexplainedDisabledControls(fixtureDir)).toEqual([]);
  });
});
