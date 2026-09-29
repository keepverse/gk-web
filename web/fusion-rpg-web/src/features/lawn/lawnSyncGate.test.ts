import { describe, expect, it } from "vitest";
import {
  forceSyncLastApplied,
  noteIconLoadFailure,
  shouldSyncLawnSprites
} from "./lawnSyncGate";

describe("shouldSyncLawnSprites", () => {
  it("syncs when revision increases", () => {
    expect(
      shouldSyncLawnSprites({
        revision: 2,
        lastApplied: 1,
        canvasKey: "a",
        lastCanvasKey: "a"
      })
    ).toBe(true);
  });

  it("skips when revision and canvas are unchanged", () => {
    expect(
      shouldSyncLawnSprites({
        revision: 2,
        lastApplied: 2,
        canvasKey: "a",
        lastCanvasKey: "a"
      })
    ).toBe(false);
  });

  it("syncs when canvasPtrs change at the same revision", () => {
    expect(
      shouldSyncLawnSprites({
        revision: 2,
        lastApplied: 2,
        canvasKey: "a,b",
        lastCanvasKey: "a"
      })
    ).toBe(true);
  });

  it("syncs revision 0 when canvas changes", () => {
    expect(
      shouldSyncLawnSprites({
        revision: 0,
        lastApplied: 0,
        canvasKey: "P1",
        lastCanvasKey: ""
      })
    ).toBe(true);
  });
});

describe("forceSyncLastApplied", () => {
  it("returns revision-1 so rev 0 still applies", () => {
    expect(forceSyncLastApplied(0, 0, true)).toBe(-1);
    expect(forceSyncLastApplied(4, 4, true)).toBe(3);
    expect(forceSyncLastApplied(4, 3, false)).toBe(3);
  });
});

describe("noteIconLoadFailure", () => {
  it("moves a key from loads to fails", () => {
    const loads = new Set(["icon-a", "icon-b"]);
    const fails = new Set<string>();
    expect(noteIconLoadFailure(loads, fails, "icon-a")).toBe(true);
    expect(loads.has("icon-a")).toBe(false);
    expect(loads.has("icon-b")).toBe(true);
    expect(fails.has("icon-a")).toBe(true);
  });

  it("ignores missing keys so other in-flight loads stay pending", () => {
    const loads = new Set(["icon-b"]);
    const fails = new Set<string>();
    expect(noteIconLoadFailure(loads, fails, undefined)).toBe(false);
    expect(loads.has("icon-b")).toBe(true);
    expect(fails.size).toBe(0);
  });
});
