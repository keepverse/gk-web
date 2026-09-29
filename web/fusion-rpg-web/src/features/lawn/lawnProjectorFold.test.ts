import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "@/lib/bus/types";
import {
  foldLawnEvents,
  foldLawnFromRing,
  selectionStillValid
} from "./lawnProjectorFold";
import {
  cellKey,
  findMarker,
  findOccupant,
  findTile,
  listOccupants,
  listTiles,
  tilesAt
} from "./lawnViewModel";

function evt(kind: string, payload?: unknown, matchKey?: string, id?: number): EventEnvelope {
  return { t: "2026-01-01T00:00:00Z", game: "test", kind, matchKey, payload, id };
}

describe("lawnProjectorFold", () => {
  it("ignores place as living membership", () => {
    const model = foldLawnEvents([
      evt("board.start", { levelName: "x" }, "m1"),
      evt("plant.place", { ptr: "ABC", type: 1, row: 2, col: 3 })
    ]);
    expect(listOccupants(model)).toHaveLength(0);
    expect(model.phase).toBe("Starting");
  });

  it("spawn creates living; die removes; selection clears", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("plant.spawn", {
        ptr: "AA01",
        type: 3,
        typeName: "Pea",
        row: 1,
        col: 2,
        hp: 100,
        maxHp: 100
      }),
      evt("zombie.spawn", { ptr: "BB02", type: 0, typeName: "Z", row: 1 })
    ]);
    expect(listOccupants(model)).toHaveLength(2);
    expect(model.cells.get(cellKey(1, 2))?.[0]?.typeId).toBe(3);
    expect(model.orphans.some((o) => o.ptr === "BB02")).toBe(true);
    expect(selectionStillValid(model, "AA01")).toBe(true);

    const afterDie = foldLawnEvents([evt("plant.die", { ptr: "AA01" })], model);
    expect(findOccupant(afterDie, "AA01")).toBeUndefined();
    expect(selectionStillValid(afterDie, "AA01")).toBe(false);
    expect(listOccupants(afterDie)).toHaveLength(1);
  });

  it("place after spawn can hint cell without creating extra living", () => {
    const model = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z1", type: 2 }),
      evt("zombie.place", { ptr: "Z1", row: 4, col: 8 })
    ]);
    expect(listOccupants(model)).toHaveLength(1);
    expect(findOccupant(model, "Z1")?.row).toBe(4);
    expect(findOccupant(model, "Z1")?.col).toBe(8);
  });

  it("hypno sets flag and keeps zombie side; clear removes chip", () => {
    const model = foldLawnEvents([
      evt("zombie.spawn", { ptr: "H1", type: 5, row: 0 }),
      evt("zombie.hypno", { ptr: "H1", isMindControlled: true })
    ]);
    const z = findOccupant(model, "H1");
    expect(z?.side).toBe("zombie");
    expect(z?.flags.hypnotized).toBe(true);
    expect(z?.statusChips).toContain("hypno");

    const cleared = foldLawnEvents(
      [evt("zombie.hypno", { ptr: "H1", isMindControlled: false })],
      model
    );
    expect(findOccupant(cleared, "H1")?.flags.hypnotized).toBe(false);
    expect(findOccupant(cleared, "H1")?.statusChips).not.toContain("hypno");
  });

  it("debug.board-stats replaces membership (Snapshot wins)", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "OLD", type: 1, row: 0, col: 0 })
    ]);
    const model = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [{ ptr: "NEW", typeId: 9, row: 2, col: 4, hp: 50, maxHp: 50 }],
          zombies: []
        })
      ],
      seeded
    );
    expect(findOccupant(model, "OLD")).toBeUndefined();
    expect(findOccupant(model, "NEW")?.typeId).toBe(9);
  });

  it("debug.snapshot overlays Bound instanceId without wiping living; no revision rewind", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "ABCD", type: 1, row: 0, col: 1 })
    ]);
    const beforeRev = seeded.revision;
    const model = foldLawnEvents(
      [
        evt("debug.snapshot", {
          match: {
            phase: "InMatch",
            revision: 1,
            matchKey: "mk",
            bindings: [{ instanceId: "u-1", ptr: "ABCD", phase: "Bound" }]
          }
        })
      ],
      seeded
    );
    expect(model.phase).toBe("InMatch");
    expect(model.revision).toBe(beforeRev + 1);
    expect(model.revision).not.toBe(1);
    expect(findOccupant(model, "ABCD")?.instanceId).toBe("u-1");
  });

  it("authoritative empty binding snapshots clear stale bindings", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1", 1),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, "m1", 2),
      evt(
        "debug.snapshot",
        { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } },
        "m1",
        3
      )
    ]);
    expect(findOccupant(seeded, "P1")?.instanceId).toBe("u-1");

    const recovered = foldLawnEvents(
      [evt("debug.snapshot", { match: { phase: "InMatch", matchKey: "m1", bindings: [] } }, "m1", 4)],
      seeded
    );
    expect(findOccupant(recovered, "P1")?.instanceId).toBeUndefined();
  });

  it("converges when a binding arrives before its spawn", () => {
    const bound = foldLawnEvents([
      evt("board.start", {}, "m1", 1),
      evt(
        "debug.snapshot",
        { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } },
        "m1",
        2
      )
    ]);
    const spawned = foldLawnEvents(
      [evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, "m1", 3)],
      bound
    );
    expect(findOccupant(spawned, "P1")?.instanceId).toBe("u-1");
  });

  it("converges when a spawn arrives before its binding", () => {
    const spawned = foldLawnEvents([
      evt("board.start", {}, "m1", 1),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, "m1", 2)
    ]);
    const bound = foldLawnEvents(
      [
        evt(
          "debug.snapshot",
          { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } },
          "m1",
          3
        )
      ],
      spawned
    );
    expect(findOccupant(bound, "P1")?.instanceId).toBe("u-1");
  });

  it("rejects a foreign match event instead of changing the visible model", () => {
    const active = foldLawnEvents([
      evt("board.start", {}, "m1", 1),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, "m1", 2)
    ]);
    const isolated = foldLawnEvents(
      [evt("plant.spawn", { ptr: "FOREIGN", type: 9, row: 1, col: 1 }, "m2", 3)],
      active
    );
    expect(findOccupant(isolated, "FOREIGN")).toBeUndefined();
    expect(findOccupant(isolated, "P1")?.typeId).toBe(1);
    expect(isolated.matchKey).toBe("m1");
  });

  it("foldLawnFromRing orders identified events by their event id", () => {
    const ring = [
      evt("debug.snapshot", { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } }, "m1", 3),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, "m1", 2),
      evt("board.start", {}, "m1", 1)
    ];
    const model = foldLawnFromRing(ring);
    expect(findOccupant(model, "P1")?.instanceId).toBe("u-1");
  });

  it("debug.snapshot folds match.commander into the lawn view model", () => {
    const model = foldLawnEvents([
      evt("debug.snapshot", {
        match: {
          phase: "InMatch",
          matchKey: "mk",
          commander: {
            leadingCommanderId: "commander:dave",
            leadingCommanderDisplayName: "Crazy Dave",
            activeAuraId: "Might",
            activeAuraDisplayName: "Might"
          }
        }
      })
    ]);
    expect(model.matchCommander).toEqual({
      id: "commander:dave",
      displayName: "Crazy Dave",
      auraDisplayName: "Might"
    });
  });

  it("debug.snapshot commander with display name only sets null aura and fallback id", () => {
    const model = foldLawnEvents([
      evt("debug.snapshot", {
        match: {
          phase: "InMatch",
          matchKey: "mk",
          commander: {
            leadingCommanderDisplayName: "Crazy Dave",
            activeAuraId: null,
            activeAuraDisplayName: null
          }
        }
      })
    ]);
    expect(model.matchCommander).toEqual({
      id: "commander:dave",
      displayName: "Crazy Dave",
      auraDisplayName: null
    });
  });

  it("debug.snapshot commander with display name only sets null aura", () => {
    const model = foldLawnEvents([
      evt("debug.snapshot", {
        match: {
          phase: "InMatch",
          matchKey: "mk",
          commander: {
            leadingCommanderId: "commander:dave",
            leadingCommanderDisplayName: "Crazy Dave",
            activeAuraId: null,
            activeAuraDisplayName: null
          }
        }
      })
    ]);
    expect(model.matchCommander).toEqual({
      id: "commander:dave",
      displayName: "Crazy Dave",
      auraDisplayName: null
    });
  });

  it("board.end clears matchCommander chips", () => {
    const seeded = foldLawnEvents([
      evt("debug.snapshot", {
        match: {
          phase: "InMatch",
          matchKey: "mk",
          commander: {
            leadingCommanderDisplayName: "Crazy Dave",
            activeAuraDisplayName: "Might"
          }
        }
      }),
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 })
    ]);
    expect(seeded.matchCommander?.displayName).toBe("Crazy Dave");
    const ended = foldLawnEvents([evt("board.end", {})], seeded);
    expect(ended.matchCommander).toBeUndefined();
  });

  it("debug.snapshot Ending clears matchCommander chips", () => {
    const seeded = foldLawnEvents([
      evt("debug.snapshot", {
        match: {
          phase: "InMatch",
          matchKey: "mk",
          commander: {
            leadingCommanderDisplayName: "Crazy Dave",
            activeAuraDisplayName: "Might"
          }
        }
      }),
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 })
    ]);
    const ended = foldLawnEvents(
      [evt("debug.snapshot", { match: { phase: "Ending", matchKey: "mk" } })],
      seeded
    );
    expect(ended.phase).toBe("Idle");
    expect(ended.matchCommander).toBeUndefined();
  });

  it("publish bumps revision (replace semantics)", () => {
    const a = foldLawnEvents([evt("board.start", {})]);
    const b = foldLawnEvents([evt("plant.spawn", { ptr: "P", type: 1 })], a);
    expect(b.revision).toBeGreaterThan(a.revision);
  });

  it("foldLawnFromRing reverses newest-first order", () => {
    // Ring newest-first: die, then spawn, then start → chrono start→spawn→die
    const ring = [
      evt("plant.die", { ptr: "P1" }),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }),
      evt("board.start", {}, "m")
    ];
    const model = foldLawnFromRing(ring);
    expect(findOccupant(model, "P1")).toBeUndefined();
    // spawn advances phase to InMatch before die
    expect(model.phase).toBe("InMatch");
  });

  it("board.start clears prior living", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "X", type: 1, row: 0, col: 0 })
    ]);
    const model = foldLawnEvents([evt("board.start", {}, "m2")], seeded);
    expect(listOccupants(model)).toHaveLength(0);
    expect(model.phase).toBe("Starting");
  });

  it("pause / resume / end clears living on Ending", () => {
    let m = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 })
    ]);
    m = foldLawnEvents([evt("match.pause")], m);
    expect(m.phase).toBe("Paused");
    expect(listOccupants(m)).toHaveLength(1);
    m = foldLawnEvents([evt("match.resume")], m);
    expect(m.phase).toBe("InMatch");
    m = foldLawnEvents([evt("board.end", {})], m);
    expect(m.phase).toBe("Idle");
    expect(listOccupants(m)).toHaveLength(0);
  });

  it("entity.stats updates existing only — never creates living", () => {
    const empty = foldLawnEvents([
      evt("entity.stats", { ptr: "GHOST", side: "plant", type: 9, hp: 1 })
    ]);
    expect(listOccupants(empty)).toHaveLength(0);

    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0, hp: 10 })
    ]);
    const updated = foldLawnEvents(
      [evt("entity.stats", { ptr: "P", side: "plant", hp: 7, maxHp: 10 })],
      seeded
    );
    expect(findOccupant(updated, "P")?.hp).toBe(7);
    expect(listOccupants(updated)).toHaveLength(1);
  });

  it("zombie.die via deadPtr; missing ptr is no-op", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z9", type: 0, row: 1 })
    ]);
    expect(foldLawnEvents([evt("zombie.die", {})], seeded).revision).toBe(
      seeded.revision
    );
    const dead = foldLawnEvents([evt("zombie.die", { deadPtr: "Z9" })], seeded);
    expect(findOccupant(dead, "Z9")).toBeUndefined();
  });

  it("board-stats col -1 → orphan; economy folds", () => {
    const model = foldLawnEvents([
      evt("debug.board-stats", {
        plants: [],
        zombies: [{ ptr: "Z", typeId: 2, row: 3, col: -1, hp: 20 }]
      }),
      evt("board.economy", { sun: 150, wave: 2 })
    ]);
    expect(model.orphans.some((o) => o.ptr === "Z")).toBe(true);
    expect(model.economy?.sun).toBe(150);
    expect(model.economy?.wave).toBe(2);
  });

  it("board-stats zombie col >= 0 sits on lawn cell, not orphan", () => {
    const model = foldLawnEvents([
      evt("debug.board-stats", {
        plants: [],
        zombies: [{ ptr: "Z", typeId: 2, row: 3, col: 6, hp: 20 }]
      })
    ]);
    expect(model.orphans.some((o) => o.ptr === "Z")).toBe(false);
    expect(findOccupant(model, "Z")?.row).toBe(3);
    expect(findOccupant(model, "Z")?.col).toBe(6);
  });

  it("zombie.spawn with row/col is living on cell", () => {
    const model = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z1", type: 0, typeName: "Zombie", row: 2, col: 7, hp: 270 })
    ]);
    expect(findOccupant(model, "Z1")?.row).toBe(2);
    expect(findOccupant(model, "Z1")?.col).toBe(7);
    expect(model.orphans.some((o) => o.ptr === "Z1")).toBe(false);
  });

  it("ptr case-normalization for die", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "abcd", type: 1, row: 0, col: 0 })
    ]);
    const dead = foldLawnEvents([evt("plant.die", { ptr: "ABCD" })], seeded);
    expect(findOccupant(dead, "abcd")).toBeUndefined();
  });

  it("no-op hypno does not bump revision", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "H", type: 1 }),
      evt("zombie.hypno", { ptr: "MISSING", isMindControlled: true })
    ]);
    const afterSpawn = foldLawnEvents([
      evt("zombie.spawn", { ptr: "H", type: 1 })
    ]);
    expect(seeded.revision).toBe(afterSpawn.revision);
  });

  it("spawn copies atk and zombie armor; plant shield → armor; no defensePercent", () => {
    const model = foldLawnEvents([
      evt("plant.spawn", {
        ptr: "P1",
        type: 1,
        row: 0,
        col: 0,
        hp: 100,
        maxHp: 100,
        attack: 20,
        theShieldHealth: 40,
        defensePercent: 99
      }),
      evt("zombie.spawn", {
        ptr: "Z1",
        type: 0,
        row: 1,
        attackDamage: 15,
        armor: 50,
        armorMax: 80,
        defensePercent: 77
      })
    ]);
    const plant = findOccupant(model, "P1");
    expect(plant?.atk).toBe(20);
    expect(plant?.armor).toBe(40);
    expect((plant as { def?: unknown } | undefined)?.def).toBeUndefined();
    expect("defensePercent" in (plant ?? {})).toBe(false);

    const z = findOccupant(model, "Z1");
    expect(z?.atk).toBe(15);
    expect(z?.armor).toBe(50);
    expect(z?.armorMax).toBe(80);
    expect((z as { def?: unknown } | undefined)?.def).toBeUndefined();
  });

  it("rpg shield folds from rpgShield* keys only; vanilla shield stays armor", () => {
    const model = foldLawnEvents([
      evt("plant.spawn", {
        ptr: "P1",
        type: 1,
        row: 0,
        col: 0,
        hp: 100,
        maxHp: 100,
        theShieldHealth: 40, // vanilla → armor, must NOT leak into the RPG shield bar
        rpgShieldHp: 75,
        rpgShieldMax: 120
      }),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, armor: 50 })
    ]);
    const plant = findOccupant(model, "P1");
    expect(plant?.armor).toBe(40); // vanilla mapping unchanged
    expect(plant?.rpgShield).toBe(75);
    expect(plant?.rpgShieldMax).toBe(120);

    // No rpgShield* keys → no shield bar; vanilla armor untouched by the new fold.
    const z = findOccupant(model, "Z1");
    expect(z?.armor).toBe(50);
    expect(z?.rpgShield).toBeUndefined();
  });

  it("explicit rpgShieldMax 0 clears a stale shield bar after break", () => {
    const model = foldLawnEvents([
      evt("plant.spawn", {
        ptr: "P1",
        type: 1,
        row: 0,
        col: 0,
        hp: 100,
        maxHp: 100,
        rpgShieldHp: 75,
        rpgShieldMax: 120
      }),
      // Next dump after the shield broke: injector emits explicit zeros.
      evt("debug.board-stats", {
        plants: [{ ptr: "P1", typeId: 1, row: 0, col: 0, hp: 90, maxHp: 100, rpgShieldHp: 0, rpgShieldMax: 0 }],
        zombies: []
      })
    ]);
    const plant = findOccupant(model, "P1");
    expect(plant?.rpgShield).toBeUndefined();
    expect(plant?.rpgShieldMax).toBeUndefined();
  });

  it("board-stats copies atk + zombie armor; plant shield → armor", () => {
    const model = foldLawnEvents([
      evt("debug.board-stats", {
        plants: [
          {
            ptr: "P",
            typeId: 3,
            row: 0,
            col: 1,
            hp: 80,
            maxHp: 80,
            attack: 9,
            theShieldHealth: 12
          }
        ],
        zombies: [
          {
            ptr: "Z",
            typeId: 2,
            row: 3,
            col: -1,
            hp: 20,
            attackDamage: 5,
            armor: 3,
            armorMax: 10,
            defensePercent: 50
          }
        ]
      })
    ]);
    const plant = findOccupant(model, "P");
    expect(plant?.atk).toBe(9);
    expect(plant?.armor).toBe(12);
    expect("defensePercent" in (plant ?? {})).toBe(false);

    const z = findOccupant(model, "Z");
    expect(z?.atk).toBe(5);
    expect(z?.armor).toBe(3);
    expect(z?.armorMax).toBe(10);
    expect((z as { def?: unknown } | undefined)?.def).toBeUndefined();
  });

  it("entity.stats updates atk/armor on existing only", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 1, row: 0, theAttackDamage: 8 })
    ]);
    expect(findOccupant(seeded, "Z")?.atk).toBe(8);
    const updated = foldLawnEvents(
      [
        evt("entity.stats", {
          ptr: "Z",
          side: "zombie",
          attack: 11,
          theFirstArmorHealth: 4,
          theFirstArmorMaxHealth: 6
        })
      ],
      seeded
    );
    expect(findOccupant(updated, "Z")?.atk).toBe(11);
    expect(findOccupant(updated, "Z")?.armor).toBe(4);
    expect(findOccupant(updated, "Z")?.armorMax).toBe(6);
  });

  it("spawn isMindControlled sets hypno chip", () => {
    const model = foldLawnEvents([
      evt("zombie.spawn", { ptr: "H", type: 5, row: 0, isMindControlled: true })
    ]);
    const z = findOccupant(model, "H");
    expect(z?.flags.hypnotized).toBe(true);
    expect(z?.statusChips).toContain("hypno");
  });

  it("debug.status.applied with ptr sets chip; cleared removes", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1 })
    ]);
    const applied = foldLawnEvents(
      [evt("debug.status.applied", { ptr: "Z1", status: "butter" })],
      seeded
    );
    expect(findOccupant(applied, "Z1")?.statusChips).toContain("butter");

    const cleared = foldLawnEvents(
      [evt("debug.status.cleared", { ptr: "Z1" })],
      applied
    );
    expect(findOccupant(cleared, "Z1")?.statusChips).not.toContain("butter");
  });

  it("debug.status snapshot applies L2 instance chips", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1 }),
      evt("zombie.spawn", { ptr: "Z2", type: 0, row: 2 })
    ]);
    const applied = foldLawnEvents(
      [
        evt("debug.status", {
          count: 2,
          instances: [
            { hostPtr: "Z1", statusId: "wither" },
            { hostPtr: "Z2", statusId: "bond" }
          ]
        })
      ],
      seeded
    );
    expect(findOccupant(applied, "Z1")?.statusChips).toContain("wither");
    expect(findOccupant(applied, "Z2")?.statusChips).toContain("bond");
  });

  it("debug.status.applied ptrs[] freeze/cold/poison; cleared keeps hypno", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "A", type: 1, isMindControlled: true }),
      evt("zombie.spawn", { ptr: "B", type: 1 })
    ]);
    const applied = foldLawnEvents(
      [
        evt("debug.status.applied", { ptrs: ["A", "B"], status: "freeze" }),
        evt("debug.status.applied", { ptr: "A", status: "poison" })
      ],
      seeded
    );
    expect(findOccupant(applied, "A")?.statusChips).toEqual(
      expect.arrayContaining(["hypno", "freeze", "poison"])
    );
    expect(findOccupant(applied, "B")?.statusChips).toContain("freeze");

    const cleared = foldLawnEvents(
      [evt("debug.status.cleared", { ptrs: ["A"] })],
      applied
    );
    const chips = findOccupant(cleared, "A")?.statusChips ?? [];
    expect(chips).toContain("hypno");
    expect(chips).not.toContain("freeze");
    expect(chips).not.toContain("poison");
  });

  it("grid.place then die removes; board-stats keeps tiles", () => {
    const placed = foldLawnEvents([
      evt("grid.place", {
        ptr: "G1",
        type: 7,
        typeName: "Grave",
        row: 2,
        col: 4
      })
    ]);
    expect(findTile(placed, "G1")?.typeName).toBe("Grave");
    expect(tilesAt(placed, 2, 4)).toHaveLength(1);
    expect(selectionStillValid(placed, "G1")).toBe(true);

    const kept = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [{ ptr: "P", typeId: 1, row: 0, col: 0, hp: 1 }],
          zombies: []
        })
      ],
      placed
    );
    expect(findTile(kept, "G1")?.typeId).toBe(7);
    expect(listTiles(kept)).toHaveLength(1);

    const dead = foldLawnEvents([evt("grid.die", { ptr: "G1" })], kept);
    expect(findTile(dead, "G1")).toBeUndefined();
    expect(listTiles(dead)).toHaveLength(0);
    expect(selectionStillValid(dead, "G1")).toBe(false);
  });

  it("spawn copies armor2, speed, interval; defensePercent still absent", () => {
    const model = foldLawnEvents([
      evt("plant.spawn", {
        ptr: "P",
        type: 1,
        row: 0,
        col: 0,
        thePlantAttackInterval: 1.5
      }),
      evt("zombie.spawn", {
        ptr: "Z",
        type: 0,
        theSecondArmorHealth: 40,
        theSecondArmorMaxHealth: 60,
        theSpeed: 0.8
      })
    ]);
    expect(findOccupant(model, "P")?.interval).toBe(1.5);
    expect(findOccupant(model, "Z")?.armor2).toBe(40);
    expect(findOccupant(model, "Z")?.armor2Max).toBe(60);
    expect(findOccupant(model, "Z")?.speed).toBe(0.8);
    expect("defensePercent" in (findOccupant(model, "Z") ?? {})).toBe(false);
  });

  it("zombie.status butter chips; warm clears freeze/cold; pvz.status.apply uses targetPtr", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1 })
    ]);
    const butter = foldLawnEvents(
      [evt("zombie.status", { ptr: "Z", status: "butter", on: true })],
      seeded
    );
    expect(findOccupant(butter, "Z")?.statusChips).toContain("butter");

    const frozen = foldLawnEvents(
      [
        evt("zombie.status", { ptr: "Z", status: "freeze", on: true }),
        evt("zombie.status", { ptr: "Z", status: "cold", on: true })
      ],
      butter
    );
    const warmed = foldLawnEvents(
      [evt("zombie.status", { ptr: "Z", status: "warm", on: false })],
      frozen
    );
    expect(findOccupant(warmed, "Z")?.statusChips).toContain("butter");
    expect(findOccupant(warmed, "Z")?.statusChips).not.toContain("freeze");
    expect(findOccupant(warmed, "Z")?.statusChips).not.toContain("cold");

    const fx = foldLawnEvents(
      [evt("pvz.status.apply", { targetPtr: "Z", status: "poison" })],
      warmed
    );
    expect(findOccupant(fx, "Z")?.statusChips).toContain("poison");
  });

  it("plant.mix sets flag; match.invade and result; mower place/die; money delta", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 })
    ]);
    const mixed = foldLawnEvents(
      [evt("plant.mix", { plantPtr: "P1", usedType: 3 })],
      seeded
    );
    expect(findOccupant(mixed, "P1")?.flags.mixed).toBe(true);
    expect(findOccupant(mixed, "P1")?.typeId).toBe(1);
    expect(listOccupants(mixed)).toHaveLength(1);

    const inv = foldLawnEvents(
      [evt("match.invade", { zombiePtr: "ZZ", type: 2, typeName: "Cone" })],
      mixed
    );
    expect(inv.lastInvade?.ptr).toBe("ZZ");

    const ended = foldLawnEvents(
      [evt("match.result", { result: "victory" })],
      inv
    );
    expect(ended.phase).toBe("Idle");
    expect(ended.result).toBe("victory");
    expect(listOccupants(ended)).toHaveLength(0);

    const mower = foldLawnEvents([
      evt("mower.place", { ptr: "M1", type: 0, typeName: "LawnMower", row: 2 })
    ]);
    expect(mower.mowers.get("M1")?.row).toBe(2);
    expect(selectionStillValid(mower, "M1")).toBe(true);
    const gone = foldLawnEvents([evt("mower.die", { ptr: "M1" })], mower);
    expect(gone.mowers.size).toBe(0);

    const eco = foldLawnEvents([
      evt("board.economy", { sun: 100 }),
      evt("money.gain", { count: 50 }),
      evt("sun.spend", { count: 25 })
    ]);
    expect(eco.economy?.money).toBe(50);
    expect(eco.economy?.sun).toBe(75);
  });

  it("match.win and match.lose clear living, tiles, mowers; phase Idle", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }),
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1 }),
      evt("grid.place", { ptr: "G", type: 7, row: 2, col: 4 }),
      evt("mower.place", { ptr: "M", type: 0, row: 3 })
    ]);
    expect(listOccupants(seeded).length).toBeGreaterThan(0);
    expect(listTiles(seeded)).toHaveLength(1);
    expect(seeded.mowers.size).toBe(1);

    const won = foldLawnEvents([evt("match.win")], seeded);
    expect(won.result).toBe("victory");
    expect(won.phase).toBe("Idle");
    expect(listOccupants(won)).toHaveLength(0);
    expect(listTiles(won)).toHaveLength(0);
    expect(won.mowers.size).toBe(0);

    const lost = foldLawnEvents([evt("match.lose")], seeded);
    expect(lost.result).toBe("defeat");
    expect(lost.phase).toBe("Idle");
    expect(listOccupants(lost)).toHaveLength(0);
    expect(listTiles(lost)).toHaveLength(0);
    expect(lost.mowers.size).toBe(0);
  });

  it("pvz.status.apply empty targetPtr butters every living zombie, not plants", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1 }),
      evt("zombie.spawn", { ptr: "Z2", type: 0, row: 2 })
    ]);
    const applied = foldLawnEvents(
      [evt("pvz.status.apply", { targetPtr: "", status: "butter" })],
      seeded
    );
    expect(findOccupant(applied, "Z1")?.statusChips).toContain("butter");
    expect(findOccupant(applied, "Z2")?.statusChips).toContain("butter");
    expect(findOccupant(applied, "P")?.statusChips).not.toContain("butter");
  });

  it("pvz.status.clear with ptr drops poison/butter, keeps hypno", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 0, isMindControlled: true }),
      evt("pvz.status.apply", { targetPtr: "Z", status: "poison" }),
      evt("pvz.status.apply", { targetPtr: "Z", status: "butter" })
    ]);
    expect(findOccupant(seeded, "Z")?.statusChips).toEqual(
      expect.arrayContaining(["hypno", "poison", "butter"])
    );
    const cleared = foldLawnEvents(
      [evt("pvz.status.clear", { targetPtr: "Z" })],
      seeded
    );
    const chips = findOccupant(cleared, "Z")?.statusChips ?? [];
    expect(chips).toContain("hypno");
    expect(chips).not.toContain("poison");
    expect(chips).not.toContain("butter");
  });

  it("zombie.status on:false (KillDebuff) drops CC chips, keeps hypno", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 0, isMindControlled: true }),
      evt("zombie.status", { ptr: "Z", status: "butter", on: true }),
      evt("zombie.status", { ptr: "Z", status: "freeze", on: true })
    ]);
    const killed = foldLawnEvents(
      [evt("zombie.status", { ptr: "Z", on: false })],
      seeded
    );
    const chips = findOccupant(killed, "Z")?.statusChips ?? [];
    expect(chips).toContain("hypno");
    expect(chips).not.toContain("butter");
    expect(chips).not.toContain("freeze");
    expect(findOccupant(killed, "Z")?.flags.hypnotized).toBe(true);
  });

  it("debug.board-stats copies armor2 / speed / interval; defensePercent still absent", () => {
    const model = foldLawnEvents([
      evt("debug.board-stats", {
        plants: [
          {
            ptr: "P",
            typeId: 1,
            row: 0,
            col: 0,
            hp: 10,
            thePlantAttackInterval: 1.2
          }
        ],
        zombies: [
          {
            ptr: "Z",
            typeId: 2,
            row: 3,
            col: -1,
            hp: 20,
            armor2: 7,
            armor2Max: 14,
            theSpeed: 0.55,
            defensePercent: 88
          }
        ]
      })
    ]);
    expect(findOccupant(model, "P")?.interval).toBe(1.2);
    expect(findOccupant(model, "Z")?.armor2).toBe(7);
    expect(findOccupant(model, "Z")?.armor2Max).toBe(14);
    expect(findOccupant(model, "Z")?.speed).toBe(0.55);
    expect("defensePercent" in (findOccupant(model, "Z") ?? {})).toBe(false);
    expect((findOccupant(model, "Z") as { def?: unknown } | undefined)?.def).toBeUndefined();
  });

  it("stat.applied updates existing only; ghost ptr is not living", () => {
    const ghost = foldLawnEvents([
      evt("stat.applied", { ptr: "GHOST", hpAfter: 9, attackAfter: 4 })
    ]);
    expect(listOccupants(ghost)).toHaveLength(0);

    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0, hp: 40, attack: 8 })
    ]);
    const updated = foldLawnEvents(
      [evt("stat.applied", { ptr: "P", hpAfter: 22, attackAfter: 13 })],
      seeded
    );
    expect(findOccupant(updated, "P")?.hp).toBe(22);
    expect(findOccupant(updated, "P")?.atk).toBe(13);
    expect(listOccupants(updated)).toHaveLength(1);
  });

  it("combat.hit sets lastHit without changing occupant hp or revision", () => {
    const seeded = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1, hp: 100 })
    ]);
    const hit = foldLawnEvents(
      [
        evt("combat.hit", {
          side: "plant",
          damage: 20,
          targetPtr: "Z",
          source: "pea"
        })
      ],
      seeded
    );
    expect(hit.lastHit?.damage).toBe(20);
    expect(hit.lastHit?.targetPtr).toBe("Z");
    expect(hit.lastHit?.side).toBe("plant");
    expect(findOccupant(hit, "Z")?.hp).toBe(100);
    expect(hit.revision).toBe(seeded.revision);
  });

  it("pet.spawn + plant.unique + plant.crash set marker / flags / crash chip", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 })
    ]);
    const unique = foldLawnEvents(
      [evt("plant.unique", { plantPtr: "P1" })],
      seeded
    );
    expect(findOccupant(unique, "P1")?.flags.unique).toBe(true);

    const crashed = foldLawnEvents([evt("plant.crash", { ptr: "P1" })], unique);
    expect(findOccupant(crashed, "P1")?.flags.crashed).toBe(true);
    expect(findOccupant(crashed, "P1")?.statusChips).toContain("crash");

    const pet = foldLawnEvents([
      evt("pet.spawn", { ptr: "PET1", type: 2, typeName: "Gatling", row: 1, col: 3 })
    ]);
    expect(findMarker(pet, "PET1")?.kind).toBe("pet");
    expect(findMarker(pet, "PET1")?.row).toBe(1);
  });

  it("mower.start sets started on existing mower", () => {
    const placed = foldLawnEvents([
      evt("mower.place", { ptr: "M1", type: 0, typeName: "LawnMower", row: 2 })
    ]);
    expect(findMarker(placed, "M1")?.started).toBeFalsy();
    const started = foldLawnEvents([evt("mower.start", { ptr: "M1" })], placed);
    expect(findMarker(started, "M1")?.started).toBe(true);
  });

  it("card.bank + travel.buff fill inspector hand and travelBuffs", () => {
    const model = foldLawnEvents([
      evt("card.bank", { plantType: 3, typeName: "Pea", side: "plant" }),
      evt("travel.buff", { kind: "atk", name: "PlusOne" })
    ]);
    expect(model.hand).toHaveLength(1);
    expect(model.hand[0]?.typeName).toBe("Pea");
    expect(model.hand[0]?.typeId).toBe(3);
    expect(model.travelBuffs).toEqual([{ kind: "atk", name: "PlusOne" }]);
  });

  it("board-stats after mower.place still preserves mower chrome", () => {
    const placed = foldLawnEvents([
      evt("mower.place", { ptr: "M1", type: 0, row: 4 })
    ]);
    const stats = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [{ ptr: "P", typeId: 1, row: 0, col: 0, hp: 1 }],
          zombies: []
        })
      ],
      placed
    );
    expect(findMarker(stats, "M1")?.kind).toBe("mower");
    expect(stats.mowers.size).toBe(1);
    expect(findOccupant(stats, "P")?.typeId).toBe(1);
  });

  it("board-stats mowers:[] clears mowers; missing old plant ptr is gone", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "OLD", type: 1, row: 0, col: 0 }),
      evt("mower.place", { ptr: "M1", type: 0, row: 2 })
    ]);
    const next = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [{ ptr: "NEW", typeId: 2, row: 1, col: 1, hp: 4 }],
          zombies: [],
          mowers: []
        })
      ],
      seeded
    );
    expect(findOccupant(next, "OLD")).toBeUndefined();
    expect(findOccupant(next, "NEW")?.typeId).toBe(2);
    expect(next.mowers.size).toBe(0);
    expect(next.phase).toBe("InMatch");
  });

  it("spawn after match.win returns to InMatch", () => {
    const ended = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }),
      evt("match.win")
    ]);
    expect(ended.phase).toBe("Idle");
    const again = foldLawnEvents(
      [evt("zombie.spawn", { ptr: "Z", type: 0, row: 1, col: 4 })],
      ended
    );
    expect(again.phase).toBe("InMatch");
    expect(findOccupant(again, "Z")?.col).toBe(4);
  });

  it("plant.mix usedPtrs removes consumed parents and flags the result", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "A", type: 1, row: 0, col: 0 }),
      evt("plant.spawn", { ptr: "B", type: 2, row: 0, col: 1 }),
      evt("plant.spawn", { ptr: "R", type: 9, row: 0, col: 0 })
    ]);
    const mixed = foldLawnEvents(
      [
        evt("plant.mix", {
          plantPtr: "R",
          usedType: 9,
          usedPtrs: ["A", "B", "R"]
        })
      ],
      seeded
    );
    expect(findOccupant(mixed, "R")?.flags.mixed).toBe(true);
    expect(findOccupant(mixed, "A")).toBeUndefined();
    expect(findOccupant(mixed, "B")).toBeUndefined();
    expect(listOccupants(mixed).map((o) => o.ptr)).toEqual(["R"]);
  });

  it("plant.mix without usedPtrs only sets the mixed flag", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "A", type: 1, row: 0, col: 0 }),
      evt("plant.spawn", { ptr: "R", type: 9, row: 0, col: 0 })
    ]);
    const mixed = foldLawnEvents(
      [evt("plant.mix", { plantPtr: "R", usedType: 9 })],
      seeded
    );
    expect(findOccupant(mixed, "R")?.flags.mixed).toBe(true);
    expect(findOccupant(mixed, "A")).toBeDefined();
  });

  it("debug.snapshot Ending maps to Idle and clears living", () => {
    const seeded = foldLawnEvents([
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 })
    ]);
    const ended = foldLawnEvents(
      [evt("debug.snapshot", { match: { phase: "Ending", matchKey: "mk" } })],
      seeded
    );
    expect(ended.phase).toBe("Idle");
    expect(listOccupants(ended)).toHaveLength(0);
  });

  it("nonempty board-stats from Starting enters InMatch", () => {
    const start = foldLawnEvents([evt("board.start", {})]);
    expect(start.phase).toBe("Starting");
    const stats = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [{ ptr: "P", typeId: 1, row: 0, col: 0, hp: 8 }],
          zombies: []
        })
      ],
      start
    );
    expect(stats.phase).toBe("InMatch");
    expect(findOccupant(stats, "P")?.hp).toBe(8);
  });

  it("board.start defaults to 12×5 canvas", () => {
    const model = foldLawnEvents([evt("board.start", {})]);
    expect(model.rows).toBe(5);
    expect(model.cols).toBe(12);
  });

  it("board.start columnNum 10 still floors to 12×5", () => {
    const model = foldLawnEvents([evt("board.start", { columnNum: 10, rowNum: 5 })]);
    expect(model.cols).toBe(12);
    expect(model.rows).toBe(5);
  });

  it("plant col 9 sits on the 12-wide lawn", () => {
    const model = foldLawnEvents([
      evt("plant.spawn", { ptr: "P9", type: 1, row: 2, col: 9 })
    ]);
    expect(findOccupant(model, "P9")?.col).toBe(9);
    expect(model.orphans.some((o) => o.ptr === "P9")).toBe(false);
    expect(model.cols).toBe(12);
  });

  it("zombie spawn uses Column 11 not saturated col 9, canvas stays 12×5", () => {
    const model = foldLawnEvents([
      evt("zombie.spawn", {
        ptr: "Z",
        type: 0,
        row: 1,
        col: 9,
        column: 11,
        theX: 9.9
      })
    ]);
    expect(findOccupant(model, "Z")?.col).toBe(11);
    expect(model.orphans).toHaveLength(0);
    expect(model.cols).toBe(12);
  });

  it("board-stats zombie column walks left without shrinking cols", () => {
    const spawned = foldLawnEvents([
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1, col: 9, column: 11 })
    ]);
    const walked = foldLawnEvents(
      [
        evt("debug.board-stats", {
          plants: [],
          zombies: [{ ptr: "Z", typeId: 0, row: 1, col: 9, column: 10, hp: 200 }]
        })
      ],
      spawned
    );
    expect(findOccupant(walked, "Z")?.col).toBe(10);
    expect(walked.cols).toBe(12);
  });

  const goldenActorHud = {
    identity: {
      tier: "normal",
      role: "vanilla",
      levelBand: 12,
      flags: [] as string[]
    },
    resources: {
      shield: {
        hp: 50,
        max: 80,
        stacks: [{ element: "fire", hp: 50, max: 80 }]
      }
    },
    statuses: [
      { id: "command", cc: false, magnitudeBand: "low" },
      { id: "expose", cc: false, magnitudeBand: "mid" }
    ],
    overflow: { statusCount: 0 }
  };

  it("actorHud_from_entity_stats", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5, hp: 200, maxHp: 200 }),
      evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: goldenActorHud })
    ]);
    const occ = findOccupant(model, "Z1");
    expect(occ?.hud?.statuses).toHaveLength(2);
    expect(occ?.hud?.resources?.shield?.stacks).toHaveLength(1);
    expect(occ?.hud?.resources?.shield?.hp).toBe(50);
    expect(occ?.hud?.identity.levelBand).toBe(12);
  });

  it("actorHud_from_board_stats", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("debug.board-stats", {
        plants: [],
        zombies: [
          { ptr: "Z1", typeId: 0, row: 1, col: 5, hp: 200, actorHud: goldenActorHud },
          { ptr: "Z2", typeId: 0, row: 2, col: 5, hp: 180 }
        ]
      })
    ]);
    expect(findOccupant(model, "Z1")?.hud?.statuses).toHaveLength(2);
    expect(findOccupant(model, "Z2")?.hud).toBeUndefined();
  });

  it("status_chips_extended_to_custom_ids", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5 }),
      evt("debug.status.applied", { ptr: "Z1", status: "spark" })
    ]);
    expect(findOccupant(model, "Z1")?.statusChips).toContain("spark");
  });

  it("debug.actor-hud patches single occupant hud", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5 })
    ]);
    const model = foldLawnEvents(
      [evt("debug.actor-hud", { ptr: "Z1", actorHud: goldenActorHud })],
      seeded
    );
    expect(findOccupant(model, "Z1")?.hud?.statuses).toHaveLength(2);
  });

  it("entity.stats without actorHud preserves hud and legacy rpgShield", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5, hp: 200, maxHp: 200 }),
      evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: goldenActorHud, rpgShieldHp: 50, rpgShieldMax: 80 })
    ]);
    const model = foldLawnEvents(
      [evt("entity.stats", { ptr: "Z1", side: "zombie", hp: 180, rpgShieldHp: 40, rpgShieldMax: 80 })],
      seeded
    );
    const occ = findOccupant(model, "Z1");
    expect(occ?.hud?.statuses).toHaveLength(2);
    expect(occ?.rpgShield).toBe(40);
  });

  it("entity.stats actorHud shield break clears resources.shield", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5 }),
      evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: goldenActorHud })
    ]);
    const broken = {
      ...goldenActorHud,
      resources: { shield: { hp: 0, max: 0, stacks: [] } }
    };
    const model = foldLawnEvents(
      [evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: broken })],
      seeded
    );
    expect(findOccupant(model, "Z1")?.hud?.resources?.shield).toBeUndefined();
    expect(findOccupant(model, "Z1")?.hud?.statuses).toHaveLength(2);
  });

  it("malformed actorHud on entity.stats clears hud", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5 }),
      evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: goldenActorHud })
    ]);
    const model = foldLawnEvents(
      [
        evt("entity.stats", {
          ptr: "Z1",
          side: "zombie",
          actorHud: { identity: { tier: "bogus", role: "vanilla", flags: [] }, statuses: [] }
        })
      ],
      seeded
    );
    expect(findOccupant(model, "Z1")?.hud).toBeUndefined();
  });

  it("debug.snapshot entity rebuild preserves hud", () => {
    const seeded = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("zombie.spawn", { ptr: "Z1", type: 0, row: 1, col: 5 }),
      evt("entity.stats", { ptr: "Z1", side: "zombie", actorHud: goldenActorHud })
    ]);
    const model = foldLawnEvents(
      [
        evt("debug.snapshot", {
          match: {
            phase: "InMatch",
            entities: [{ ptr: "Z1", side: "zombie", typeId: 0 }]
          }
        })
      ],
      seeded
    );
    expect(findOccupant(model, "Z1")?.hud?.statuses).toHaveLength(2);
  });

  it("lawn-deploy-event.fired sets pendingLawnDeploy; a second fire replaces it; board.start clears it", () => {
    const seeded = foldLawnEvents([evt("board.start", {}, "m1")]);
    expect(seeded.pendingLawnDeploy).toBeUndefined();

    const fired = foldLawnEvents(
      [evt("lawn-deploy-event.fired", { caseId: "zombie-swarm", eligibleInstanceIds: ["a", "b"] })],
      seeded
    );
    expect(fired.pendingLawnDeploy).toEqual({ caseId: "zombie-swarm", eligibleInstanceIds: ["a", "b"] });

    const refired = foldLawnEvents(
      [evt("lawn-deploy-event.fired", { caseId: "thin-defense", eligibleInstanceIds: ["c"] })],
      fired
    );
    expect(refired.pendingLawnDeploy).toEqual({ caseId: "thin-defense", eligibleInstanceIds: ["c"] });

    const restarted = foldLawnEvents([evt("board.start", {}, "m1")], refired);
    expect(restarted.pendingLawnDeploy).toBeUndefined();

    const ended = foldLawnEvents([evt("board.end", {}, "m1")], restarted);
    const nextMatch = foldLawnEvents([evt("board.start", {}, "m2")], ended);
    expect(nextMatch.pendingLawnDeploy).toBeUndefined();
  });

  it("lawn-deploy-event.fired with no caseId is ignored", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("lawn-deploy-event.fired", { eligibleInstanceIds: ["a"] })
    ]);
    expect(model.pendingLawnDeploy).toBeUndefined();
  });

  it("lawn-deploy-event.fired tolerates a missing/non-array eligibleInstanceIds", () => {
    const model = foldLawnEvents([
      evt("board.start", {}, "m1"),
      evt("lawn-deploy-event.fired", { caseId: "zombie-swarm" })
    ]);
    expect(model.pendingLawnDeploy).toEqual({ caseId: "zombie-swarm", eligibleInstanceIds: [] });
  });
});
