import { describe, expect, it } from "vitest";
import { shouldLandOnSanctum } from "./entryLanding";

/**
 * rift-gate entry-landing: the one landing rule, as a truth table. No DOM.
 *
 * The rule is deliberately about the durable first-open FACT, not about the route or the marker: a
 * returning player must keep their own route, and a plain browser visit must be unaffected.
 */
describe("entryLanding — the one landing rule", () => {
  it("lands on /sanctum on the first open", () => {
    expect(shouldLandOnSanctum({ firstOpen: true, embedded: true, pathname: "/" })).toBe(true);
  });

  it("does not re-navigate when already on /sanctum", () => {
    expect(shouldLandOnSanctum({ firstOpen: true, embedded: true, pathname: "/sanctum" })).toBe(false);
  });

  it("does not force the entry point on a returning player", () => {
    expect(shouldLandOnSanctum({ firstOpen: false, embedded: true, pathname: "/" })).toBe(false);
    expect(shouldLandOnSanctum({ firstOpen: false, embedded: true, pathname: "/lawn" })).toBe(false);
  });

  it("is not keyed on the embed marker — a browser first-open lands too", () => {
    // The fact is about the FE being opened, which is true in a normal browser visit as well.
    expect(shouldLandOnSanctum({ firstOpen: true, embedded: false, pathname: "/" })).toBe(true);
  });

  it("lands from any route, not just the title screen", () => {
    for (const path of ["/", "/saves", "/storage", "/creatures"]) {
      expect(shouldLandOnSanctum({ firstOpen: true, embedded: true, pathname: path })).toBe(true);
    }
  });
});
