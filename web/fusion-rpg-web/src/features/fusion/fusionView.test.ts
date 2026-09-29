import { describe, expect, it } from "vitest";
import {
  costWithPicks,
  haveNeed,
  picksSoulsCost,
  recipeLabel,
  starPips,
  togglePick,
  STAR_CAPS,
  type PickableAtom
} from "./fusionView";

const cost = {
  souls: 150,
  shardMaterialId: "shard.common",
  shardCount: 2,
  essenceMaterialId: "essence.fire",
  essenceCount: 2
};

describe("haveNeed", () => {
  it("marks lines and overall affordability", () => {
    const { lines, affordable } = haveNeed(
      cost,
      [{ materialId: "shard.common", qty: 5 }, { materialId: "essence.fire", qty: 1 }],
      1000
    );
    expect(affordable).toBe(false); // essence short
    expect(lines[0]).toMatchObject({ label: "Souls", have: 1000, need: 150, enough: true });
    expect(lines[1]).toMatchObject({ have: 5, need: 2, enough: true });
    expect(lines[2]).toMatchObject({ have: 1, need: 2, enough: false });
  });

  it("missing shelf entries count as zero", () => {
    const { affordable, lines } = haveNeed(cost, [], 0);
    expect(affordable).toBe(false);
    expect(lines.every((l) => !l.enough || l.need === 0)).toBe(true);
  });
});

describe("starPips", () => {
  it("fills to the star and hollows to the cap", () => {
    expect(starPips(1, STAR_CAPS.common)).toBe("★☆☆");
    expect(starPips(3, STAR_CAPS.common)).toBe("★★★");
    expect(starPips(0, STAR_CAPS.rare)).toBe("☆☆☆☆");
    expect(starPips(9, STAR_CAPS.epic)).toBe("★★★★★"); // clamped
  });
});

describe("togglePick", () => {
  const pickA = { sourceInstanceId: "spec-a", atomId: "atom.one" };
  const pickB = { sourceInstanceId: "spec-a", atomId: "atom.two" };
  const pickC = { sourceInstanceId: "spec-b", atomId: "atom.three" };

  it("adds a new pick under the cap", () => {
    expect(togglePick([], pickA, 2)).toEqual([pickA]);
  });

  it("removes an already-selected pick regardless of the cap", () => {
    expect(togglePick([pickA], pickA, 1)).toEqual([]);
  });

  it("refuses to add past slotCap — the UI can never assemble an over-cap request", () => {
    const atCap = togglePick([pickA, pickB], pickC, 2);
    expect(atCap).toEqual([pickA, pickB]); // unchanged, pickC never lands
  });

  it("distinguishes picks naming the same atom id from a different source", () => {
    const differentSource = { sourceInstanceId: "spec-b", atomId: "atom.one" };
    expect(togglePick([pickA], differentSource, 2)).toEqual([pickA, differentSource]);
  });
});

describe("picksSoulsCost / costWithPicks", () => {
  const pickable: PickableAtom[] = [
    { sourceInstanceId: "spec-a", sourceSpeciesId: "peashooter", atomId: "atom.one", costSouls: 150 },
    { sourceInstanceId: "spec-a", sourceSpeciesId: "peashooter", atomId: "atom.two", costSouls: 220 }
  ];

  it("sums only the selected picks' own priced cost", () => {
    expect(picksSoulsCost([{ sourceInstanceId: "spec-a", atomId: "atom.one" }], pickable)).toBe(150);
    expect(
      picksSoulsCost(
        [
          { sourceInstanceId: "spec-a", atomId: "atom.one" },
          { sourceInstanceId: "spec-a", atomId: "atom.two" }
        ],
        pickable
      )
    ).toBe(370);
  });

  it("a pick with no matching priced entry contributes zero, never NaN", () => {
    expect(picksSoulsCost([{ sourceInstanceId: "spec-x", atomId: "atom.ghost" }], pickable)).toBe(0);
  });

  it("adds picks' souls on top of the base cost, leaving shards/essence untouched", () => {
    const result = costWithPicks(
      cost,
      [{ sourceInstanceId: "spec-a", atomId: "atom.one" }],
      pickable
    );
    expect(result).toEqual({ ...cost, souls: cost.souls + 150 });
  });

  it("zero picks reproduces the base cost exactly", () => {
    expect(costWithPicks(cost, [], pickable)).toEqual(cost);
  });
});

describe("recipeLabel silhouettes", () => {
  const name = (id: string) => ({ a: "Alpha", b: "Beta", out: "Omega" }[id] ?? id);

  it("discovered recipes show their identity", () => {
    expect(recipeLabel({ discovered: true, resultSpeciesId: "out", inputs: ["a", "b"] }, name))
      .toEqual({ title: "Omega", subtitle: "Alpha + Beta" });
  });

  it("undiscovered recipes stay ??? with optional ingredient hints", () => {
    expect(recipeLabel({ discovered: false, inputs: ["a", "b"] }, name))
      .toEqual({ title: "???", subtitle: "Alpha + Beta …?" });
    expect(recipeLabel({ discovered: false, inputs: null }, name))
      .toEqual({ title: "???", subtitle: "Undiscovered" });
  });
});
