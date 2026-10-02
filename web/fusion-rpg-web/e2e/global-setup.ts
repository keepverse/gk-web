import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreRoot } from "../gkRoots.mjs";
import { evaluateBundleFreshness } from "./helpers/bundle-gate";

/**
 * Refuse to run the e2e suite against a bundle that is older than the sources feeding it.
 *
 * A Playwright `globalSetup` rather than a check inside a spec, so the refusal lands ONCE, before any
 * test runs, and names the remedy — instead of surfacing as a mysterious timeout inside whichever
 * spec happens to touch the changed surface first. It also cannot be missed by a reader who greps a
 * single spec file for the gate.
 *
 * Throwing here fails the RUN, which is the point: `npm run test:e2e` exits non-zero on a stale
 * bundle rather than reporting a green that certifies the previous build. See
 * `helpers/bundle-gate.ts` for why this is fail-closed and why sibling tuning data counts.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

export default function globalSetup(): void {
  const verdict = evaluateBundleFreshness({
    srcDir: path.join(webRoot, "src"),
    // The `@gk-core` alias pulls tuning JSON into the bundle verbatim, so a sibling's tuning change
    // invalidates this bundle exactly as a `src/` change does.
    tuningDir: path.join(coreRoot(), "data", "tuning"),
    outDir: path.join(coreRoot(), "src", "FusionRpg.Server", "wwwroot")
  });

  if (!verdict.ok) {
    throw new Error(
      `${verdict.reason}: ${verdict.detail}\n` +
        `  (newest source ${verdict.newestSourceMtime ?? "n/a"}, ` +
        `newest bundle ${verdict.newestBundleMtime ?? "n/a"})`
    );
  }
}
