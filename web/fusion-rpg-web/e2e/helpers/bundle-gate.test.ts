import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateBundleFreshness } from "./bundle-gate";

/**
 * Hermetic by construction: every case plants its own tree in a temp directory and sets mtimes
 * EXPLICITLY with `utimesSync`, so no assertion depends on how fast the filesystem is, on the real
 * repository's timestamps, or on a `npm run build` having happened. That last one matters most —
 * this gate is about a bundle, and a test that read the real one would be the same rot it exists to
 * catch.
 */

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-gate-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** Write `rel` under `root` with an explicit mtime (epoch seconds). */
function plant(rel: string, mtimeSeconds: number, contents = "{}"): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  fs.utimesSync(full, mtimeSeconds, mtimeSeconds);
  return full;
}

const T = (n: number) => new Date(n * 1000);

describe("evaluateBundleFreshness", () => {
  it("GREEN CONTROL: accepts a bundle newer than every source that feeds it", () => {
    plant("src/app.tsx", 1000);
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    // Asserted positively, not by the absence of a throw: this is the case that proves the gate can
    // actually pass, so a gate that refused unconditionally would fail here instead of looking
    // correct everywhere else.
    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toBe("");
    expect(verdict.newestBundleMtime).toBeGreaterThan(verdict.newestSourceMtime as number);
  });

  it("GREEN CONTROL: equal mtimes are accepted (a build finishing on the source's own second is not staleness)", () => {
    plant("src/app.tsx", 1500);
    plant("out/index.html", 1500);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(true);
  });

  it("refuses a stale bundle by name, and names the file that decided it", () => {
    plant("src/app.tsx", 3000);
    plant("out/index.html", 1000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("E2E-BUNDLE-STALE");
    // The remedy has to be actionable: which file, and that e2e would test the previous build.
    expect(verdict.newestSourceFile).toContain("app.tsx");
    expect(verdict.detail).toContain("npm run build");
  });

  it("refuses a MISSING bundle rather than passing an unknown (fail closed)", () => {
    plant("src/app.tsx", 1000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "never-built")
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("E2E-BUNDLE-MISSING");
  });

  it("refuses an EMPTY bundle directory", () => {
    plant("src/app.tsx", 1000);
    fs.mkdirSync(path.join(root, "out"), { recursive: true });

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("E2E-BUNDLE-EMPTY");
  });

  it("refuses a missing source tree instead of comparing nothing", () => {
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "absent-src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("E2E-SRC-TREE-MISSING");
  });

  it("a test file newer than the bundle does NOT make it stale — tests never reach the bundle", () => {
    plant("src/app.tsx", 1000);
    plant("src/app.test.tsx", 9000);
    plant("src/helper.spec.ts", 9000);
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(true);
  });

  it("counts SIBLING tuning data as a source, because the @gk-core alias bundles it verbatim", () => {
    plant("src/app.tsx", 1000);
    plant("tuning/actor-sheet.v1.json", 5000);
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: path.join(root, "tuning"),
      outDir: path.join(root, "out")
    });

    // The FE looks unchanged; only a sibling's tuning moved. Without this the whole cross-repository
    // false-green class stays open.
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("E2E-BUNDLE-STALE");
    expect(verdict.newestSourceFile).toContain("actor-sheet.v1.json");
  });

  it("an ABSENT tuning directory is not a refusal — a standalone gk-web clone has no sibling", () => {
    plant("src/app.tsx", 1000);
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: path.join(root, "no-such-sibling"),
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(true);
  });

  it("a non-source extension does not count as a source", () => {
    plant("src/app.tsx", 1000);
    plant("src/notes.md", 9000);
    plant("out/index.html", 2000);

    const verdict = evaluateBundleFreshness({
      srcDir: path.join(root, "src"),
      tuningDir: null,
      outDir: path.join(root, "out")
    });

    expect(verdict.ok).toBe(true);
  });
});
