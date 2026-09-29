import { describe, expect, it } from "vitest";
import { makeGridSpec } from "./GridSpec";
import { pickCell, type CellGeometry } from "./pickCell";

const LAWN_GEOMETRY: CellGeometry = { cellWidth: 64, cellHeight: 72, originX: 48, originY: 56 };

describe("pickCell — generic over geometry and board shape (no lawn constant lives here)", () => {
  it("finds the cell whose pixel rect contains a world point, using caller-supplied geometry", () => {
    const spec = makeGridSpec(5, 9);
    const x = LAWN_GEOMETRY.originX + 4 * LAWN_GEOMETRY.cellWidth + LAWN_GEOMETRY.cellWidth / 2;
    const y = LAWN_GEOMETRY.originY + 2 * LAWN_GEOMETRY.cellHeight + LAWN_GEOMETRY.cellHeight / 2;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toEqual({ row: 2, col: 4 });
  });

  it("negative-side out of bounds (before the origin) is null", () => {
    const spec = makeGridSpec(5, 9);
    expect(pickCell(spec, LAWN_GEOMETRY, 0, 0)).toBeNull();
  });

  it("far-side out of bounds (past rows/cols) is null", () => {
    const spec = makeGridSpec(5, 9);
    const x = LAWN_GEOMETRY.originX + 20 * LAWN_GEOMETRY.cellWidth;
    const y = LAWN_GEOMETRY.originY + LAWN_GEOMETRY.cellHeight;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toBeNull();
  });

  it("the exact top-left pixel of a cell picks that cell (inclusive lower bound)", () => {
    const spec = makeGridSpec(5, 9);
    const x = LAWN_GEOMETRY.originX + 3 * LAWN_GEOMETRY.cellWidth;
    const y = LAWN_GEOMETRY.originY + 1 * LAWN_GEOMETRY.cellHeight;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toEqual({ row: 1, col: 3 });
  });

  it("one pixel before a cell's top-left falls back into the previous cell, not the same one", () => {
    const spec = makeGridSpec(5, 9);
    const x = LAWN_GEOMETRY.originX + 3 * LAWN_GEOMETRY.cellWidth - 1;
    const y = LAWN_GEOMETRY.originY + 1 * LAWN_GEOMETRY.cellHeight;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toEqual({ row: 1, col: 2 });
  });

  it("the last valid cell (rows-1, cols-1) still resolves at its own boundary", () => {
    const spec = makeGridSpec(5, 9);
    const x = LAWN_GEOMETRY.originX + 8 * LAWN_GEOMETRY.cellWidth;
    const y = LAWN_GEOMETRY.originY + 4 * LAWN_GEOMETRY.cellHeight;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toEqual({ row: 4, col: 8 });
  });

  it("a non-square board keeps row and col distinct — no accidental transpose", () => {
    const spec = makeGridSpec(3, 12);
    const x = LAWN_GEOMETRY.originX + 10 * LAWN_GEOMETRY.cellWidth;
    const y = LAWN_GEOMETRY.originY + 2 * LAWN_GEOMETRY.cellHeight;
    expect(pickCell(spec, LAWN_GEOMETRY, x, y)).toEqual({ row: 2, col: 10 });

    // column 10 is in-bounds for a 12-wide board but would be out of bounds for a 9-wide one —
    // proves the bound check reads `spec.cols`, not a hardcoded lawn width.
    expect(pickCell(makeGridSpec(3, 9), LAWN_GEOMETRY, x, y)).toBeNull();
  });

  it("a wholly different geometry (not the lawn's constants) still picks correctly", () => {
    const siegeGeometry: CellGeometry = { cellWidth: 40, cellHeight: 40, originX: 0, originY: 0 };
    const spec = makeGridSpec(6, 6);
    expect(pickCell(spec, siegeGeometry, 5, 5)).toEqual({ row: 0, col: 0 });
    expect(pickCell(spec, siegeGeometry, 239, 239)).toEqual({ row: 5, col: 5 });
    expect(pickCell(spec, siegeGeometry, 240, 240)).toBeNull();
  });
});
