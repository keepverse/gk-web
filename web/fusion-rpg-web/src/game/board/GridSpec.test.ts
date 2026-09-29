import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GridSpecError, contains, indexOf, makeGridSpec, terrainAt } from "./GridSpec";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("makeGridSpec", () => {
  it("defaults every cell to open when cells is omitted", () => {
    const spec = makeGridSpec(2, 3);
    expect(spec.cells).toEqual(["open", "open", "open", "open", "open", "open"]);
  });

  it("accepts a non-square board", () => {
    const spec = makeGridSpec(3, 5);
    expect(spec.rows).toBe(3);
    expect(spec.cols).toBe(5);
    expect(spec.cells).toHaveLength(15);
  });

  it("rejects a cells array of the wrong length", () => {
    expect(() => makeGridSpec(2, 2, ["open", "open"])).toThrow(GridSpecError);
  });

  it("rejects non-positive rows or cols", () => {
    expect(() => makeGridSpec(0, 5)).toThrow(GridSpecError);
    expect(() => makeGridSpec(5, -1)).toThrow(GridSpecError);
  });

  it("rejects fractional rows or cols", () => {
    expect(() => makeGridSpec(2.5, 3)).toThrow(GridSpecError);
  });
});

describe("contains / indexOf / terrainAt", () => {
  const spec = makeGridSpec(2, 3, ["open", "rough", "blocking", "gap", "open", "open"]);

  it("contains is true inside bounds, false outside, at every boundary cell", () => {
    expect(contains(spec, { row: 0, col: 0 })).toBe(true);
    expect(contains(spec, { row: 1, col: 2 })).toBe(true);
    expect(contains(spec, { row: -1, col: 0 })).toBe(false);
    expect(contains(spec, { row: 0, col: -1 })).toBe(false);
    expect(contains(spec, { row: 2, col: 0 })).toBe(false);
    expect(contains(spec, { row: 0, col: 3 })).toBe(false);
  });

  it("indexOf is row-major", () => {
    expect(indexOf(spec, { row: 0, col: 0 })).toBe(0);
    expect(indexOf(spec, { row: 0, col: 2 })).toBe(2);
    expect(indexOf(spec, { row: 1, col: 0 })).toBe(3);
    expect(indexOf(spec, { row: 1, col: 2 })).toBe(5);
  });

  it("indexOf throws for an out-of-bounds cell rather than returning garbage", () => {
    expect(() => indexOf(spec, { row: 5, col: 5 })).toThrow(GridSpecError);
  });

  it("terrainAt reads the real per-cell value", () => {
    expect(terrainAt(spec, { row: 0, col: 1 })).toBe("rough");
    expect(terrainAt(spec, { row: 0, col: 2 })).toBe("blocking");
    expect(terrainAt(spec, { row: 1, col: 0 })).toBe("gap");
  });
});

describe("the generic board layer imports no lawn module", () => {
  it("GridSpec.ts has zero import statements naming a lawn-specific path", () => {
    // Scans actual `import ... from "..."` statements only, never the whole file's prose — a doc
    // comment is free to discuss "the lawn" in English without tripping this check.
    const src = readFileSync(join(__dirname, "GridSpec.ts"), "utf8");
    const importLines = src.match(/^import .+$/gm) ?? [];
    // Today GridSpec.ts has NO imports at all (it depends on nothing) — asserted explicitly so this
    // test is a real, current fact, not just a guard against a future regression.
    expect(importLines).toEqual([]);
    for (const line of importLines) {
      expect(line).not.toMatch(/gridMath|createLawnGame|[Ll]awn/);
    }
  });
});
