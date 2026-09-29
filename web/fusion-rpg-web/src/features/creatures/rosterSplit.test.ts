import { describe, expect, it } from "vitest";
import { ACTIVE_CAP, displayName, pityLine, splitRoster } from "./rosterSplit";
import type { CreatureSpecimenDto } from "@/lib/bus/creatures";

function specimen(
  id: string,
  speciesId: string,
  rarity: string,
  locked = false,
  createdUtc = "2026-08-21T00:00:00Z"
): CreatureSpecimenDto {
  return {
    actor: { instanceId: id } as CreatureSpecimenDto["actor"],
    profile: {
      instanceId: id,
      speciesId,
      rarity,
      variant: "normal",
      elementPrimary: "fire",
      traitIds: [],
      origin: "summon",
      locked,
      createdUtc,
      revision: 0
    }
  };
}

describe("splitRoster", () => {
  it("keeps everything active under the cap", () => {
    const items = [specimen("a", "imp", "chaff"), specimen("b", "hound", "cultivated")];
    const { active, reserve } = splitRoster(items);
    expect(active).toHaveLength(2);
    expect(reserve).toHaveLength(0);
  });

  it("locked specimens always sort into active first", () => {
    const items = [
      ...Array.from({ length: 30 }, (_, i) => specimen(`c${i}`, "imp", "chaff")),
      specimen("locked-chaff", "imp", "chaff", true)
    ];
    const { active } = splitRoster(items);
    expect(active[0].profile.instanceId).toBe("locked-chaff");
    expect(active).toHaveLength(ACTIVE_CAP);
  });

  it("rarity beats age for unlocked specimens, across several rungs", () => {
    const items = [
      specimen("old-chaff", "imp", "chaff", false, "2026-01-01T00:00:00Z"),
      specimen("mid-fused", "brute", "fused", false, "2026-02-01T00:00:00Z"),
      specimen("new-almanac", "dragon", "almanac", false, "2026-08-01T00:00:00Z"),
      // Same rung, different ages: the newer sorts after the older, proving age still decides ties.
      specimen("old-fused", "brute", "fused", false, "2026-01-15T00:00:00Z")
    ];
    const { active } = splitRoster(items);
    // Strongest first by ladder ordinal; age only within a rung.
    expect(active.map((s) => s.profile.instanceId)).toEqual([
      "new-almanac",
      "old-fused",
      "mid-fused",
      "old-chaff"
    ]);
  });

  it("an unknown rarity parks after the ladder instead of sorting silently", () => {
    // The test that would have caught the defect: a retired id must not match, must not throw,
    // and must not land among the ranked.
    const items = [
      specimen("known", "imp", "chaff"),
      specimen("retired", "hound", "legendary")
    ];
    const { active } = splitRoster(items);
    expect(active.map((s) => s.profile.instanceId)).toEqual(["known", "retired"]);
  });

  it("reserve stacks by species with counts, largest first", () => {
    const items = [
      ...Array.from({ length: ACTIVE_CAP }, (_, i) => specimen(`keep${i}`, "elite", "heirloom")),
      ...Array.from({ length: 7 }, (_, i) => specimen(`imp${i}`, "imp", "chaff")),
      ...Array.from({ length: 3 }, (_, i) => specimen(`wisp${i}`, "wisp", "chaff"))
    ];
    const { active, reserve } = splitRoster(items);
    expect(active).toHaveLength(ACTIVE_CAP);
    expect(reserve.map((r) => [r.speciesId, r.count])).toEqual([
      ["imp", 7],
      ["wisp", 3]
    ]);
  });
});

describe("pityLine", () => {
  it("renders both counters", () => {
    expect(pityLine(12, 25, 31, 55)).toBe("12/25 to guaranteed Epic · 31/55 to guaranteed Legendary");
  });
});

describe("displayName", () => {
  it("prefers nickname, then species name, then id", () => {
    const s = specimen("x", "hell-hound", "rare");
    expect(displayName(s, "Hell Hound")).toBe("Hell Hound");
    s.profile.nickname = "Ragnar";
    expect(displayName(s, "Hell Hound")).toBe("Ragnar");
    expect(displayName(specimen("y", "unknown-species", "common"))).toBe("unknown-species");
  });
});
