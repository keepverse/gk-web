import { describe, expect, it } from "vitest";
import {
  shouldBuffer,
  shouldEmitLawnModel,
  takeBuffered,
  toInteractionPayload
} from "./lawnHostBuffer";

describe("lawnHostBuffer", () => {
  it("shouldBuffer is true until ready", () => {
    expect(shouldBuffer(false)).toBe(true);
    expect(shouldBuffer(true)).toBe(false);
  });

  it("takeBuffered returns pending and clears", () => {
    const box = { current: { mode: "SpawnTargeting" as const, row: 1, col: 2 } };
    expect(takeBuffered(box)).toEqual({ mode: "SpawnTargeting", row: 1, col: 2 });
    expect(box.current).toBeNull();
    expect(takeBuffered(box)).toBeNull();
  });

  it("toInteractionPayload maps generation + mode/row/col/ptr", () => {
    expect(
      toInteractionPayload(7, {
        mode: "SpawnTargeting",
        row: 2,
        col: 4,
        ptr: undefined
      })
    ).toEqual({
      generation: 7,
      mode: "SpawnTargeting",
      row: 2,
      col: 4,
      ptr: undefined
    });
  });

  it("shouldEmitLawnModel is true on first emit and when revision changes", () => {
    expect(shouldEmitLawnModel(undefined, 0)).toBe(true);
    expect(shouldEmitLawnModel(0, 0)).toBe(false);
    expect(shouldEmitLawnModel(1, 2)).toBe(true);
    expect(shouldEmitLawnModel(2, 2)).toBe(false);
  });
});
