/**
 * The nine blocks, in the plate's own deliberate order (`spec-world-inspector.md` §2): identity
 * first, then the thing that can take the ground away from you, then the two economies, then what
 * is on the ground, then what you can do about it. The Actions cluster is a tenth, unnumbered region
 * — every block above states a fact; Actions is the one region that takes an order.
 */
export const BLOCK_ORDER = [
  "identity",
  "ground",
  "next-turn",
  "sector-loam",
  "territory",
  "slots",
  "forces",
  // empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a): the vault block
  // slots in AFTER the slots/forces facts and BEFORE warden/dowsing — the plate's own logic
  // ("what is on the ground, then what you can do about it"). Appended by order, never
  // reordering the nine existing ids (4D.2b shares this discipline).
  "vault",
  "warden",
  "dowsing"
] as const;

export type BlockId = (typeof BLOCK_ORDER)[number];
