import { describe, expect, it } from "vitest";
import type { SlotView } from "@/contract/types";
import { known } from "@/contract/pending";
import { delveDoorLabel, delveDoorSlot } from "./delveDoorCapability";

function slot(overrides: Partial<SlotView> = {}): SlotView {
  return {
    slotIndex: 0,
    slotTypeId: "wildland",
    element: null,
    state: "Intact",
    ownerFactionId: null,
    guardWaveId: null,
    guardState: "Cleared",
    structureId: null,
    constructionTurnsRemaining: known(null),
    ...overrides
  };
}

describe("delveDoorSlot — the four reused slot kinds, and nothing else (party-dungeon D1.28)", () => {
  it("finds a Lair/Tear/Vault/Anomaly slot among the four SlotTypeCatalog.cs ids", () => {
    expect(delveDoorSlot([slot({ slotTypeId: "lair" })])?.slotTypeId).toBe("lair");
    expect(delveDoorSlot([slot({ slotTypeId: "tear" })])?.slotTypeId).toBe("tear");
    expect(delveDoorSlot([slot({ slotTypeId: "vault" })])?.slotTypeId).toBe("vault");
    expect(delveDoorSlot([slot({ slotTypeId: "anomaly" })])?.slotTypeId).toBe("anomaly");
  });

  it("returns null for a sector with none of the four kinds — no fifth kind is ever matched", () => {
    expect(
      delveDoorSlot([
        slot({ slotTypeId: "wildland" }),
        slot({ slotTypeId: "shrine" }),
        slot({ slotTypeId: "seat" })
      ])
    ).toBeNull();
    expect(delveDoorSlot([])).toBeNull();
  });

  it("picks the first eligible slot when a sector has more than one — one action row, never two", () => {
    const found = delveDoorSlot([
      slot({ slotIndex: 0, slotTypeId: "wildland" }),
      slot({ slotIndex: 1, slotTypeId: "vault" }),
      slot({ slotIndex: 2, slotTypeId: "anomaly" })
    ]);
    expect(found?.slotIndex).toBe(1);
  });
});

describe("delveDoorLabel — the slot's own catalog name, never the raw slotTypeId (GG-23)", () => {
  it.each([
    ["lair", "Open a Lair delve"],
    ["tear", "Open a Rift Tear delve"],
    ["vault", "Open a Vault delve"],
    ["anomaly", "Open a Anomaly delve"]
  ])("labels %s as %s", (slotTypeId, expected) => {
    expect(delveDoorLabel(slot({ slotTypeId }))).toBe(expected);
  });
});
