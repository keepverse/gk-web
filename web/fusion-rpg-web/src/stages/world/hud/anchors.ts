/**
 * The band-1 corner-role contract (world-stage W51, spec-world-hud.md). Six anchors, each with
 * exactly one occupant, and per-corner role stability — the lesson from both directions at once:
 * Amplitude removed their "Divided UI" because players "didn't know what part of the screen to
 * look at," while EL1's "strict division into corners" is what players actually name as
 * accessible. Splitting one decision across two corners is what failed; a stable corner per role is
 * right.
 *
 * The top-left rail is **not** one of these anchors — it is the shell's own `Rail.tsx`, unchanged,
 * docked outside this module entirely.
 */
export type Anchor =
  | "top-strip"
  | "right-edge"
  | "bottom-right"
  | "bottom-left"
  | "left-edge";

export const ANCHORS: readonly Anchor[] = ["top-strip", "right-edge", "bottom-right", "bottom-left", "left-edge"];

/**
 * Which module owns each anchor's content, so a reader can tell a genuinely empty anchor (nothing
 * built yet) from a missing one (a bug). Only `left-edge` ever changes occupant while mounted — the
 * inspector, conditional on a selection — every other anchor's occupant is fixed for the session.
 */
export const ANCHOR_OWNER: Record<Anchor, string> = {
  "top-strip": "world-hud (this module)",
  "right-edge": "world-notify + world-outliner (Phase 3)",
  "bottom-right": "world-turn (Phase 3)",
  "bottom-left": "map controls (world-shell)",
  "left-edge": "world-inspector (Phase 2) — the one conditional occupant"
};
