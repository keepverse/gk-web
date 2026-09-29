import { describe, expect, it } from "vitest";
import { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import { findRegistryRecordForGameObject } from "./PickSystem";

describe("findRegistryRecordForGameObject", () => {
  it("resolves a HUD child to its parent occupant container (T12)", () => {
    const registry = new PtrEntityRegistry();
    const parent = { name: "occ" } as unknown as Phaser.GameObjects.Container;
    const hudChild = {
      name: "hudStatus0",
      parentContainer: parent
    } as unknown as Phaser.GameObjects.GameObject;

    registry.set({
      ptr: "0xABC",
      side: "plant",
      typeId: 1,
      row: 2,
      col: 3,
      chips: [],
      selected: false,
      go: parent
    });

    const hit = findRegistryRecordForGameObject(registry, hudChild);
    expect(hit?.ptr).toBe("0xABC");
    expect(hit?.row).toBe(2);
    expect(hit?.col).toBe(3);
  });

  it("returns undefined when the object is not under a registered go", () => {
    const registry = new PtrEntityRegistry();
    const orphan = { name: "x", parentContainer: null } as unknown as Phaser.GameObjects.GameObject;
    expect(findRegistryRecordForGameObject(registry, orphan)).toBeUndefined();
  });
});
