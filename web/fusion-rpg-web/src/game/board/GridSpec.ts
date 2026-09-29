/**
 * base-defense `board-render` (module 16): a plain TS mirror of the C# board shape
 * (`FusionRpg.Core/Battle/Board/GridSpec.cs`) — a board's dimensions and per-cell terrain, passed
 * INTO the generic board layer as data rather than the layer importing a lawn-specific grid module.
 * Deliberately free functions over a plain object, matching this codebase's own existing
 * `gridMath.ts` style, not a ported C# class.
 *
 * This file imports nothing from `../gridMath`, `../createLawnGame`, or any other lawn-specific
 * module — the generic board layer must never depend on the lawn (verified by
 * `GridSpec.test.ts`'s own import-scan test).
 */

/** Matches the C# `CellTerrain` enum exactly — `"open"` is the default, index 0 there too. */
export type CellTerrain = "open" | "rough" | "blocking" | "gap";

export type GridPos = { readonly row: number; readonly col: number };

export type GridSpec = {
  readonly rows: number;
  readonly cols: number;
  /** Row-major, length `rows * cols`. */
  readonly cells: readonly CellTerrain[];
};

export class GridSpecError extends Error {}

/**
 * Builds and validates a `GridSpec` — the only way to make one, matching the C# `GridSpec`
 * constructor's own "validated at construction, not at use" discipline. `cells` defaults to an
 * all-`"open"` board when omitted, matching the C# constructor's own default.
 */
export function makeGridSpec(rows: number, cols: number, cells?: readonly CellTerrain[]): GridSpec {
  if (!Number.isInteger(rows) || rows <= 0) {
    throw new GridSpecError(`GridSpec: rows must be a positive integer; got ${rows}`);
  }
  if (!Number.isInteger(cols) || cols <= 0) {
    throw new GridSpecError(`GridSpec: cols must be a positive integer; got ${cols}`);
  }
  const cellCount = rows * cols;
  if (cells !== undefined && cells.length !== cellCount) {
    throw new GridSpecError(`GridSpec: ${rows}x${cols} needs ${cellCount} cells; got ${cells.length}.`);
  }
  return { rows, cols, cells: cells ?? new Array<CellTerrain>(cellCount).fill("open") };
}

export function contains(spec: GridSpec, pos: GridPos): boolean {
  return (
    Number.isInteger(pos.row) &&
    Number.isInteger(pos.col) &&
    pos.row >= 0 &&
    pos.row < spec.rows &&
    pos.col >= 0 &&
    pos.col < spec.cols
  );
}

export function indexOf(spec: GridSpec, pos: GridPos): number {
  if (!contains(spec, pos)) {
    throw new GridSpecError(`GridSpec.indexOf: (${pos.row}, ${pos.col}) is outside ${spec.rows}x${spec.cols}.`);
  }
  return pos.row * spec.cols + pos.col;
}

export function terrainAt(spec: GridSpec, pos: GridPos): CellTerrain {
  return spec.cells[indexOf(spec, pos)];
}
