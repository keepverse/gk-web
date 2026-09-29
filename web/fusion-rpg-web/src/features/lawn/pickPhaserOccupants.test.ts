import { describe, expect, it } from "vitest";
import { pickPhaserOccupants } from "./pickPhaserOccupants";
import type { Occupant } from "./lawnViewModel";

function occ(partial: Partial<Occupant> & { ptr: string; side: Occupant["side"] }): Occupant {
  return {
    typeId: 0,
    statusChips: [],
    flags: {},
    ...partial
  };
}

describe("pickPhaserOccupants", () => {
  it("keeps everyone under budget", () => {
    const living = [occ({ ptr: "A", side: "plant", row: 0, col: 0 })];
    const r = pickPhaserOccupants(living, 96);
    expect(r.onCanvas).toHaveLength(1);
    expect(r.overflow).toHaveLength(0);
  });

  it("overflows extras; keeps selection and low-col zombie", () => {
    const living: Occupant[] = [];
    for (let i = 0; i < 20; i++) {
      living.push(occ({ ptr: `P${i}`, side: "plant", row: 0, col: i % 9, typeId: i }));
    }
    living.push(occ({ ptr: "NEAR", side: "zombie", row: 2, col: 1 }));
    living.push(occ({ ptr: "FAR", side: "zombie", row: 2, col: 8 }));
    living.push(occ({ ptr: "SEL", side: "zombie", row: 0, col: 7, flags: {} }));
    const r = pickPhaserOccupants(living, 8, "SEL");
    expect(r.onCanvas.length).toBe(8);
    expect(r.onCanvas.some((o) => o.ptr === "SEL")).toBe(true);
    expect(r.onCanvas.some((o) => o.ptr === "NEAR")).toBe(true);
    expect(r.overflow.some((o) => o.ptr === "FAR")).toBe(true);
  });

  it("keeps unique and mixed when budget is tight", () => {
    const living: Occupant[] = [];
    for (let i = 0; i < 10; i++) {
      living.push(occ({ ptr: `P${i}`, side: "plant", row: 0, col: i % 9 }));
    }
    living.push(occ({ ptr: "U", side: "plant", row: 1, col: 0, flags: { unique: true } }));
    living.push(occ({ ptr: "M", side: "plant", row: 1, col: 1, flags: { mixed: true } }));
    const r = pickPhaserOccupants(living, 3);
    expect(r.onCanvas.some((o) => o.ptr === "U")).toBe(true);
    expect(r.onCanvas.some((o) => o.ptr === "M")).toBe(true);
    expect(r.onCanvas.length).toBe(3);
  });

  it("selecting an overflow occupant moves it onto the canvas set", () => {
    const living: Occupant[] = [];
    for (let i = 0; i < 12; i++) {
      living.push(occ({ ptr: `Z${i}`, side: "zombie", row: 0, col: 8 }));
    }
    const a = pickPhaserOccupants(living, 4);
    const overflowPtr = a.overflow[0]?.ptr;
    expect(overflowPtr).toBeDefined();
    const b = pickPhaserOccupants(living, 4, overflowPtr);
    expect(b.onCanvas.some((o) => o.ptr === overflowPtr)).toBe(true);
    const keyA = a.onCanvas.map((o) => o.ptr).sort().join(",");
    const keyB = b.onCanvas.map((o) => o.ptr).sort().join(",");
    expect(keyB).not.toBe(keyA);
  });
});
