import { describe, expect, it } from "vitest";
import { autoActivationAction, initialLensState, lensReducer } from "./lensState";

/**
 * world-stage W98 (spec-world-lenses.md §3) — the four named triggers, tested against the exact
 * scenario the spec calls out as "the test that catches the obvious wrong implementation": restoring
 * to Ownership instead of whatever the player actually had showing. **Raise** is the fourth trigger
 * and deliberately has no case here — it opens `world-targeting`'s placement overlay, never a lens
 * (§3's own table), so it never reaches `autoActivationAction` at all. The "announces itself" promise
 * — the picker's chip and readout changing — falls straight out of `LensPicker.tsx` rendering `active`
 * reactively (proven generically by `LensPicker.test.tsx`, W96); nothing extra to prove here beyond
 * this module producing the right `active` value for each trigger.
 */
describe("Auto-activation triggers (world-stage W98)", () => {
  it("Ward a road selects lens 4 (supply) without disturbing playerChosen", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "danger" });
    const auto = lensReducer(chosen, autoActivationAction({ kind: "ward-a-road" }));
    expect(auto).toEqual({ active: "supply", playerChosen: "danger" });
  });

  it("selecting a legion outside supply selects lens 4, and restore puts back what the player chose — the test that catches restoring to Ownership by mistake", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "danger" });
    const auto = lensReducer(chosen, autoActivationAction({ kind: "legion-outside-supply" }));
    expect(auto).toEqual({ active: "supply", playerChosen: "danger" });

    const restored = lensReducer(auto, { type: "restore" });
    expect(restored).toEqual({ active: "danger", playerChosen: "danger" });
  });

  it("opening a fade warning from the notification rail selects lens 3 (fade), and closing it restores the player's own lens", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "loam" });
    const auto = lensReducer(chosen, autoActivationAction({ kind: "fade-warning" }));
    expect(auto).toEqual({ active: "fade", playerChosen: "loam" });

    const restored = lensReducer(auto, { type: "restore" });
    expect(restored).toEqual({ active: "loam", playerChosen: "loam" });
  });

  it("restoring while the player's own chosen lens was already Ownership returns there, not somewhere else", () => {
    const auto = lensReducer(initialLensState, autoActivationAction({ kind: "ward-a-road" }));
    expect(auto).toEqual({ active: "supply", playerChosen: "ownership" });
    const restored = lensReducer(auto, { type: "restore" });
    expect(restored).toEqual({ active: "ownership", playerChosen: "ownership" });
  });

  it("a second auto-activation while one is already showing still restores to the one real playerChosen, not the first auto-activated lens", () => {
    const chosen = lensReducer(initialLensState, { type: "select", id: "intel" });
    const firstAuto = lensReducer(chosen, autoActivationAction({ kind: "fade-warning" }));
    const secondAuto = lensReducer(firstAuto, autoActivationAction({ kind: "legion-outside-supply" }));
    expect(secondAuto).toEqual({ active: "supply", playerChosen: "intel" });

    const restored = lensReducer(secondAuto, { type: "restore" });
    expect(restored).toEqual({ active: "intel", playerChosen: "intel" });
  });
});
