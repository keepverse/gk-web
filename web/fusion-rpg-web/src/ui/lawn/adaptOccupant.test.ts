import { describe, expect, it } from "vitest";
import { adaptOccupant, adaptOccupants, encodeLawnSel, makeObserveHandle } from "./adaptOccupant";
import type { Occupant } from "@/features/lawn/lawnViewModel";

function occ(partial: Partial<Occupant> & Pick<Occupant, "ptr" | "side" | "typeId">): Occupant {
  return {
    statusChips: [],
    flags: {},
    ...partial
  };
}

describe("adaptOccupant", () => {
  it("maps Bound unique to Fielded with instanceId", () => {
    const row = adaptOccupant(
      occ({ ptr: "0x1", side: "plant", typeId: 1, typeName: "Pea", instanceId: "u-1", hp: 50, maxHp: 100 })
    );
    expect(row.chip).toBe("Fielded");
    expect(row.instanceId).toBe("u-1");
    expect(row.observeHandle).toBeUndefined();
    expect(row.hpFraction).toBe(0.5);
    expect(encodeLawnSel(row)).toBe("u-1");
  });

  it("maps general to Wave with observe handle and refuses sel", () => {
    const row = adaptOccupant(occ({ ptr: "0x2", side: "zombie", typeId: 2, typeName: "Cone" }));
    expect(row.chip).toBe("Wave");
    expect(row.instanceId).toBeUndefined();
    expect(row.observeHandle).toBe(makeObserveHandle("0x2", 0));
    expect(encodeLawnSel(row)).toBeNull();
  });

  it("sorts Fielded before Wave, plants before zombies", () => {
    const rows = adaptOccupants([
      occ({ ptr: "z", side: "zombie", typeId: 2 }),
      occ({ ptr: "p", side: "plant", typeId: 1, instanceId: "u" }),
      occ({ ptr: "p2", side: "plant", typeId: 3 })
    ]);
    expect(rows.map((r) => r.chip)).toEqual(["Fielded", "Wave", "Wave"]);
    expect(rows[0]!.instanceId).toBe("u");
    expect(rows[1]!.side).toBe("plant");
    expect(rows[2]!.side).toBe("zombie");
  });

  it("never puts ptr in player-visible fields", () => {
    const row = adaptOccupant(occ({ ptr: "SECRET", side: "plant", typeId: 1 }));
    expect(row.displayName).not.toContain("SECRET");
    expect(row.key).not.toBe("SECRET");
  });
});
