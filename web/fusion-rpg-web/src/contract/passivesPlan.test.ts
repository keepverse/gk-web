import { describe, expect, it } from "vitest";
import {
  closePreview,
  closePreviewSentence,
  decodePlanCode,
  encodePlanCode,
  mergeSoulLevels,
  planNewNodeIds,
  planPrice,
  priceOfNth,
  tierAttribution,
  unlockCumulative
} from "./passivesPlan";

describe("passivesPlan — GG-8 URL codec", () => {
  it("round-trips a plan through encode/decode", () => {
    const plan = { "skill.might-off-t1-n0": 0, "skill.might-off-t2-n1": 6 };
    expect(decodePlanCode(encodePlanCode(plan))).toEqual(plan);
  });

  it("an empty plan encodes to an empty string and decodes back to an empty plan", () => {
    expect(encodePlanCode({})).toBe("");
    expect(decodePlanCode("")).toEqual({});
  });

  it("never throws on garbage input -- drops what it can't parse, keeps the rest", () => {
    expect(() => decodePlanCode("not-a-plan-code")).not.toThrow();
    expect(decodePlanCode("not-a-plan-code")).toEqual({});
    expect(decodePlanCode("a=1&garbage&b=2")).toEqual({ a: 1, b: 2 });
    expect(decodePlanCode("a=-5&b=3")).toEqual({ b: 3 }); // a negative soul level is dropped, not clamped
    expect(decodePlanCode("=5&c=1")).toEqual({ c: 1 }); // empty node id dropped
    expect(decodePlanCode("a=not-a-number&b=2")).toEqual({ b: 2 });
  });

  it("survives node ids that need URI-encoding (structural ids can carry dots/dashes)", () => {
    const plan = { "skill.ashen-root-t3-n1": 2 };
    expect(decodePlanCode(encodePlanCode(plan))).toEqual(plan);
  });

  // Test 19 (spec-tree-surface.md §14): "A_plan_names_which_and_how_many_never_a_price" -- the share
  // code carries no cost field. Proven structurally: the codec only ever emits `nodeId=soulLevel`
  // pairs, so a price computed by `planPrice` cannot appear in the encoded string at all.
  it("test 19 — the encoded code carries no price field, structurally", () => {
    const plan = { "skill.might-off-t1-n0": 0 };
    const price = planPrice({}, plan, { firstPoints: 5, stepPoints: 1 });
    const code = encodePlanCode(plan);
    expect(code).not.toContain(String(price.skillPoints));
    expect(code.split("&").every((pair) => pair.split("=").length === 2)).toBe(true);
  });
});

describe("passivesPlan — mergeSoulLevels", () => {
  it("layers the plan's own edits over the server's committed values", () => {
    const server = { a: 3, b: 0 };
    const plan = { b: 2, c: 0 };
    expect(mergeSoulLevels(server, plan)).toEqual({ a: 3, b: 2, c: 0 });
  });
});

describe("passivesPlan — planNewNodeIds", () => {
  it("names only ids absent from the server's owned set -- a depth change on an owned node is not new", () => {
    const server = { a: 3 };
    const plan = { a: 9, b: 0 };
    expect(planNewNodeIds(server, plan)).toEqual(["b"]);
  });
});

describe("passivesPlan — unlockCumulative mirrors TreeUnlockCost.Cumulative", () => {
  it("count*first + step*count*(count-1)/2", () => {
    // first=5, step=1: owning 3 nodes costs 5 + 6 + 7 = 18.
    expect(unlockCumulative(3, { firstPoints: 5, stepPoints: 1 })).toBe(18);
    expect(unlockCumulative(0, { firstPoints: 5, stepPoints: 1 })).toBe(0);
  });

  it("rejects a negative count", () => {
    expect(() => unlockCumulative(-1, { firstPoints: 5, stepPoints: 1 })).toThrow();
  });
});

describe("passivesPlan — priceOfNth: every available cell quotes the same 'unlock now' price", () => {
  it("depends only on the ordinal, never on which node", () => {
    const rates = { firstPoints: 5, stepPoints: 2 };
    expect(priceOfNth(1, rates)).toBe(5);
    expect(priceOfNth(4, rates)).toBe(11); // 5 + 3*2
  });

  it("sums to the same cumulative total priceOfNth builds toward", () => {
    const rates = { firstPoints: 5, stepPoints: 2 };
    let sum = 0;
    for (let n = 1; n <= 5; n++) sum += priceOfNth(n, rates);
    expect(sum).toBe(unlockCumulative(5, rates));
  });
});

describe("passivesPlan — planPrice: three numbers, order-independent (§5.2, verification 'tests 18-19')", () => {
  const rates = { firstPoints: 5, stepPoints: 2 };

  it("renders newTraits/skillPoints/souls -- never a single node's price in isolation", () => {
    const server = { a: 0, b: 0 }; // 2 already owned
    const plan = { ...server, c: 0, d: 0, e: 0 }; // +3 new
    const price = planPrice(server, plan, rates);
    expect(price.newTraits).toBe(3);
    // Cumulative(5) - Cumulative(2): (5*5+2*5*4/2) - (2*5+2*2*1/2) = (25+20) - (10+2) = 45-12 = 33.
    expect(price.skillPoints).toBe(33);
    expect(price.souls).toBe(0); // disclosed gap: no soul-depth price exists in Core yet
  });

  it("test 18 — the SAME plan code prices differently against two different actors' own state", () => {
    const plan = { x: 0, y: 0, z: 0 };
    const freshActor = {}; // owns nothing yet
    const deepActor = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`owned-${i}`, 0])); // owns 20 already

    const freshPrice = planPrice(freshActor, plan, rates);
    const deepPrice = planPrice(deepActor, plan, rates);

    expect(freshPrice.newTraits).toBe(deepPrice.newTraits); // same "which and how many"
    expect(freshPrice.skillPoints).not.toBe(deepPrice.skillPoints); // different price, same code
    expect(deepPrice.skillPoints).toBeGreaterThan(freshPrice.skillPoints); // D25: rises with owned count
  });

  // The delegator's own explicit ask: a REAL property-style test proving order-independence by
  // simulating two different insertion orders of the same final plan and checking the three totals
  // match -- not just trusting that a pure function of the final key set can't help but agree with
  // itself.
  it("two orderings of the same plan price identically", () => {
    const server = { existing1: 0, existing2: 0 }; // 2 already owned
    const newIds = ["fireA", "fireB", "fireC", "fireD"];

    function priceByAddingInOrder(order: string[]) {
      let draft: Record<string, number> = { ...server };
      let totalSkillPoints = 0;
      for (const id of order) {
        const before = planPrice(server, draft, rates);
        draft = { ...draft, [id]: 0 };
        const after = planPrice(server, draft, rates);
        totalSkillPoints += after.skillPoints - before.skillPoints; // this one node's own marginal price
      }
      return { totalSkillPoints, finalPlan: draft };
    }

    const forward = priceByAddingInOrder(newIds);
    const shuffled = priceByAddingInOrder([...newIds].reverse());
    const anotherShuffle = priceByAddingInOrder(["fireC", "fireA", "fireD", "fireB"]);

    // Same total however the SAME set of new nodes was assembled, one at a time, in any order.
    expect(shuffled.totalSkillPoints).toBe(forward.totalSkillPoints);
    expect(anotherShuffle.totalSkillPoints).toBe(forward.totalSkillPoints);

    // And it matches the bulk formula computed directly off the final set -- the incremental sum and
    // the direct Cumulative-diff are the SAME number, proving the "sum has no order term" lemma.
    const bulk = planPrice(server, forward.finalPlan, rates);
    expect(forward.totalSkillPoints).toBe(bulk.skillPoints);

    // newTraits and souls are trivially order-independent too (souls is always 0 today; newTraits is a
    // pure count of the final key set) -- asserted explicitly since §5.2 promises ALL of "the three
    // numbers," not skill points alone.
    const forwardFinal = planPrice(server, forward.finalPlan, rates);
    const shuffledFinal = planPrice(server, { ...server, ...Object.fromEntries(newIds.map((id) => [id, 0])) }, rates);
    expect(forwardFinal.newTraits).toBe(shuffledFinal.newTraits);
    expect(forwardFinal.souls).toBe(shuffledFinal.souls);
  });
});

describe("passivesPlan — tierAttribution: exactly one lender, always singular (§7.2 part 3)", () => {
  it("returns null when the report carries no real split yet (pre-I8 fixture)", () => {
    expect(tierAttribution({ aptitudePoints: 175, lenderTreeId: "might", ownAptitudePoints: undefined })).toBeNull();
  });

  it("no lender: own equals the whole total, lentAmount is 0", () => {
    expect(tierAttribution({ aptitudePoints: 55, lenderTreeId: null, ownAptitudePoints: 55 })).toEqual({
      own: 55,
      lentAmount: 0,
      lenderTreeId: null
    });
  });

  it("with a lender: own and lentAmount split exactly, never a sum of multiple lenders", () => {
    expect(tierAttribution({ aptitudePoints: 175, lenderTreeId: "might", ownAptitudePoints: 55 })).toEqual({
      own: 55,
      lentAmount: 120,
      lenderTreeId: "might"
    });
  });
});

describe("passivesPlan — closePreview / closePreviewSentence (§7.2 part 5)", () => {
  it("nothing changes: no closing, no opening, no stopped traits", () => {
    const committed = [{ treeId: "might", tierReached: 3, contributingNodeIds: ["skill.might-off-t1-n0"] }];
    const preview = [{ treeId: "might", tierReached: 3, invalidNodeIds: [] }];
    const result = closePreview(committed, preview);
    expect(result).toEqual({ closingTreeIds: [], openingTreeIds: [], traitsThatWouldStopWorking: 0 });
    expect(closePreviewSentence(result)).toBeNull();
  });

  // D28's own worked example shape (§7.2 part 5): "Moving 30 points out of Might closes tier 8 in
  // Fortitude, Vigor and Onslaught -- 4 of your traits would stop working." Proven here as a pure diff
  // of two already-resolved report arrays, never a re-derivation of CrossUnlock/TierGate.
  it("a tier closing in a stance-mate, with owned traits newly invalid, names both", () => {
    const committed = [
      { treeId: "might", tierReached: 8, contributingNodeIds: [] },
      {
        treeId: "fortitude",
        tierReached: 8,
        contributingNodeIds: ["skill.fortitude-off-t7-n0", "skill.fortitude-off-t8-n0"]
      },
      { treeId: "vigor", tierReached: 8, contributingNodeIds: ["skill.vigor-off-t8-n0"] }
    ];
    const preview = [
      { treeId: "might", tierReached: 5, invalidNodeIds: [] },
      { treeId: "fortitude", tierReached: 6, invalidNodeIds: ["skill.fortitude-off-t7-n0", "skill.fortitude-off-t8-n0"] },
      { treeId: "vigor", tierReached: 6, invalidNodeIds: ["skill.vigor-off-t8-n0"] }
    ];

    const result = closePreview(committed, preview);
    expect(result.closingTreeIds).toEqual(["might", "fortitude", "vigor"]);
    expect(result.openingTreeIds).toEqual([]);
    expect(result.traitsThatWouldStopWorking).toBe(3);
    expect(closePreviewSentence(result)).toBe(
      "Closes a tier in might, fortitude, vigor — 3 of your traits would stop working."
    );
  });

  it("'traits' stays plural even at a count of one -- no noun/verb to conjugate, matching NotWorkingCount's own convention", () => {
    const committed = [{ treeId: "might", tierReached: 3, contributingNodeIds: ["skill.might-off-t1-n0"] }];
    const preview = [{ treeId: "might", tierReached: 2, invalidNodeIds: ["skill.might-off-t1-n0"] }];
    const result = closePreview(committed, preview);
    expect(result.traitsThatWouldStopWorking).toBe(1);
    expect(closePreviewSentence(result)).toBe("Closes a tier in might — 1 of your traits would stop working.");
  });

  it("closing with nothing owned yet in the affected tree: no trait count, still names the close", () => {
    const committed = [{ treeId: "might", tierReached: 3, contributingNodeIds: [] }];
    const preview = [{ treeId: "might", tierReached: 2, invalidNodeIds: [] }];
    const result = closePreview(committed, preview);
    expect(result.traitsThatWouldStopWorking).toBe(0);
    expect(closePreviewSentence(result)).toBe("Closes a tier in might.");
  });

  it("opening is the symmetric positive case, and only renders when nothing closes", () => {
    const committed = [{ treeId: "onslaught", tierReached: 2, contributingNodeIds: [] }];
    const preview = [{ treeId: "onslaught", tierReached: 3, invalidNodeIds: [] }];
    const result = closePreview(committed, preview);
    expect(result.openingTreeIds).toEqual(["onslaught"]);
    expect(result.closingTreeIds).toEqual([]);
    expect(closePreviewSentence(result)).toBe("Opens a tier in onslaught.");
  });

  it("closing outranks opening as the highest-value line when both happen at once", () => {
    const result = closePreview(
      [
        { treeId: "might", tierReached: 8, contributingNodeIds: [] },
        { treeId: "onslaught", tierReached: 2, contributingNodeIds: [] }
      ],
      [
        { treeId: "might", tierReached: 5, invalidNodeIds: [] },
        { treeId: "onslaught", tierReached: 3, invalidNodeIds: [] }
      ]
    );
    expect(closePreviewSentence(result)).toBe("Closes a tier in might.");
  });

  it("a tree present in only one array is skipped, never treated as a change", () => {
    const result = closePreview(
      [{ treeId: "might", tierReached: 3, contributingNodeIds: [] }],
      [{ treeId: "fortitude", tierReached: 3, invalidNodeIds: [] }]
    );
    expect(result).toEqual({ closingTreeIds: [], openingTreeIds: [], traitsThatWouldStopWorking: 0 });
  });

  it("never counts a node that was already not contributing as newly stopped", () => {
    // `invalidAfter` names a node the BEFORE report never listed as contributing (e.g. it was already
    // excluded) -- that node must not inflate the stopped-working count.
    const result = closePreview(
      [{ treeId: "might", tierReached: 8, contributingNodeIds: ["skill.might-off-t1-n0"] }],
      [{ treeId: "might", tierReached: 5, invalidNodeIds: ["skill.might-off-t9-n0"] }]
    );
    expect(result.traitsThatWouldStopWorking).toBe(0);
  });
});
