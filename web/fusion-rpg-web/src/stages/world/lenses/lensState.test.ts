import { describe, expect, it } from "vitest";
import { LENSES } from "./lensCatalog";
import { initialLensState, lensReducer } from "./lensState";

describe("lensCatalog — the closed set of six (world-stage W94)", () => {
  it("has exactly six entries — also the assertion that Placement is not one of them", () => {
    expect(LENSES).toHaveLength(6);
    expect(LENSES.map((l) => l.id)).not.toContain("placement");
  });
});

describe("lensReducer — exclusive by construction, home key returns to Ownership (world-stage W94)", () => {
  it("starts on Ownership", () => {
    expect(initialLensState).toEqual({ active: "ownership", playerChosen: "ownership" });
  });

  it("selecting a different lens makes it both active and player-chosen", () => {
    const next = lensReducer(initialLensState, { type: "select", id: "danger" });
    expect(next).toEqual({ active: "danger", playerChosen: "danger" });
  });

  it("pressing the active lens's own key returns to Ownership", () => {
    const onFade = lensReducer(initialLensState, { type: "select", id: "fade" });
    const home = lensReducer(onFade, { type: "select", id: "fade" });
    expect(home).toEqual({ active: "ownership", playerChosen: "ownership" });
  });

  it("pressing Ownership's own key while already on Ownership is a no-op, not a toggle to nothing", () => {
    const next = lensReducer(initialLensState, { type: "select", id: "ownership" });
    expect(next).toBe(initialLensState); // same reference: genuinely untouched
  });

  it("auto-activate changes only the active lens, never playerChosen", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "danger" });
    const auto = lensReducer(chosen, { type: "auto-activate", id: "supply" });
    expect(auto).toEqual({ active: "supply", playerChosen: "danger" });
  });

  it("restore puts back the lens the player actually chose — the test that catches restoring to Ownership by mistake", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "danger" });
    const auto = lensReducer(chosen, { type: "auto-activate", id: "supply" });
    const restored = lensReducer(auto, { type: "restore" });
    expect(restored).toEqual({ active: "danger", playerChosen: "danger" });
  });

  it("every reducer path leaves exactly one lens active — the type does not permit zero or two", () => {
    const states = [
      lensReducer(initialLensState, { type: "select", id: "loam" }),
      lensReducer(initialLensState, { type: "auto-activate", id: "intel" }),
      lensReducer(initialLensState, { type: "restore" })
    ];
    for (const s of states) {
      expect(typeof s.active).toBe("string");
      expect(LENSES.map((l) => l.id)).toContain(s.active);
    }
  });
});
