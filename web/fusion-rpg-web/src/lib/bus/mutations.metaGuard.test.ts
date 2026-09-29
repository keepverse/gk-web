import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T11: "Every mutation in lib/bus/mutations.ts produces a band-4 result."
 * The mechanism is one global `MutationCache` listener reading `meta.entity`
 * — this is the guard that nothing was missed when it was added, since a
 * mutation with no `meta.entity` silently produces no toast at all (not an
 * error, just invisible).
 */
describe("every exported mutation hook declares meta.entity (T11)", () => {
  it("has one meta.entity for every exported use*() hook", () => {
    const source = readFileSync(join(__dirname, "mutations.ts"), "utf8");
    const hookCount = (source.match(/^export function use\w+\(/gm) ?? []).length;
    const metaEntityCount = (source.match(/meta:\s*\{\s*entity:/g) ?? []).length;

    expect(hookCount).toBeGreaterThan(0);
    expect(metaEntityCount).toBe(hookCount);
  });
});
