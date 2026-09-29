/**
 * Lawn interactive presentation tokens (T0).
 * Structural caps are not progression ceilings — comment on draw N.
 * Do not put balance numbers in Core Policy.
 */

/** Dock reserved left column width (px). */
export const LAWN_DOCK_WIDTH_PX = 320;

/**
 * Max sprites drawn per cell before `+K` overflow pip.
 * Structural draw cap (not a progression ceiling).
 */
export const LAWN_CELL_STACK_MAX_SPRITES = 4;

/** Stable overlap offset per stacked occupant after the first (px). */
export const LAWN_CELL_STACK_OFFSET_PX = 7;

/** Page size inside the 25–240 ActorCollection window. */
export const ACTOR_COLLECTION_PAGE_SIZE = 48;

/** GG-50 volume cutoffs (declared once — dock must not restate). */
export const ACTOR_COLLECTION_RENDER_ALL_MAX = 24;
export const ACTOR_COLLECTION_SEARCH_FIRST_ABOVE = 240;
