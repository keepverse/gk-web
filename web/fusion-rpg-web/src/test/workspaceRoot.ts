// The workspace resolver, as TypeScript sees it.
//
// This module deliberately contains NO logic. It re-exports gkRoots.mjs - the same file
// vite.config.ts uses for its aliases and its outDir - so a test that reads a sibling
// repository's source resolves it exactly the way the build does. An earlier version of these
// tests reached across repositories with a hop count written as separate ".." arguments to a
// path join, which is a layout restated as arithmetic: `join(__dirname, "..", "..", "..", "..",
// "..", "src", "FusionRpg.Core", ...)` was correct while the web sat beside the core, and after
// the move to gk-web it resolved to gk-web/src/... - a path that does not exist. Six hops is not
// a fact about the world; it is a fact about where this file used to live.

export { coreRoot, dataRoot, workflowRoot, allRoots, DEFAULT_PACK } from "../../gkRoots.mjs";

import path from "node:path";
import { coreRoot, dataRoot, workflowRoot } from "../../gkRoots.mjs";
import { fileURLToPath } from "node:url";

/**
 * The root of THIS repository - gk-web - for a test that shells out to git about gk-web's own
 * paths. Distinct from the sibling roots above: a guard that checks this repository's working tree
 * must ask about this repository, and deriving its location by counting ".." hops reaches whatever
 * directory happens to sit above the package, which after the split is gk-web's parent.
 */
export function webRoot(): string {
  // src/test/ -> src/ -> the package root, whose parent is the gk-web repository.
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/**
 * A path inside a sibling repository, named by the repository that owns it.
 *
 *   coreFile("src", "FusionRpg.Core", "World", "Turn", "WorldCommand.cs")
 *   workflowDoc("docs", "design", "information-architecture.md")
 *
 * The point is that the CALLER says which repository it means. A hop count cannot: it says how
 * far away it thinks the target is, which is a different question and one that a move invalidates
 * without any compiler or test noticing.
 */
export function coreFile(...parts: string[]): string {
  return [coreRoot(), ...parts].join("\\");
}

/** A path inside the gk-data pack. Private content: read it, never copy it into this repository. */
export function dataFile(...parts: string[]): string {
  return [dataRoot(), ...parts].join("\\");
}

/** A path inside gk-workflow - the developer documentation and the GUI theme/recipe packs. */
export function workflowDoc(...parts: string[]): string {
  return [workflowRoot(), ...parts].join("\\");
}
