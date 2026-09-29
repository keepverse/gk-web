/**
 * I1 (spec-tree-surface.md §11, §14): volume fixtures for the passive-tree surfaces that I2-I10
 * have not built yet — `PassiveTreeEndpoints.cs` / `PassiveTreeDtos.cs` (I2) don't exist, so the
 * real wire shape is unknown. This generates the minimum structural stand-in the future
 * `PathBrowse.tsx` (I4) and `PathLattice.tsx` (I6) specs need to prove a render *strategy* at
 * scale — count, ids, and the handful of fields §9.1 already locks (`gateState`, `invested`) — not
 * a faithful `PassiveTreeStateDto`. When I2 ships the real DTO, replace the shape here with the
 * real one; the counts and the calling convention (one function per volume) should not need to
 * change.
 *
 * Mirrors the established shape of `e2e/volume-fixtures.spec.ts`'s own `actorFixture(count)` —
 * same pattern (a plain generator function, not a checked-in JSON blob), because the fixture is
 * parametric over count rather than one fixed golden record.
 */

export type PassiveTreePathFixtureEntry = {
  pathId: string;
  name: string;
  /** §9.1: the only two states a path's tier presentation may read. A gate-less ("unproduced")
   * path renders a condition, never a distance — real content, not typed-in yet, is `undefined`. */
  gateState: "wired" | "unproduced";
  invested: boolean;
};

/**
 * The path browse (I4, GG-50). §9.1 rule 3: 27 of the real 39 paths are gate-less today and
 * collapse into one row — this generator keeps that same rough proportion (roughly a third
 * `unproduced`) at any requested count, so a volume test exercises the collapsed-bucket path too,
 * not just the ordered list.
 */
export function passiveTreePathBrowseFixture(count: number): PassiveTreePathFixtureEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    pathId: `path-${i}`,
    name: `Path ${i}`,
    gateState: i % 3 === 0 ? "unproduced" : "wired",
    invested: i % 11 === 0
  }));
}

/** I6 shipped the real `TreeNodeSummaryDto` shape — this generator now emits exactly that (the
 * comment above this section named the swap: "When I2 ships the real DTO, replace the shape here
 * with the real one"), so the fixture and the wire never drift apart. */
export type PassiveTreeLatticeNodeFixtureEntry = {
  nodeId: string;
  branch: string;
  tier: number;
  nodeClass: string;
};

/**
 * The lattice (I6, GG-61). §14 test 4 fixes the shape at 40 cells regardless of requested scale —
 * the lattice is one path's own fixed 2 x 10-tier grid (spec-tree-surface.md §2.3, B1's own shape:
 * 2 branches x 10 tiers x 2 nodes-per-slot), not a collection that grows with player data, so unlike
 * the browse there is no 10/100/1000 parameter here. Kept as its own function (rather than a `count`
 * argument) so a caller can't accidentally ask for a lattice size that cannot exist.
 */
export function passiveTreeLatticeFixture(treeSlug = "might"): PassiveTreeLatticeNodeFixtureEntry[] {
  const nodes: PassiveTreeLatticeNodeFixtureEntry[] = [];
  for (let tier = 1; tier <= 10; tier++) {
    for (const branch of ["Off", "Def"]) {
      for (const n of [0, 1]) {
        nodes.push({ nodeId: `skill.${treeSlug}-${branch.toLowerCase()}-t${tier}-n${n}`, branch, tier, nodeClass: "Magnitude" });
      }
    }
  }
  return nodes;
}
