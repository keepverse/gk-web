import { contains, GridSpecError, type GridPos, type GridSpec } from "./GridSpec";

/**
 * base-defense `board-render` (module 16): "keyboard cell navigation (arrows + confirm), not
 * mouse-only" (spec-board-render.md §5) — the generic, pure half of that (grid math + a duck-typed
 * wiring helper, no lawn value, no Phaser import). Mirrors `pickCell.ts`'s own split: this file is the
 * pointer system's keyboard-equivalent counterpart, generalizing the same "reach every cell" contract
 * `PickSystem.ts`'s pointer path already has to arrow-key + confirm input.
 */

export type KeyDirection = "up" | "down" | "left" | "right";

const DIRECTION_DELTA: Readonly<Record<KeyDirection, GridPos>> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 }
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** The cell keyboard focus starts at before any arrow key has been pressed. */
export function initialFocus(): GridPos {
  return { row: 0, col: 0 };
}

/**
 * Pure: the next focused cell for one arrow-key press. Clamps at the board edge rather than wrapping
 * or throwing — pressing further into an edge simply holds focus at the last valid cell, so every cell
 * is reachable by holding one direction and never overshoots off the board.
 */
export function nextFocus(spec: GridSpec, current: GridPos, direction: KeyDirection): GridPos {
  if (!contains(spec, current)) {
    throw new GridSpecError(
      `nextFocus: (${current.row}, ${current.col}) is outside ${spec.rows}x${spec.cols}.`
    );
  }
  const delta = DIRECTION_DELTA[direction];
  return {
    row: clamp(current.row + delta.row, 0, spec.rows - 1),
    col: clamp(current.col + delta.col, 0, spec.cols - 1)
  };
}

const KEY_TO_DIRECTION: Readonly<Record<string, KeyDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right"
};

/** Enter confirms; Space is pause (lawn-interactive §10.1) — never confirm. */
const CONFIRM_KEYS = new Set(["Enter"]);

export type KeyboardEventLike = { readonly key: string };

/** Matches `Phaser.Input.Keyboard.KeyboardPlugin`'s own shape for the one event this needs. */
export type KeySource = {
  on(event: "keydown", handler: (event: KeyboardEventLike) => void): void;
  off(event: "keydown", handler: (event: KeyboardEventLike) => void): void;
};

export type WireKeyboardNavOptions = {
  readonly keys: KeySource;
  readonly getSpec: () => GridSpec;
  readonly getFocus: () => GridPos;
  /** Called with the new cell whenever an arrow key moves focus. */
  readonly onFocusChange: (pos: GridPos) => void;
  /** Called with the current cell on Enter (Space does not confirm). */
  readonly onConfirm: (pos: GridPos) => void;
  /**
   * When false, arrows/confirm are ignored (GG-18 focus gate).
   * Defaults to always enabled.
   */
  readonly isEnabled?: () => boolean;
};

/** Wires arrow-key navigation and confirm to a board; returns the disposer. */
export function wireKeyboardNav(opts: WireKeyboardNavOptions): () => void {
  const onKeyDown = (event: KeyboardEventLike): void => {
    if (opts.isEnabled && !opts.isEnabled()) return;
    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) {
      opts.onFocusChange(nextFocus(opts.getSpec(), opts.getFocus(), direction));
      return;
    }
    if (CONFIRM_KEYS.has(event.key)) {
      opts.onConfirm(opts.getFocus());
    }
  };

  opts.keys.on("keydown", onKeyDown);
  return () => opts.keys.off("keydown", onKeyDown);
}
