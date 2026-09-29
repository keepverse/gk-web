import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { needsSayItBack } from "./wardenGate";

describe("needsSayItBack (world-stage W100)", () => {
  it("exactly at the boundary (balance === fee + upkeepPerDay) does not require step 2", () => {
    expect(needsSayItBack(140, 100, 40)).toBe(false);
  });

  it("one soul below the boundary requires step 2", () => {
    expect(needsSayItBack(139, 100, 40)).toBe(true);
  });

  it("one soul above the boundary does not require step 2", () => {
    expect(needsSayItBack(141, 100, 40)).toBe(false);
  });

  it("a comfortably large balance never requires step 2", () => {
    expect(needsSayItBack(1_000_000, 100, 40)).toBe(false);
  });

  it("a zero balance against any positive fee requires step 2", () => {
    expect(needsSayItBack(0, 1, 1)).toBe(true);
  });

  it("has no store access and no React import — a plain arithmetic predicate", () => {
    const text = readFileSync(join(__dirname, "wardenGate.ts"), "utf8");
    expect(text).not.toMatch(/from ["']react/i);
    expect(text).not.toMatch(/useQuery|useMutation|getJson|fetch\(/);
  });
});
