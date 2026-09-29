import { describe, expect, it } from "vitest";
import {
  MAX_LAWN_COLS,
  fitLawnExtent,
  floorLawnGrid,
  lawnGridFromPayload,
  readLawnCol
} from "./lawnGridExtent";
import { DEFAULT_COLS, DEFAULT_ROWS } from "./lawnViewModel";

describe("readLawnCol", () => {
  it("plants use col, not column", () => {
    expect(readLawnCol("plant", { col: 9, column: 11 })).toBe(9);
  });

  it("zombies prefer unclamped Column over saturated GetColumnFromX", () => {
    expect(readLawnCol("zombie", { col: 9, column: 11 })).toBe(11);
    expect(readLawnCol("zombie", { col: 9, column: 12 })).toBe(12);
    expect(readLawnCol("zombie", { col: 7, column: 7 })).toBe(7);
  });

  it("zombies fall back to col when column missing", () => {
    expect(readLawnCol("zombie", { col: 6 })).toBe(6);
  });
});

describe("fitLawnExtent", () => {
  it("keeps 12×5 when occupants are on the plantable lawn or spawn lane 11", () => {
    expect(fitLawnExtent(DEFAULT_ROWS, DEFAULT_COLS, 4, 9)).toEqual({
      rows: 5,
      cols: 12
    });
    expect(fitLawnExtent(5, 12, 2, 11)).toEqual({ rows: 5, cols: 12 });
  });

  it("grows past 12 for column 12 and does not shrink", () => {
    expect(fitLawnExtent(5, 12, 2, 12)).toEqual({ rows: 5, cols: 13 });
    expect(fitLawnExtent(5, 13, 2, 7)).toEqual({ rows: 5, cols: 13 });
  });

  it("caps bogus Column", () => {
    expect(fitLawnExtent(5, 12, 0, 99).cols).toBe(MAX_LAWN_COLS);
  });
});

describe("lawnGridFromPayload", () => {
  it("reads columnNum / rowNum from board.start", () => {
    expect(lawnGridFromPayload({ columnNum: 10, rowNum: 5 })).toEqual({
      rows: 5,
      cols: 10
    });
  });
});

describe("floorLawnGrid", () => {
  it("never shrinks below 12×5", () => {
    expect(floorLawnGrid(5, 10)).toEqual({ rows: 5, cols: 12 });
    expect(floorLawnGrid(undefined, undefined)).toEqual({ rows: 5, cols: 12 });
  });
});
