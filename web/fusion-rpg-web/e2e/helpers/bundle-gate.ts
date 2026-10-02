import fs from "node:fs";
import path from "node:path";

/**
 * Is the bundle the e2e suite actually SERVES current with respect to the sources that feed it?
 *
 * The trap this closes, measured rather than imagined: `vite.config.ts` sends `build.outDir` to
 * `<gk-core>/src/FusionRpg.Server/wwwroot`, gk-core gitignores every `wwwroot` directory, and that
 * one holds 0 TRACKED files. `npm run preview` serves whatever is sitting there. So the suite's verdict
 * is decided by WHEN SOMEONE LAST RAN `npm run build`, not by gk-web's source, and nothing
 * enforced the relationship. Change one `src/` file, skip the build, and e2e reports green against
 * the PREVIOUS bundle — a false green that is indistinguishable from a real pass.
 *
 * Why it bites this repo specifically rather than only in theory: the served bundle also carries
 * `@gk-core/data/tuning/*.json` through the `@gk-core` alias, so a change in a SIBLING repository's
 * tuning data invalidates the bundle just as much as a change in `src/` does. Comparing only `src/`
 * would leave that whole class of false green open, so the tuning directory is a first-class input.
 *
 * Fail-closed by design. A missing or unreadable source tree, a missing bundle, or an unreadable
 * directory is a REFUSAL with a named reason, never a silent "looks fresh". The whole point is to
 * refuse when freshness cannot be established — an unknown is not a pass.
 */

/** Files under `src/` that do not reach the bundle: vitest/vite never bundles a test file. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json"]);

/** Excluded so editing a test cannot make the bundle look stale. */
const NOT_BUNDLED = /(?:^|[\\/])(?:node_modules|dist|playwright-report|test-results|coverage)(?:[\\/]|$)/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

export type FreshnessVerdict = {
  /** True only when freshness was positively established. */
  ok: boolean;
  /** Named refusal token, e.g. `E2E-BUNDLE-STALE`. Empty when `ok`. */
  reason: string;
  /** Human sentence naming the exact remedy. Empty when `ok`. */
  detail: string;
  /** Newest mtime (epoch ms) across bundle-feeding sources; null when none were found. */
  newestSourceMtime: number | null;
  /** Newest mtime (epoch ms) across the served bundle; null when the bundle is absent. */
  newestBundleMtime: number | null;
  /** The source file that decided it, for a refusal the reader can act on without guessing. */
  newestSourceFile: string | null;
};

function newestMtime(dir: string, keep: (file: string) => boolean): { mtime: number; file: string } | null {
  let newest: { mtime: number; file: string } | null = null;
  // `withFileTypes` + an explicit dirent check keeps this off symlinked dependency trees, which is
  // what made a naive recursive walk report a dependency's mtime as "the newest source".
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (NOT_BUNDLED.test(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || !keep(full)) continue;
      let mtime: number;
      try {
        mtime = fs.statSync(full).mtimeMs;
      } catch {
        continue;
      }
      if (newest === null || mtime > newest.mtime) newest = { mtime, file: full };
    }
  }
  return newest;
}

const isBundleFeedingSource = (file: string): boolean =>
  SOURCE_EXTENSIONS.has(path.extname(file)) && !TEST_FILE.test(file) && !NOT_BUNDLED.test(file);

export type FreshnessInput = {
  /** The FE's own `src/` tree. */
  srcDir: string;
  /** Sibling tuning data pulled in through the `@gk-core` alias; bundled verbatim. */
  tuningDir?: string | null;
  /** `build.outDir` — the directory `npm run preview` actually serves. */
  outDir: string;
};

export function evaluateBundleFreshness(input: FreshnessInput): FreshnessVerdict {
  const base: FreshnessVerdict = {
    ok: false,
    reason: "",
    detail: "",
    newestSourceMtime: null,
    newestBundleMtime: null,
    newestSourceFile: null
  };

  if (!fs.existsSync(input.srcDir) || !fs.statSync(input.srcDir).isDirectory()) {
    return { ...base, reason: "E2E-SRC-TREE-MISSING", detail: `No source tree at ${input.srcDir}.` };
  }

  const srcNewest = newestMtime(input.srcDir, isBundleFeedingSource);
  if (srcNewest === null) {
    return { ...base, reason: "E2E-SRC-TREE-EMPTY", detail: `No bundle-feeding source under ${input.srcDir}.` };
  }

  // The tuning tree is optional in shape (a sibling may be absent) but when PRESENT it feeds the
  // bundle, so it joins the comparison. An absent one is not a refusal: a standalone gk-web clone
  // legitimately has no sibling, and refusing there would break A11's "runs from a clone" clause.
  let newestSource = srcNewest;
  if (input.tuningDir && fs.existsSync(input.tuningDir)) {
    const tuningNewest = newestMtime(input.tuningDir, isBundleFeedingSource);
    if (tuningNewest !== null && tuningNewest.mtime > newestSource.mtime) {
      newestSource = tuningNewest;
    }
  }

  if (!fs.existsSync(input.outDir)) {
    return {
      ...base,
      reason: "E2E-BUNDLE-MISSING",
      detail:
        `The served bundle directory ${input.outDir} does not exist, so e2e would report against ` +
        `nothing. Run \`npm run build\` first.`,
      newestSourceMtime: newestSource.mtime,
      newestSourceFile: newestSource.file
    };
  }

  const bundleNewest = newestMtime(input.outDir, () => true);
  if (bundleNewest === null) {
    return {
      ...base,
      reason: "E2E-BUNDLE-EMPTY",
      detail: `The served bundle directory ${input.outDir} holds no files. Run \`npm run build\` first.`,
      newestSourceMtime: newestSource.mtime,
      newestSourceFile: newestSource.file
    };
  }

  if (bundleNewest.mtime < newestSource.mtime) {
    return {
      ...base,
      reason: "E2E-BUNDLE-STALE",
      detail:
        `The served bundle is older than the sources that feed it. Newest source ` +
        `${newestSource.file} (${newestSource.mtime}) is newer than the newest bundle file ` +
        `${bundleNewest.file} (${bundleNewest.mtime}). e2e would test the PREVIOUS build and ` +
        `report green against it. Run \`npm run build\`.`,
      newestSourceMtime: newestSource.mtime,
      newestBundleMtime: bundleNewest.mtime,
      newestSourceFile: newestSource.file
    };
  }

  return {
    ok: true,
    reason: "",
    detail: "",
    newestSourceMtime: newestSource.mtime,
    newestBundleMtime: bundleNewest.mtime,
    newestSourceFile: newestSource.file
  };
}
