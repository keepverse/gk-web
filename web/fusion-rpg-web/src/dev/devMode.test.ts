import { beforeEach, describe, expect, it } from "vitest";
import { isDevModeEnabled, setDevModeEnabled } from "./devMode";

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
});

describe("devMode", () => {
  it("is off by default", () => {
    expect(isDevModeEnabled()).toBe(false);
  });

  it("persists across reads once enabled", () => {
    setDevModeEnabled(true);
    expect(isDevModeEnabled()).toBe(true);
  });

  it("can be turned back off", () => {
    setDevModeEnabled(true);
    setDevModeEnabled(false);
    expect(isDevModeEnabled()).toBe(false);
  });
});
