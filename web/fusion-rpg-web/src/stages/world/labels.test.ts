import { describe, expect, it } from "vitest";
import { isKnown, isPending } from "@/contract/pending";
import { factionLabel, laneLabel, legionLabel, sectorLabel } from "./labels";

describe("sectorLabel", () => {
  it("titles a sector id without touching the id itself", () => {
    expect(sectorLabel("ember-hollow")).toBe("Ember Hollow");
    expect(sectorLabel("homeworld")).toBe("Homeworld");
    expect(sectorLabel("")).toBe("");
  });
});

describe("laneLabel", () => {
  it("composes from the two sectors it connects, never from the lane's own truncated id", () => {
    // The real lane id for this pair is `l-home-ember` — splitting that directly would print
    // "Home Ember", not the two real sector names.
    expect(laneLabel("homeworld", "ember-hollow")).toBe("Homeworld – Ember Hollow");
  });

  it("does not collapse two identically-first-worded sectors into the same fragment", () => {
    expect(laneLabel("ash-waste", "black-gate")).toBe("Ash Waste – Black Gate");
  });
});

describe("factionLabel", () => {
  const factions = [{ factionId: "dave", name: "Dave" }];

  it("looks up the server-projected name — never guesses one", () => {
    const label = factionLabel("dave", factions);
    expect(isKnown(label)).toBe(true);
    expect(isKnown(label) && label.value).toBe("Dave");
  });

  it("is pending, not enemy or an empty string, for genuinely unowned ground", () => {
    const label = factionLabel(null, factions);
    expect(isPending(label)).toBe(true);
  });

  it("is pending for a faction id absent from this viewer's own payload — a real gap, not a null owner", () => {
    const label = factionLabel("wild", factions);
    expect(isPending(label)).toBe(true);
    expect(isPending(label) && label.reason).toBe("faction not in this payload");
  });
});

describe("legionLabel", () => {
  it("uses the real display name when the caller has one (WorldEntityDto.DisplayName, own forces only)", () => {
    const label = legionLabel("e-dave-legion-1", "Legion I");
    expect(isKnown(label)).toBe(true);
    expect(isKnown(label) && label.value).toBe("Legion I");
  });

  it("never fabricates a name by splitting the id — pending with a reason when none was supplied", () => {
    const label = legionLabel("e-dave-legion-1", null);
    expect(isPending(label)).toBe(true);
    expect(isPending(label) && label.reason).toContain("e-dave-legion-1");
  });

  it("treats an empty string the same as no name — never renders a blank label", () => {
    expect(isPending(legionLabel("e-dave-legion-1", ""))).toBe(true);
  });
});
