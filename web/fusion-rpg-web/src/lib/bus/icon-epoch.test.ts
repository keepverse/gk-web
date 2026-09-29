import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bumpIconEpoch,
  getIconEpoch,
  resetIconEpochForTests,
  subscribeIconEpoch
} from "./icon-epoch";

describe("icon-epoch", () => {
  afterEach(() => {
    resetIconEpochForTests();
  });

  it("starts at 0, bump notifies subscribers", () => {
    expect(getIconEpoch()).toBe(0);
    const listener = vi.fn();
    const off = subscribeIconEpoch(listener);
    bumpIconEpoch();
    expect(getIconEpoch()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    bumpIconEpoch();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resetIconEpochForTests restores 0", () => {
    bumpIconEpoch();
    resetIconEpochForTests();
    expect(getIconEpoch()).toBe(0);
  });
});
