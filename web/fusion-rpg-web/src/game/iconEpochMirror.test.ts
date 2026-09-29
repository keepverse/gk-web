import { afterEach, describe, expect, it } from "vitest";
import {
  getIconEpochMirror,
  resetIconEpochMirrorForTests,
  setIconEpochMirror
} from "./iconEpochMirror";

describe("iconEpochMirror", () => {
  afterEach(() => {
    resetIconEpochMirrorForTests();
  });

  it("set/get round-trips", () => {
    setIconEpochMirror(42);
    expect(getIconEpochMirror()).toBe(42);
  });

  it("coerces via >>> 0 (unsigned 32-bit)", () => {
    setIconEpochMirror(-1);
    expect(getIconEpochMirror()).toBe(0xffffffff);

    setIconEpochMirror(2 ** 32 + 7);
    expect(getIconEpochMirror()).toBe(7);
  });
});
