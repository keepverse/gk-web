import { describe, expect, it } from "vitest";
import type { DelveSightState } from "@/contract/types";
import { sightRevealFor } from "./sightTreatment";

const ALL_SIGHTS: DelveSightState[] = ["None", "Glimpse", "Full"];

describe("sightRevealFor — the three sight treatments (spec-delve-stage.md §7, Visibility.cs:6-16)", () => {
  it("None shows nothing — position and lanes only", () => {
    expect(sightRevealFor("None")).toEqual({ showsKind: false, showsDetail: false });
  });

  it("Glimpse shows kind only, never detail (spec-supplies-and-objects.md:362)", () => {
    expect(sightRevealFor("Glimpse")).toEqual({ showsKind: true, showsDetail: false });
  });

  it("Full shows everything", () => {
    expect(sightRevealFor("Full")).toEqual({ showsKind: true, showsDetail: true });
  });

  it("never throws for any of the three real sight states", () => {
    for (const sight of ALL_SIGHTS) {
      expect(() => sightRevealFor(sight)).not.toThrow();
    }
  });

  it("throws on an unrecognised value rather than silently guessing (matches fogTreatmentFor's own exhaustive-switch shape)", () => {
    expect(() => sightRevealFor("Bogus" as DelveSightState)).toThrow(/unhandled sight state/);
  });
});
