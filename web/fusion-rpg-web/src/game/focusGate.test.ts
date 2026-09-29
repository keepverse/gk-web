import { describe, expect, it, beforeEach } from "vitest";
import {
  isLawnKeyboardMuted,
  resetLawnKeyboardMuteForTests,
  setLawnKeyboardMuted
} from "./focusGate";
import { makeGridSpec } from "./board/GridSpec";
import { nextFocus } from "./board/keyboardNav";

describe("focus-input gate (GG-18)", () => {
  beforeEach(() => {
    resetLawnKeyboardMuteForTests();
  });

  it("mutes Phaser keyboard when a React layer owns input", () => {
    setLawnKeyboardMuted(true);
    expect(isLawnKeyboardMuted()).toBe(true);
    const applyKey = () => {
      if (isLawnKeyboardMuted()) return null;
      return nextFocus(makeGridSpec(5, 9), { row: 0, col: 0 }, "right");
    };
    expect(applyKey()).toBeNull();
    setLawnKeyboardMuted(false);
    expect(applyKey()).toEqual({ row: 0, col: 1 });
  });
});
