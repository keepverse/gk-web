import { describe, expect, it } from "vitest";
import {
  initialTargetingState,
  isTargeting,
  targetingReducer,
  type TargetingState
} from "./targetingState";

describe("targetingState — the transient overlay lifecycle (world-stage W67)", () => {
  it("starting a verb activates exactly one overlay", () => {
    const state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "move",
      overlay: "range",
      currentLens: "loam"
    });
    expect(state.activeVerb).toBe("move");
    expect(state.overlay).toBe("range");
    expect(isTargeting(state)).toBe(true);
  });

  it("starting a verb while one is already active replaces it — never stacks", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "move",
      overlay: "range",
      currentLens: "loam"
    });
    state = targetingReducer(state, { type: "start", verb: "build", overlay: "placement", currentLens: "loam" });
    expect(state.activeVerb).toBe("build");
    expect(state.overlay).toBe("placement");
  });

  it("cancel (Esc) ends targeting but keeps priorLens readable for the caller's own restore step", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "move",
      overlay: "range",
      currentLens: "loam"
    });
    state = targetingReducer(state, { type: "cancel" });
    expect(isTargeting(state)).toBe(false);
    expect(state.overlay).toBeNull();
    expect(state.priorLens).toBe("loam");
  });

  it("complete (an order filed) ends targeting the same way cancel does", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "claim",
      overlay: "range",
      currentLens: "fog"
    });
    state = targetingReducer(state, { type: "complete" });
    expect(isTargeting(state)).toBe(false);
    expect(state.priorLens).toBe("fog");
  });

  it("no overlay survives a selection change — the same ending as cancel/complete", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "stance",
      overlay: "range",
      currentLens: "loam"
    });
    state = targetingReducer(state, { type: "selection-changed" });
    expect(isTargeting(state)).toBe(false);
    expect(state.priorLens).toBe("loam");
  });

  it("lens-restored is the caller's own final step, clearing priorLens once the switch is applied", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "move",
      overlay: "range",
      currentLens: "loam"
    });
    state = targetingReducer(state, { type: "cancel" });
    expect(state.priorLens).toBe("loam");
    state = targetingReducer(state, { type: "lens-restored" });
    expect(state.priorLens).toBeNull();
  });

  it("starting with no prior lens (none was selected) restores to null honestly, not a guessed default", () => {
    let state = targetingReducer(initialTargetingState, {
      type: "start",
      verb: "move",
      overlay: "range",
      currentLens: null
    });
    state = targetingReducer(state, { type: "cancel" });
    expect(state.priorLens).toBeNull();
  });

  it("cancel with nothing active is a harmless no-op — never throws, never invents an overlay", () => {
    const state = targetingReducer(initialTargetingState, { type: "cancel" });
    expect(state).toEqual<TargetingState>({ activeVerb: null, overlay: null, priorLens: null });
  });
});
