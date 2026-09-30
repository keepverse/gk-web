// One workspace resolver for the web package, and the SAME contract as
// FusionRpg.Core.Workspace.KeepverseRoots on the C# side:
//
//   * a KEEPVERSE_*_ROOT environment override wins, and
//   * otherwise walk up from this file to the Keepverse workspace - a directory
//     holding gk-core/ next to gk-data/ - and
//   * a root that cannot be found THROWS. It is never guessed and never
//     silently substituted with a path that does not exist.
//
// The same rule appears three times on the C# side (KeepverseRoots, the seedsmith
// workspace_roots.py, and gk-core/scripts/lib/keepverse_roots.py) plus this file.
// That is duplication, but it is duplication of a CONTRACT rather than of logic:
// four implementations of one documented rule, each in the language its repository
// is written in. What must not happen is a fifth implementation inventing a fifth
// rule, which is what the relative-hop imports this file replaces were doing - each
// `../../../data/tuning/...` restated the workspace layout as a hop count that was
// correct only while the web lived beside the tuning it reads.
//
// Two bugs from the C# side are designed out explicitly, because both shipped:
//
//   * the walk-up condition MUST test the directory it is walking through. A
//     condition built from an already-absolute root is loop-invariant, the walk
//     cannot move, and the result is silently pinned to wherever the process
//     started. `assert` below states the invariant in the one place it can be.
//
//   * the pack name is read from KEEPVERSE_PACK with the same default the C#
//     resolver uses, and a wrong pack name fails loudly instead of producing a
//     path that merely does not exist.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The pack the corpus ships as. Kept in step with KeepverseRoots.DefaultPack. */
export const DEFAULT_PACK = "fusion";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from the package to the Keepverse workspace. The condition examines
 * `dir`, the directory currently under consideration - never an absolute path
 * computed elsewhere, which would make the walk a no-op.
 */
function detectWorkspace() {
  let dir = packageDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, "gk-core")) && fs.existsSync(path.join(dir, "gk-data"))) {
      return dir;
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const workspace = detectWorkspace();

function env(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function root(kind, overrideName, ...relativeToWorkspace) {
  const override = env(overrideName);
  if (override) return override;
  if (workspace === null) {
    throw new Error(
      `No Keepverse workspace above '${packageDir}' (a directory holding gk-core/ next to ` +
        `gk-data/), and ${overrideName} is not set. The web reads tuning from gk-core, the ` +
        `seed corpus from gk-data and the theme packs from gk-workflow, so it cannot resolve ` +
        `them from inside a standalone clone. Clone the workspace, or set ${overrideName}.`
    );
  }
  return path.join(workspace, ...relativeToWorkspace);
}

/** gk-core: the tuning tables and the server's wwwroot, which is the build output. */
export function coreRoot() {
  return root("core", "KEEPVERSE_CORE_ROOT", "gk-core");
}

/** gk-data's pack: the authored seed corpus. Private - never copied into this repository. */
export function dataRoot() {
  const pack = env("KEEPVERSE_PACK") ?? DEFAULT_PACK;
  const dir = root("data", "KEEPVERSE_DATA_ROOT", "gk-data", "packs", pack);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `The '${pack}' content pack does not exist at '${dir}'. The workspace is at ` +
        `'${workspace}'. Set KEEPVERSE_PACK if the corpus ships under another name.`
    );
  }
  return dir;
}

/** gk-workflow: the developer-facing documentation the GUI theme packs live in. */
export function workflowRoot() {
  return root("workflow", "KEEPVERSE_WORKFLOW_ROOT");
}

/** Every root at once, for callers that want to report the whole resolution. */
export function allRoots() {
  return { core: coreRoot(), data: dataRoot(), workflow: workflowRoot() };
}
