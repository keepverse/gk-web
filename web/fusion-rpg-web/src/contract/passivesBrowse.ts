import type { TreeResolveReport } from "@/lib/bus";
import { investedTrees } from "./passivesYours";

/**
 * passive-tree-todo.md I4 — Level 1 ("All paths", spec-tree-surface.md §2.2/§7.3/§9.1). Pure
 * derivations over the same `TreeResolveReport[]` I3's Level 0 already reads, so `PathBrowse.tsx`
 * stays a thin render layer (I3's own precedent). Every value here is read from the report, never
 * recomputed from a lower-level number.
 */

/**
 * R7 names five categories -- `primary | elemental | status | family | species` -- but species is
 * Level 0b's own pinned-to-the-creature read and never enters this browse (§2.2, §3), so the
 * filter this module offers has four. The server serializes `TreeCategory.ToString()` verbatim
 * (`PassiveTreeEndpoints.cs`), i.e. PascalCase ("Primary", "Elemental", ...) on the wire -- every
 * comparison below normalizes with `.toLowerCase()` rather than assume a casing, since at least one
 * existing I3 test fixture already assumed the wrong one (lowercase) without it mattering there
 * (I3's own derivations never read `category` at all).
 */
export type PathCategory = "primary" | "elemental" | "status" | "family";
export const PATH_BROWSE_CATEGORIES: PathCategory[] = ["primary", "elemental", "status", "family"];

/** §9.1 rule 1: "the condition names the world, not the player... not 'coming soon'." One string,
 * exported so `passivesLattice.ts` (I6, Level 2's own gate-less presentation) renders the exact same
 * sentence rather than a second hand-authored copy that could drift from this one. */
export const GATELESS_CONDITION_TEXT = "nothing in the world teaches this yet.";

function categoryOf(tree: TreeResolveReport): string {
  return tree.category.toLowerCase();
}

/** The four VISIBLE buckets of §2.2's Level 1 default order, in order. The fifth bucket -- gate-less
 * paths -- is deliberately not a member of this type: §9.1 rule 3 collapses it behind one row that
 * sorts last, and rule 4 says it is counted in nothing this module produces, so a gate-less tree
 * never reaches `bucketFor` at all (see `orderPathBrowse`). */
export type PathBucket = "invested" | "stanceMate" | "elementMatch" | "other";

const BUCKET_ORDER: readonly PathBucket[] = ["invested", "stanceMate", "elementMatch", "other"];

/**
 * §7.3: "the mitigation is ordering" -- bucket 2 is "your own stance's other three paths," and the
 * report already names this without a private stance table: D28's cross-unlock
 * (`CrossUnlock.Lender`, spec-tree-resolve.md §4) sets a non-null `lenderTreeId` on a tree if and
 * only if some OTHER tree in the same stance group (always one of this actor's own primary trees)
 * has aptitude points in it -- exactly "already open... and the player does not know it," and
 * exactly the field the report was built to carry so this surface never re-derives the stance
 * grouping itself (the "one power ladder / no private curves" rule extended to this grouping).
 *
 * Bucket 3 ("paths matching this creature's element") reads `elementIds` -- the actor's own
 * resolved element typing, passed in by the caller (`ActorView.elementTyping`, when known). §2.2
 * also names a status match; there is no per-actor status-affinity field on the wire today
 * (`ActorView` carries none), so an empty `elementIds` set or an omitted one simply yields no
 * bucket-3 matches -- an honest wiring gap, not a fabricated one, and this function does not
 * infer one from any other field.
 */
export function bucketFor(
  tree: TreeResolveReport,
  investedTreeIds: ReadonlySet<string>,
  elementIds: ReadonlySet<string>
): PathBucket {
  if (investedTreeIds.has(tree.treeId)) return "invested";
  if (tree.lenderTreeId) return "stanceMate";
  if (categoryOf(tree) === "elemental" && elementIds.has(tree.treeId)) return "elementMatch";
  return "other";
}

/** §9.1 rule 5: "the surface reads a field, never a list of ids" -- gate-less-ness is read straight
 * off `gateState`, never inferred from a zero aptitude/tier value. */
export function isGateless(tree: TreeResolveReport): boolean {
  return tree.gateState === "unproduced";
}

/**
 * §3: "879 is never a collection anywhere" -- a species/bloodline tree is I5's Level 0b, pinned to
 * one creature, and must never be a member of this browse (I4's own 39-shared-paths scope) or its
 * gate-less bucket. `PassiveTreeEndpoints.cs:95` already filters `TreeCategory.Species` out
 * server-side before this module ever sees a tree, so in practice this is defense-in-depth rather
 * than the only guard -- but it is THIS module's own guard, not borrowed from the server's: nothing
 * here should trust the wire payload alone to keep a species tree out of an ordered or bucketed list.
 */
export function isSpeciesTree(tree: TreeResolveReport): boolean {
  return categoryOf(tree) === "species";
}

/** §9.1 rule 3: sorts last, collapsed behind one row. Kept as its own function (rather than inline
 * in `orderPathBrowse`) so `gatelessCount` can read the same real set the collapsed row expands to.
 * A species tree is excluded here too (§3) -- it collapses into nothing, not into this row. */
export function gatelessPaths(trees: TreeResolveReport[]): TreeResolveReport[] {
  return trees.filter((t) => isGateless(t) && !isSpeciesTree(t));
}

/** §9.1 rule 3: "the count in that row is read, never typed... 27 is today's number, not a
 * constant." Independent of any active search/category query -- the collapsed row's own count is
 * the report's total, matching test 36's own framing ("flip one path's gateState... the collapsed
 * row's count drops by one, and no other change"). */
export function gatelessCount(trees: TreeResolveReport[]): number {
  return gatelessPaths(trees).length;
}

/**
 * §2.2's Level 1 default order: invested -> stance mates -> element match -> everything else,
 * with every gate-less path removed first (§9.1 rule 3 -- it never competes for a slot in this
 * list, it collapses into its own row instead). Ties within a bucket keep the report's own order
 * (the catalog's, deterministic and not reshuffled here).
 */
export function orderPathBrowse(trees: TreeResolveReport[], elementIds: readonly string[] = []): TreeResolveReport[] {
  const invested = new Set(investedTrees(trees).map((t) => t.treeId));
  const elements = new Set(elementIds);
  const byBucket = new Map<PathBucket, TreeResolveReport[]>(BUCKET_ORDER.map((b) => [b, [] as TreeResolveReport[]]));

  for (const tree of trees) {
    if (isSpeciesTree(tree)) continue; // §3: a bloodline never enters this browse
    if (isGateless(tree)) continue; // never competes for an ordered slot -- §9.1 rule 3
    byBucket.get(bucketFor(tree, invested, elements))!.push(tree);
  }

  return BUCKET_ORDER.flatMap((bucket) => byBucket.get(bucket)!);
}

export type PathBrowseQuery = {
  searchText: string;
  category: PathCategory | "all";
};

export const EMPTY_PATH_BROWSE_QUERY: PathBrowseQuery = { searchText: "", category: "all" };

function searchableText(tree: TreeResolveReport): string {
  return `${tree.treeId} ${categoryOf(tree)}`.toLowerCase();
}

/** Search plus the four category filters (§2.2). Applied to whatever list the caller hands in --
 * the ordered/visible list or the gate-less set -- so both can be narrowed by the same query. */
export function filterPathBrowse(trees: TreeResolveReport[], query: PathBrowseQuery): TreeResolveReport[] {
  const q = query.searchText.trim().toLowerCase();
  return trees.filter(
    (t) => (query.category === "all" || categoryOf(t) === query.category) && (!q || searchableText(t).includes(q))
  );
}
