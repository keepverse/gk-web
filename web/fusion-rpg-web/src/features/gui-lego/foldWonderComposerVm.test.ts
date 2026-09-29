import { describe, expect, it } from "vitest";
import type { WorldStructureDto } from "@/lib/bus/world";
import {
  WONDER_DUPLICATE_REASON,
  WONDER_REFUSAL_REASONS,
  WONDER_RESERVED_KINDS,
  WONDER_RESERVED_SCOPES,
  foldWonderComposerVm,
  toggleWonderRelic,
  wonderComposerToOrder,
  wonderRefusalVm,
  type WonderComposerFoldInput
} from "./foldWonderComposerVm";
import { WONDER_COMPOSER_EVENTS } from "./wonderComposerBus";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §Testing strategy) — reachable-first join, cap
 * lines, affordability, refusal mapping. Pure functions over hand-built
 * wire shapes matching `WorldDtos.cs` field-for-field; the server half is
 * proved over HTTP by the 4A.2/4A.4 suites.
 */

function structure(overrides: Partial<WorldStructureDto>): WorldStructureDto {
  return {
    structureId: "standing-stones",
    name: "Standing Stones",
    kind: "LoamSource",
    requiredSlotKind: "Rootbed",
    cost: 0,
    yieldMultiplierMilli: 1000,
    buildTurns: 4,
    capacityBonus: 0,
    wonderScope: "Sector",
    wonderRarity: "Common",
    relicCost: 1,
    existenceCap: Number.MAX_SAFE_INTEGER,
    ...overrides
  };
}

const sunspire = structure({
  structureId: "sunspire-throne",
  name: "Sunspire Throne",
  kind: "Yield",
  requiredSlotKind: "Shrine",
  buildTurns: 6,
  wonderScope: "Empire",
  wonderRarity: "Unique",
  relicCost: 3,
  existenceCap: 2
});

function baseInput(overrides?: Partial<WonderComposerFoldInput>): WonderComposerFoldInput {
  return {
    structures: [structure({}), sunspire],
    slots: [
      { slotIndex: 0, slotTypeId: "Rootbed", state: "Empty", guardState: "Cleared", structureId: null },
      { slotIndex: 1, slotTypeId: "Shrine", state: "Empty", guardState: "Cleared", structureId: null }
    ],
    sector: {
      sectorId: "s-1",
      wonderLiveCountSector: { unit: "count", value: 0 },
      wonderLiveCountEmpire: { unit: "count", value: 1 },
      wonderUpkeep: { unit: "loamUnits", value: 8 }
    },
    reachability: {
      worldId: "w-1",
      entityId: "e-1",
      sectorId: "s-1",
      reachableInstanceIds: ["relic-a", "relic-b", "relic-c"]
    },
    cargoRows: [
      { seq: 0, kind: "instance", instanceId: "relic-a", containerId: null, qty: null, weightEach: 1, rowWeight: 1 },
      { seq: 1, kind: "stack", instanceId: null, containerId: "cont-x", qty: 4, weightEach: 2, rowWeight: 8 }
    ],
    storageRows: [{ seq: 0, kind: "instance", instanceId: "relic-b", containerId: null, qty: null }],
    materials: { needRubble: 0, needIronwork: 0, haveRubble: 0, haveIronwork: 0 },
    ui: {
      searchText: "",
      selectedStructureId: "sunspire-throne",
      pickedInstanceIds: [],
      selectedSlotIndex: null,
      filedPending: false
    },
    ...overrides
  };
}

describe("reachable-first join", () => {
  it("sorts cargo-tab + sector-store candidates above the remote shelf, first sighting wins", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        cargoRows: [
          { seq: 0, kind: "instance", instanceId: "relic-a", containerId: null, qty: null, weightEach: 1, rowWeight: 1 },
          { seq: 1, kind: "instance", instanceId: "relic-dup", containerId: null, qty: null, weightEach: 1, rowWeight: 1 }
        ],
        storageRows: [
          { seq: 0, kind: "instance", instanceId: "relic-b", containerId: null, qty: null },
          { seq: 1, kind: "instance", instanceId: "relic-dup", containerId: null, qty: null }
        ],
        reachability: { worldId: "w-1", entityId: "e-1", sectorId: "s-1", reachableInstanceIds: ["relic-a", "relic-b"] }
      })
    );
    // De-duplicated: relic-dup appears once (cargo first-sighting wins).
    expect(vm.candidates.map((c) => c.instanceId)).toEqual(["relic-a", "relic-b", "relic-dup"]);
    expect(vm.candidates[0]).toMatchObject({ where: "legion-cargo", reachable: true });
    expect(vm.candidates[1]).toMatchObject({ where: "sector-store", reachable: true });
    expect(vm.candidates[2]).toMatchObject({ reachable: false, remoteCopyKey: "wonder.refused.not-reachable" });
    expect(vm.remoteCount).toBe(1);
  });

  it("skips rows without an instance id (stacks are never foundation pieces)", () => {
    const vm = foldWonderComposerVm(baseInput());
    expect(vm.candidates.map((c) => c.instanceId).sort()).toEqual(["relic-a", "relic-b"]);
  });

  it("marks picked flags from the order-preserved picked list", () => {
    const vm = foldWonderComposerVm(
      baseInput({ ui: { ...baseInput().ui, pickedInstanceIds: ["relic-b"] } })
    );
    expect(vm.candidates.find((c) => c.instanceId === "relic-b")?.picked).toBe(true);
    expect(vm.candidates.find((c) => c.instanceId === "relic-a")?.picked).toBe(false);
  });
});

describe("live counts", () => {
  it("reads the Empire numerator for Empire rows and the sector numerator for Sector rows", () => {
    const vm = foldWonderComposerVm(baseInput());
    expect(vm.catalogRows.find((r) => r.structureId === "sunspire-throne")?.liveCount).toBe(1);
    expect(vm.catalogRows.find((r) => r.structureId === "standing-stones")?.liveCount).toBe(0);
  });

  it("Common renders uncapped-by-construction, never a cap gauge (GG-64)", () => {
    const vm = foldWonderComposerVm(baseInput());
    const common = vm.catalogRows.find((r) => r.structureId === "standing-stones")!;
    expect(common.capped).toBe(false);
    expect(common.buildable).toBe(true);
    expect(common.blockerCopyKey).toBeNull();
  });

  it("a Unique row at cap is unpickable-with-reason (GG-55), never silently hidden", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        sector: {
          sectorId: "s-1",
          wonderLiveCountSector: { unit: "count", value: 0 },
          wonderLiveCountEmpire: { unit: "count", value: 2 },
          wonderUpkeep: null
        }
      })
    );
    const throne = vm.catalogRows.find((r) => r.structureId === "sunspire-throne")!;
    expect(throne.buildable).toBe(false);
    expect(throne.blockerCopyKey).toBe("wonder.refused.cap-reached");
    // Still listed — the blocker is named on the control.
    expect(vm.catalogRows.map((r) => r.structureId)).toContain("sunspire-throne");
  });

  it("scope/rarity readings assert closed-vocabulary membership, never corpus sizes", () => {
    const vm = foldWonderComposerVm(baseInput());
    for (const row of vm.catalogRows) {
      expect(["Sector", "Empire"]).toContain(row.scope);
      expect(["Common", "Unique"]).toContain(row.rarity);
      expect(row.themeRefs.scope).toBe(`wonder-scope.${row.scope}`);
      expect(row.themeRefs.rarity).toBe(`wonder-rarity.${row.rarity}`);
    }
  });

  it("locked teasers cover every reserved member with a reason, never buildable", () => {
    const vm = foldWonderComposerVm(baseInput());
    const ids = vm.lockedTeasers.map((t) => t.id);
    for (const scope of WONDER_RESERVED_SCOPES) expect(ids).toContain(`locked:${scope}`);
    for (const kind of WONDER_RESERVED_KINDS) expect(ids).toContain(`locked:${kind}`);
    for (const teaser of vm.lockedTeasers) {
      expect(teaser.copyKey).toMatch(/^wonder\.locked\./);
      expect(teaser.themeRef.startsWith("wonder-scope.")).toBe(true);
    }
  });

  it("unknown slot structure ids fall to the placeholder list, never id-words", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        slots: [{ slotIndex: 0, slotTypeId: "Rootbed", state: "Empty", guardState: "Cleared", structureId: "mystery-work" }]
      })
    );
    expect(vm.unknownIds).toEqual(["mystery-work"]);
  });
});

describe("affordability gate", () => {
  it("confirm stays blocked on shortfall until affordable AND k == N with a slot picked", () => {
    const vm = foldWonderComposerVm(baseInput());
    expect(vm.costPlate).toMatchObject({ structureId: "sunspire-throne", picked: 0, needed: 3, affordable: false });
    expect(vm.costPlate.confirmBlockedReason).toBe("relic.shortfall");
  });

  it("names over-picks with the same count line, never silently drops", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        ui: { ...baseInput().ui, pickedInstanceIds: ["relic-a", "relic-b", "relic-c", "relic-x"] }
      })
    );
    expect(vm.costPlate.confirmBlockedReason).toBe("relic.over");
  });

  it("a picked-but-unreachable id still blocks on shortfall (commit would refuse it)", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        ui: { ...baseInput().ui, selectedStructureId: "standing-stones", pickedInstanceIds: ["relic-far"] }
      })
    );
    expect(vm.costPlate.confirmBlockedReason).toBe("relic.shortfall");
  });

  it("pending materials block with reason, never silently enable", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        materials: null,
        ui: { ...baseInput().ui, selectedStructureId: "standing-stones", pickedInstanceIds: ["relic-a"], selectedSlotIndex: 0 }
      })
    );
    expect(vm.costPlate.materialsState).toBe("pending");
    expect(vm.costPlate.confirmBlockedReason).toBe("materials.pending");
  });

  it("short materials block with reason", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        materials: { needRubble: 5, needIronwork: 0, haveRubble: 2, haveIronwork: 0 },
        ui: { ...baseInput().ui, selectedStructureId: "standing-stones", pickedInstanceIds: ["relic-a"], selectedSlotIndex: 0 }
      })
    );
    expect(vm.costPlate.materialsState).toBe("short");
    expect(vm.costPlate.confirmBlockedReason).toBe("materials.short");
  });

  it("enables only when count met, materials ok, and a compatible slot is picked", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        ui: { ...baseInput().ui, selectedStructureId: "standing-stones", pickedInstanceIds: ["relic-a"], selectedSlotIndex: 0 }
      })
    );
    expect(vm.costPlate.affordable).toBe(true);
    expect(vm.costPlate.confirmBlockedReason).toBeNull();
  });

  it("upkeep line renders pending until the ledger wire binds, never guessed", () => {
    const vm = foldWonderComposerVm(
      baseInput({ sector: { ...baseInput().sector, wonderUpkeep: null } })
    );
    expect(vm.costPlate.upkeepState).toBe("pending");
  });
});

describe("slot compatibility", () => {
  it("matches the row's required slot kind; mismatches name wrong-kind", () => {
    const vm = foldWonderComposerVm(baseInput());
    // sunspire-throne needs Shrine: slot 0 (Rootbed) is wrong-kind, slot 1 (Shrine) compatible.
    expect(vm.slots[0]).toMatchObject({ slotIndex: 0, compatible: false, reason: "wrong-kind" });
    expect(vm.slots[1]).toMatchObject({ slotIndex: 1, compatible: true, reason: null });
  });

  it("names occupied, guarded and terminal plots distinctly", () => {
    const vm = foldWonderComposerVm(
      baseInput({
        slots: [
          { slotIndex: 0, slotTypeId: "Shrine", state: "Empty", guardState: "Cleared", structureId: "granary" },
          { slotIndex: 1, slotTypeId: "Shrine", state: "Empty", guardState: "Intact", structureId: null },
          { slotIndex: 2, slotTypeId: "Shrine", state: "Ruined", guardState: "Cleared", structureId: null }
        ]
      })
    );
    expect(vm.slots[0]).toMatchObject({ compatible: false, reason: "occupied", occupied: true });
    expect(vm.slots[1]).toMatchObject({ compatible: false, reason: "guarded" });
    expect(vm.slots[2]).toMatchObject({ compatible: false, reason: "terminal" });
  });
});

describe("toggle step", () => {
  const reachable = new Set(["relic-a", "relic-b", "relic-c"]);

  it("adds a reachable id order-preserved, removes on second toggle", () => {
    const added = toggleWonderRelic(["relic-a"], "relic-b", 3, reachable);
    expect(added).toEqual({ picked: ["relic-a", "relic-b"], refusal: null });
    const removed = toggleWonderRelic(["relic-a", "relic-b"], "relic-a", 3, reachable);
    expect(removed).toEqual({ picked: ["relic-b"], refusal: null });
  });

  it("refuses over-N picks with the count line, leaving the list untouched", () => {
    const over = toggleWonderRelic(["relic-a", "relic-b"], "relic-c", 2, reachable);
    expect(over.picked).toEqual(["relic-a", "relic-b"]);
    expect(over.refusal).toMatchObject({
      reason: "relic.count-mismatch",
      copyKey: "wonder.refused.count-mismatch",
      nextAction: "wonder.next.relay",
      consumed: false
    });
  });

  it("refuses remote picks with the not-reachable line, leaving the list untouched", () => {
    const remote = toggleWonderRelic([], "relic-far", 3, reachable);
    expect(remote.picked).toEqual([]);
    expect(remote.refusal).toMatchObject({
      reason: "relic.not-reachable",
      copyKey: "wonder.refused.not-reachable",
      nextAction: "wonder.next.fetch",
      consumed: false
    });
  });
});

describe("refusal mapping", () => {
  it("maps each of the four wire tokens to copy + next action, nothing consumed", () => {
    const ctx = { needed: 3, picked: 1 };
    expect(wonderRefusalVm("wonder.cap-reached", ctx)).toMatchObject({
      copyKey: "wonder.refused.cap-reached",
      nextAction: "wonder.next.other-row",
      consumed: false
    });
    expect(wonderRefusalVm("relic.count-mismatch", ctx)).toMatchObject({
      copyKey: "wonder.refused.count-mismatch",
      nextAction: "wonder.next.relay",
      consumed: false
    });
    expect(wonderRefusalVm("relic.not-reachable", ctx)).toMatchObject({
      copyKey: "wonder.refused.not-reachable",
      nextAction: "wonder.next.fetch",
      consumed: false
    });
    expect(wonderRefusalVm("build.cannot-afford-materials", ctx)).toMatchObject({
      copyKey: "wonder.refused.cannot-afford",
      nextAction: "wonder.next.gather",
      consumed: false
    });
  });

  it("folds relic.duplicate into the count-mismatch family, preserving the raw reason", () => {
    const vm = wonderRefusalVm(WONDER_DUPLICATE_REASON, { needed: 3, picked: 3 })!;
    expect(vm.reason).toBe("relic.duplicate");
    expect(vm.copyKey).toBe("wonder.refused.count-mismatch");
  });

  it("maps unknown tokens to null — the fold never invents copy", () => {
    expect(wonderRefusalVm("world.unknown", { needed: 1, picked: 0 })).toBeNull();
    expect(wonderRefusalVm("", { needed: 1, picked: 0 })).toBeNull();
  });

  it("pins the closed four-token vocabulary with its reason stated", () => {
    expect([...WONDER_REFUSAL_REASONS]).toEqual([
      "wonder.cap-reached",
      "relic.count-mismatch",
      "relic.not-reachable",
      "build.cannot-afford-materials"
    ]);
  });

  it("pins the closed six-event bus vocabulary with its reason stated", () => {
    expect([...WONDER_COMPOSER_EVENTS]).toEqual([
      "wonder-composer.search.set",
      "wonder-composer.wonder.select",
      "wonder-composer.relic.toggle",
      "wonder-composer.slot.select",
      "wonder-composer.confirm",
      "wonder-composer.retry"
    ]);
  });
});

describe("file path", () => {
  it("files the accepted pick order-preserved through wonder-rest's locked shape", () => {
    const order = wonderComposerToOrder({
      commandId: "t3-build-e1",
      entityId: "e1",
      sectorId: "s-1",
      structureId: "sunspire-throne",
      slotIndex: 1,
      relicInstanceIds: ["relic-c", "relic-a", "relic-b"],
      label: "raise sunspire-throne"
    });
    expect(order).toMatchObject({ kind: "build", structureId: "sunspire-throne", slotIndex: 1 });
    // Picking order preserved — the claimed set and the spend iterate this order.
    expect(order.relicInstanceIds).toEqual(["relic-c", "relic-a", "relic-b"]);
  });
});

describe("phases", () => {
  it("reports error while the reachability read has not answered, with retry on the bus", () => {
    const vm = foldWonderComposerVm(baseInput({ reachability: null }));
    expect(vm.phase).toBe("error");
  });

  it("reports empty when no candidate rows exist, never a blank panel", () => {
    const vm = foldWonderComposerVm(
      baseInput({ cargoRows: [], storageRows: [], reachability: { worldId: "w-1", entityId: "e-1", sectorId: "s-1", reachableInstanceIds: [] } })
    );
    expect(vm.phase).toBe("empty");
  });

  it("passes GG-15 filed-pending through beside the read phase", () => {
    const vm = foldWonderComposerVm(baseInput({ ui: { ...baseInput().ui, filedPending: true } }));
    expect(vm.filedPending).toBe(true);
    expect(vm.phase).toBe("ready");
  });

  it("search filters catalog rows and candidates together", () => {
    const vm = foldWonderComposerVm(baseInput({ ui: { ...baseInput().ui, searchText: "sunspire" } }));
    expect(vm.catalogRows.map((r) => r.structureId)).toEqual(["sunspire-throne"]);
  });
});
