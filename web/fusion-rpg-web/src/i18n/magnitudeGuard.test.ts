import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForBareNumberFormatters } from "./magnitudeGuard";

const i18nDir = __dirname;

describe("magnitudeGuard — real tree", () => {
  it("no exported format*() function in src/i18n/ accepts a bare number", () => {
    expect(scanForBareNumberFormatters(i18nDir)).toEqual([]);
  });
});

describe("magnitudeGuard — fixtures", () => {
  let fixtureDir: string;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("flags a bare-number formatter", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "magnitude-guard-"));
    mkdirSync(join(fixtureDir, "i18n"));
    writeFileSync(
      join(fixtureDir, "i18n", "rogue.ts"),
      "export function formatValue(value: number): string { return String(value); }\n"
    );
    expect(scanForBareNumberFormatters(fixtureDir)).toHaveLength(1);
  });

  it("does not flag a formatter that takes a Magnitude", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "magnitude-guard-"));
    mkdirSync(join(fixtureDir, "i18n"));
    writeFileSync(
      join(fixtureDir, "i18n", "fine.ts"),
      "export function formatMagnitude(m: Magnitude, locale = 'en'): string { return ''; }\n"
    );
    expect(scanForBareNumberFormatters(fixtureDir)).toEqual([]);
  });

  it("does not flag an unrelated exported function that happens to take a number", () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "magnitude-guard-"));
    mkdirSync(join(fixtureDir, "i18n"));
    writeFileSync(
      join(fixtureDir, "i18n", "fine2.ts"),
      "export function clampLevel(value: number): number { return value; }\n"
    );
    expect(scanForBareNumberFormatters(fixtureDir)).toEqual([]);
  });
});
