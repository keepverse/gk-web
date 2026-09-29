import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BINDINGS,
  KEYBINDINGS_CHANGED_EVENT,
  clearBindingsForTests,
  conflictFor,
  currentBindings,
  currentKeyFor,
  rebind,
  reservedRangeReasonFor,
  resetBindings
} from "./keybindings";

// This environment's default window.localStorage is incomplete (see lawnViewMode.test.ts for the
// same pattern) — stub a real in-memory Storage before each test.
beforeEach(() => {
  const mem: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
  clearBindingsForTests();
});

describe("keybindings (T20)", () => {
  it("defaults to the real plate D table with no overrides", () => {
    expect(currentBindings()).toEqual(DEFAULT_BINDINGS);
    expect(currentKeyFor("creatures")).toBe("c");
  });

  it("rebind persists across reads and reports no conflict when the key is free", () => {
    rebind("creatures", "x");
    expect(currentKeyFor("creatures")).toBe("x");
    expect(conflictFor("x", "relics")).toBe("creatures");
    expect(conflictFor("z", "relics")).toBeNull();
  });

  it("rebinding onto a key another action already holds swaps keys instead of colliding", () => {
    // Relics defaults to "r" — the exact key Creatures is about to take. A naive "revert the
    // loser to its own default" would leave Relics back on "r" too, colliding with Creatures.
    const next = rebind("creatures", "r");
    expect(next.creatures).toBe("r");
    expect(next.relics).toBe("c"); // swapped onto Creatures' vacated key, not left on "r"
    expect(conflictFor("r", "fusion")).toBe("creatures");
    expect(conflictFor("c", "fusion")).toBe("relics");
  });

  it("a swap where the loser's own default is the contested key never leaves two actions on one key", () => {
    // Same shape, but confirm generally: after ANY rebind, every action resolves to a distinct
    // key — this is the invariant the swap logic exists to preserve.
    const next = rebind("creatures", "r");
    const keys = Object.values(next);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reset restores every action to its default and clears storage", () => {
    rebind("creatures", "x");
    rebind("relics", "z");
    const reset = resetBindings();
    expect(reset).toEqual(DEFAULT_BINDINGS);
    expect(currentBindings()).toEqual(DEFAULT_BINDINGS);
  });

  it("survives a broken/unreadable localStorage rather than throwing", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        }
      }
    });
    expect(() => currentBindings()).not.toThrow();
    expect(currentBindings()).toEqual(DEFAULT_BINDINGS);
    expect(() => rebind("creatures", "x")).not.toThrow();
  });

  it("dispatches a change event on rebind and reset, so a live listener can react", () => {
    const onChange = vi.fn();
    window.addEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
    rebind("creatures", "x");
    expect(onChange).toHaveBeenCalledTimes(1);
    resetBindings();
    expect(onChange).toHaveBeenCalledTimes(2);
    window.removeEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
  });

  // world-stage W95: 1-9 are information-architecture.md's own reserved range.
  it("rebind('relics', '3') is refused: the table is unchanged and no change event fires", () => {
    const onChange = vi.fn();
    window.addEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
    const result = rebind("relics", "3");
    expect(result).toEqual(DEFAULT_BINDINGS);
    expect(currentKeyFor("relics")).toBe("r");
    expect(onChange).not.toHaveBeenCalled();
    window.removeEventListener(KEYBINDINGS_CHANGED_EVENT, onChange);
  });

  it("reservedRangeReasonFor names the reason for 1-9 and is null for every other key", () => {
    for (const digit of "123456789") {
      expect(reservedRangeReasonFor(digit)).toContain("reserved");
    }
    expect(reservedRangeReasonFor("0")).toBeNull();
    expect(reservedRangeReasonFor("r")).toBeNull();
  });

  it("the eight existing letter defaults still rebind freely", () => {
    for (const key of Object.values(DEFAULT_BINDINGS)) {
      expect(reservedRangeReasonFor(key)).toBeNull();
    }
    expect(rebind("almanac", "z").almanac).toBe("z");
  });
});
