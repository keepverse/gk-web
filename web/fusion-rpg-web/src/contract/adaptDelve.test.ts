import { describe, expect, it } from "vitest";
import {
  adaptDelve,
  adaptDelveMember,
  adaptDelveParty,
  adaptDelveQuest,
  adaptDelveRoom,
  adaptDomainOffer,
  adaptExtraction,
  adaptPack,
  adaptRoomObject,
  adaptSupply,
  adaptTalk
} from "./adapt";
import { findEmptyPendingReasons } from "./contractGuard";

/**
 * party-dungeon D5.3 — hand-built fixtures, not a golden JSON file. No `DelveFixtureTests.cs`-style
 * byte-pinned fixture exists for delve yet (unlike `adaptWorld.test.ts`'s own `first-light.json`) —
 * spec-delve-stage.md §19 point 6 confirms nothing delve-shaped exists anywhere in the web tree before
 * this task. Every fixture below mirrors the real C# shape read directly off the shipped code
 * (`DelveEndpoints.cs`'s `HandleGetDelve`, `DelveProjection.cs`, `PackDto.cs`, `QuestDto.cs`,
 * `DomainOfferDto.cs`), cited per fixture.
 */

describe("adaptDelveRoom — SectorSight raw-int translation (DelveProjection.cs never .ToString()'s it)", () => {
  it("sight 0/1/2 map to None/Glimpse/Full, the C# enum's own member names verbatim", () => {
    const base = {
      sectorId: "s-1",
      rowIndex: 0,
      colIndex: 0,
      visited: true,
      cleared: false,
      keyForLaneId: null,
      kind: "fight",
      archetypeId: "a-1",
      eventId: null,
      resolvedKind: "fight",
      resolvedArchetypeId: "a-1",
      floorJson: null
    };
    expect(adaptDelveRoom({ ...base, sight: 0 }).sight).toBe("None");
    expect(adaptDelveRoom({ ...base, sight: 1 }).sight).toBe("Glimpse");
    expect(adaptDelveRoom({ ...base, sight: 2 }).sight).toBe("Full");
  });

  it("an unrecognised ordinal shows less, never more (defensive fog rule, matches toIntelState)", () => {
    const view = adaptDelveRoom({
      sectorId: "s-1",
      rowIndex: 0,
      colIndex: 0,
      visited: false,
      cleared: false,
      keyForLaneId: null,
      sight: 99,
      kind: "fight",
      archetypeId: "a-1",
      eventId: null,
      resolvedKind: "fight",
      resolvedArchetypeId: "a-1",
      floorJson: null
    });
    expect(view.sight).toBe("None");
  });

  it("floorContents is absent (not pending) when floorJson is null — the ambiguous, honest reading", () => {
    const view = adaptDelveRoom({
      sectorId: "s-1",
      rowIndex: 0,
      colIndex: 0,
      visited: true,
      cleared: false,
      keyForLaneId: null,
      sight: 2,
      kind: "fight",
      archetypeId: "a-1",
      eventId: null,
      resolvedKind: "fight",
      resolvedArchetypeId: "a-1",
      floorJson: null
    });
    expect(view.floorContents).toEqual({ state: "absent" });
  });

  it("floorContents is pending (real, unmodelled content) when floorJson is a non-null blob", () => {
    const view = adaptDelveRoom({
      sectorId: "s-1",
      rowIndex: 0,
      colIndex: 0,
      visited: true,
      cleared: false,
      keyForLaneId: null,
      sight: 2,
      kind: "fight",
      archetypeId: "a-1",
      eventId: null,
      resolvedKind: "fight",
      resolvedArchetypeId: "a-1",
      floorJson: "[]"
    });
    expect(view.floorContents.state).toBe("pending");
  });
});

describe("adaptDelve — party/position join by entityId, never by array index", () => {
  it("joins delve.Parties[i] to its live position even when projection.Parties is sorted differently", () => {
    // DelveProjection.cs's own `parties` list is .OrderBy(p => p.EntityId) — deliberately out of
    // delve.Parties' own array order here (entity 30 first, entity 10 second), to prove the join is
    // by id, not position. A naive index-zip would swap these two parties' positions.
    const dto = {
      delveId: 1,
      worldId: "w-1",
      state: "Active",
      domainId: "d-1",
      raidMode: "pair",
      rungId: "r-1",
      soulsUnbanked: 500,
      rooms: [],
      doors: [],
      revision: 3,
      partyPositions: [
        { entityId: 30, atSectorId: "s-far", onLaneId: null },
        { entityId: 10, atSectorId: "s-near", onLaneId: null }
      ],
      parties: [
        { entityId: 10, route: [], haul: [], members: null, pack: null },
        { entityId: 30, route: [], haul: [], members: null, pack: null }
      ]
    };

    const view = adaptDelve(dto);
    expect(view.parties[0]?.entityId).toBe(10);
    expect(view.parties[0]?.atSectorId).toBe("s-near");
    expect(view.parties[0]?.partyIndex).toBe(0);
    expect(view.parties[1]?.entityId).toBe(30);
    expect(view.parties[1]?.atSectorId).toBe("s-far");
    expect(view.parties[1]?.partyIndex).toBe(1);
  });

  it("a party with no matching live position gets null/null, not a throw (D5.2's own named gap)", () => {
    const dto = {
      delveId: 1,
      worldId: "w-1",
      state: "Active",
      domainId: "d-1",
      raidMode: "solo",
      rungId: "r-1",
      soulsUnbanked: 0,
      rooms: [],
      doors: [],
      revision: 0,
      partyPositions: [],
      parties: [{ entityId: 99, route: [], haul: [], members: null, pack: null }]
    };
    const view = adaptDelve(dto);
    expect(view.parties[0]?.atSectorId).toBeNull();
    expect(view.parties[0]?.onLaneId).toBeNull();
  });

  it("soulsUnbanked wraps as a count Magnitude with no exact — HandleGetDelve sends no decimal-string companion today", () => {
    const dto = {
      delveId: 1,
      worldId: "w-1",
      state: "Active",
      domainId: "d-1",
      raidMode: "solo",
      rungId: "r-1",
      soulsUnbanked: 12345,
      rooms: [],
      doors: [],
      revision: 0,
      partyPositions: [],
      parties: []
    };
    const view = adaptDelve(dto);
    expect(view.soulsUnbanked).toEqual({ unit: "count", value: 12345 });
    expect(view.soulsUnbanked.exact).toBeUndefined();
  });

  it("never surfaces thetaRun, even though HandleGetDelve's own live response sends it (spec §8 vs shipped D5.2 contradiction, named)", () => {
    const dto = {
      delveId: 1,
      worldId: "w-1",
      state: "Active",
      domainId: "d-1",
      raidMode: "solo",
      rungId: "r-1",
      soulsUnbanked: 0,
      // A real server payload also carries `thetaRun` (DelveEndpoints.cs:151) — included here to
      // prove the extra wire field is silently ignored, not merely absent from the fixture.
      thetaRun: 42,
      rooms: [],
      doors: [],
      revision: 0,
      partyPositions: [],
      parties: []
    };
    const view = adaptDelve(dto as never);
    expect(view).not.toHaveProperty("thetaRun");
  });

  it("adapts a full delve fixture with no throw and no empty pending reasons", () => {
    const dto = {
      delveId: 7,
      worldId: "w-7",
      state: "Active",
      domainId: "d-7",
      raidMode: "quad",
      rungId: "r-3",
      soulsUnbanked: 900,
      rooms: [
        {
          sectorId: "s-1",
          rowIndex: 0,
          colIndex: 0,
          visited: true,
          cleared: true,
          keyForLaneId: null,
          sight: 2,
          kind: "fight",
          archetypeId: "a-1",
          eventId: null,
          resolvedKind: "fight",
          resolvedArchetypeId: "a-1",
          floorJson: null
        }
      ],
      doors: [
        { laneId: "l-1", fromSectorId: "s-1", toSectorId: "s-2", typeId: "corridor", gateKeyId: null, state: 0 }
      ],
      revision: 5,
      partyPositions: [{ entityId: 1, atSectorId: "s-1", onLaneId: null }],
      parties: [
        {
          entityId: 1,
          route: ["s-0", "s-1"],
          haul: [{ kind: "pull", speciesId: "sunflower", rarity: "chaff", variant: "v1", traitIds: [], row: 0, col: 0, n: 1 }],
          members: [{ instanceId: "m-1", pools: { hp: 100, stamina: 50 }, nerveStacks: 1, downed: false, downedOnce: false }],
          pack: { rows: 4, cols: 4, cells: [] }
        }
      ]
    };
    expect(() => adaptDelve(dto)).not.toThrow();
    const view = adaptDelve(dto);
    expect(findEmptyPendingReasons(view)).toEqual([]);
    expect(view.doors[0]?.state).toBe("Open");
    expect(view.parties[0]?.haul).toHaveLength(1);
    expect(view.parties[0]?.members[0]?.pools.hp).toEqual({ unit: "count", value: 100 });
  });
});

describe("adaptDelveMember", () => {
  it("wraps every pool as a count Magnitude, keyed by resource id, straight off DelveMemberState.Pools", () => {
    const view = adaptDelveMember({
      instanceId: "m-1",
      pools: { hp: 100, stamina: 40, hunger: 60, spirit: 10, qi: 0, poise: 5 },
      nerveStacks: 2,
      downed: false,
      downedOnce: true
    });
    expect(view.pools).toEqual({
      hp: { unit: "count", value: 100 },
      stamina: { unit: "count", value: 40 },
      hunger: { unit: "count", value: 60 },
      spirit: { unit: "count", value: 10 },
      qi: { unit: "count", value: 0 },
      poise: { unit: "count", value: 5 }
    });
    expect(view.nerveStacks).toBe(2);
    expect(view.downedOnce).toBe(true);
    expect(view.poolMax.state).toBe("pending");
    expect(view.nerveStage.state).toBe("pending");
  });
});

describe("adaptDelveParty", () => {
  it("never reads state.pack — it stays pending even when the raw wire pack is present", () => {
    const view = adaptDelveParty(
      { entityId: 5, route: [], haul: [], members: null, pack: { rows: 4, cols: 4, cells: [{ row: 0, col: 0 }] } },
      2,
      undefined
    );
    expect(view.partyIndex).toBe(2);
    expect(view.pack).toEqual({ state: "pending", reason: expect.any(String) });
    expect(view.members).toEqual([]); // null Members -> empty array, never a throw
  });
});

describe("adaptPack — the real PackDto shape, Origin PascalCase-to-camelCase translation", () => {
  it("translates PackItemOrigin.ToString()'s PascalCase wire values to the view's lower-camel union", () => {
    const view = adaptPack({
      rows: 4,
      cols: 4,
      provisionCellsLeft: 2,
      cells: [
        { row: 0, col: 0, w: 1, h: 1, kind: "consumable", refId: "c-1", qty: 3, origin: "CarryIn", movable: true },
        { row: 1, col: 0, w: 1, h: 1, kind: "loot", refId: "l-1", qty: 1, origin: "Haul", movable: false }
      ],
      floor: []
    });
    expect(view.cells[0]?.origin).toBe("carryIn");
    expect(view.cells[0]?.movable).toBe(true);
    expect(view.cells[0]?.qty).toEqual({ unit: "count", value: 3 });
    expect(view.cells[1]?.origin).toBe("haul");
    expect(view.cells[1]?.movable).toBe(false);
    expect(view.provisionCellsLeft).toEqual({ unit: "count", value: 2 });
  });

  it("an unrecognised origin string falls back to carryIn rather than throwing", () => {
    const view = adaptPack({
      rows: 1,
      cols: 1,
      provisionCellsLeft: 0,
      cells: [{ row: 0, col: 0, w: 1, h: 1, kind: "x", refId: "x-1", qty: 1, origin: "Unknown", movable: false }],
      floor: []
    });
    expect(view.cells[0]?.origin).toBe("carryIn");
  });
});

describe("adaptTalk — WildVerb ordinals to the enum's own declared member names", () => {
  it("maps 0 and 7 to Flatter and Leave, TalkTree.cs's own declared order", () => {
    const view = adaptTalk([0, 7]);
    expect(view.offered).toEqual(["Flatter", "Leave"]);
    expect(view.effectiveBand.state).toBe("pending");
  });

  it("an out-of-range ordinal falls back to Leave rather than throwing or returning undefined", () => {
    const view = adaptTalk([999]);
    expect(view.offered).toEqual(["Leave"]);
  });
});

describe("adaptRoomObject", () => {
  it("passes real RoomObject fields through unchanged, offered verbs only", () => {
    const view = adaptRoomObject({ sectorId: "s-1", kind: "Curio", verbs: ["open", "pray"], oneShot: true });
    expect(view).toEqual({ sectorId: "s-1", kind: "Curio", verbs: ["open", "pray"], oneShot: true });
  });
});

describe("adaptSupply", () => {
  it("adapts SupplyUseOutcome's real ok/reason/decrementContainerId, decision stays pending", () => {
    const view = adaptSupply({ ok: true, reason: "", decrementContainerId: "c-1" });
    expect(view.ok).toBe(true);
    expect(view.decrementContainerId).toBe("c-1");
    expect(view.decision.state).toBe("pending");
  });

  it("a refusal carries its reason straight through, never rewritten", () => {
    const view = adaptSupply({ ok: false, reason: "supply.exhausted", decrementContainerId: null });
    expect(view.ok).toBe(false);
    expect(view.reason).toBe("supply.exhausted");
  });
});

describe("adaptDelveQuest — the real QuestDto shape", () => {
  it("wraps have/need as count Magnitudes and passes done through", () => {
    const view = adaptDelveQuest({ name: "Clear the fen", flavor: "flavor text", have: 2, need: 5, done: false });
    expect(view).toEqual({
      name: "Clear the fen",
      flavor: "flavor text",
      have: { unit: "count", value: 2 },
      need: { unit: "count", value: 5 },
      done: false
    });
  });
});

describe("adaptExtraction — composes two independently-real producers, positional-joined by caller-supplied id", () => {
  it("joins a settlement to its member id and keeps kills/victory as two separate figures", () => {
    const view = adaptExtraction(
      [
        { instanceId: "m-1", settlement: { outcome: "Roster", recoverDelves: 0, won: true } },
        { instanceId: "m-2", settlement: { outcome: "Recover", recoverDelves: 2, won: true } }
      ],
      { kills: 30, victory: 100 }
    );
    expect(view.members).toEqual([
      { instanceId: "m-1", outcome: "Roster", recoverDelves: { unit: "count", value: 0 }, won: true },
      { instanceId: "m-2", outcome: "Recover", recoverDelves: { unit: "count", value: 2 }, won: true }
    ]);
    expect(view.soulsFromKills).toEqual({ unit: "count", value: 30 });
    expect(view.soulsFromVictory).toEqual({ unit: "count", value: 100 });
    // Never pre-summed in the client (§16's own "never" list) — both figures stay separate and exact.
    expect(view).not.toHaveProperty("soulsTotal");
  });
});

describe("adaptDomainOffer — the real DomainOfferDto shape, rungs/tailSteps as one discriminated RungOfferView", () => {
  it("maps rungs and tail steps into the shared kind-discriminated type without cross-contaminating fields", () => {
    const view = adaptDomainOffer({
      domainId: "d-1",
      name: "The Fen",
      flavor: "A wet place.",
      climate: "wet",
      entranceLabel: "Very hard",
      entryKey: "single-descent",
      sealed: false,
      resume: { delveId: 9 },
      rungs: [{ rungId: "r-1", label: "Rung One", bandName: "Deep", oathOffered: true, permadeath: false }],
      tailSteps: [{ n: 1, label: "Beyond the abyss", bandName: "Abyssal" }],
      raidModes: ["solo", "pair"],
      bossName: "The Sunken King",
      cleared: ["r-0"],
      provisionable: [{ containerId: "c-1", label: "Ration", price: 10, cells: 1 }]
    });

    expect(view.entryKey).toBe("single-descent");
    expect(view.resume).toEqual({ delveId: 9 });
    expect(view.rungs[0]).toEqual({
      kind: "rung",
      rungId: "r-1",
      label: "Rung One",
      bandName: "Deep",
      oathOffered: true,
      permadeath: false
    });
    expect(view.tailSteps[0]).toEqual({
      kind: "tail",
      n: { unit: "count", value: 1 },
      label: "Beyond the abyss",
      bandName: "Abyssal"
    });
    expect(view.provisionable[0]).toEqual({
      containerId: "c-1",
      label: "Ration",
      price: { unit: "count", value: 10 },
      cells: { unit: "count", value: 1 }
    });
  });

  it("an unrecognised entryKey falls back to the permissive 'standing' reading, never throws", () => {
    const view = adaptDomainOffer({
      domainId: "d-1",
      name: "n",
      flavor: "f",
      climate: "c",
      entranceLabel: "l",
      entryKey: "some-future-value",
      sealed: false,
      resume: null,
      rungs: [],
      tailSteps: [],
      raidModes: [],
      bossName: "b",
      cleared: [],
      provisionable: []
    });
    expect(view.entryKey).toBe("standing");
  });

  it("resume is null when the wire sends null, not fabricated", () => {
    const view = adaptDomainOffer({
      domainId: "d-1",
      name: "n",
      flavor: "f",
      climate: "c",
      entranceLabel: "l",
      entryKey: "standing",
      sealed: true,
      resume: null,
      rungs: [],
      tailSteps: [],
      raidModes: [],
      bossName: "b",
      cleared: [],
      provisionable: []
    });
    expect(view.resume).toBeNull();
    expect(view.sealed).toBe(true);
  });
});
