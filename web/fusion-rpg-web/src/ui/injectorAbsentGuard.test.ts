import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForInjectorGating } from "./injectorAbsentGuard";

const srcDir = join(__dirname, "..");

/**
 * I1 (spec-tree-surface.md §10, §14 test 28): "the standing verification block ... and no web
 * command at all, so every surface task had no verification bar." This is that bar for GG-39,
 * built before I3-I10 exist so those tasks (and I6's own "tests 9 and 28" verification line) have
 * something real to run against. It is a scanner, not a per-surface render test, for the same
 * reason `vocabularyGuard`/`bandGuard` are scanners: it covers every file under `src/` today AND
 * every file the passive-tree module adds later, with no extra row to remember to add per surface.
 */
describe("GG-39 — standalone-first", () => {
  it("Every_surface_renders_with_the_injector_absent", () => {
    expect(scanForInjectorGating(srcDir)).toEqual([]);
  });
});

describe("injectorAbsentGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a surface that hides content when the injector is absent", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "injector-guard-"));
    mkdirSync(join(fixtureDir, "ui", "actor", "passives"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "ui", "actor", "passives", "Rogue.tsx"),
      "export const Rogue = (health: { injectorConnected: boolean }) => health.injectorConnected ? <PathBrowse /> : null;\n"
    );
    const violations = scanForInjectorGating(fixtureDir);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "ui/actor/passives/Rogue.tsx", line: 1 });
  });

  it("flags a surface that disables a control based on injector state", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "injector-guard-"));
    mkdirSync(join(fixtureDir, "ui", "actor", "passives"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "ui", "actor", "passives", "Rogue.tsx"),
      "export const Rogue = ({ c }: { c: boolean }) => <button disabled={!c && false} data-c={c}>{String(injectorConnected)}</button>;\n"
    );
    expect(scanForInjectorGating(fixtureDir)).toHaveLength(1);
  });

  it("does not flag the allow-listed connection-status readout", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "injector-guard-"));
    mkdirSync(join(fixtureDir, "layers", "system"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "layers", "system", "SystemLayer.tsx"),
      'export const x = health.data?.injectorConnected ? "game connected" : "game not connected";\n'
    );
    expect(scanForInjectorGating(fixtureDir)).toEqual([]);
  });

  it("does not flag the wire type declaration", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "injector-guard-"));
    mkdirSync(join(fixtureDir, "lib", "bus"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "lib", "bus", "types.ts"),
      "export type HealthDto = {\n  injectorConnected: boolean;\n};\n"
    );
    expect(scanForInjectorGating(fixtureDir)).toEqual([]);
  });

  it("does not flag a comment mentioning the field", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "injector-guard-"));
    mkdirSync(join(fixtureDir, "ui"), { recursive: true });
    writeFileSync(
      join(fixtureDir, "ui", "Clean.tsx"),
      "// GG-39: never branch on injectorConnected here\nexport const x = 1;\n"
    );
    expect(scanForInjectorGating(fixtureDir)).toEqual([]);
  });
});
