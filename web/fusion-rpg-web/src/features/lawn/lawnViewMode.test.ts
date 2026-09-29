import { describe, expect, it } from "vitest";
import {
  isLargeCanvas,
  loadLawnViewMode,
  parseLawnViewMode,
  saveLawnViewMode
} from "./lawnViewMode";

describe("lawnViewMode", () => {
  it("parses known modes and defaults to split", () => {
    expect(parseLawnViewMode("split")).toBe("split");
    expect(parseLawnViewMode("large")).toBe("large");
    expect(parseLawnViewMode("stack")).toBe("stack");
    expect(parseLawnViewMode("nope")).toBe("split");
    expect(parseLawnViewMode(null)).toBe("split");
  });

  it("large and stack use the large canvas", () => {
    expect(isLargeCanvas("split")).toBe(false);
    expect(isLargeCanvas("large")).toBe(true);
    expect(isLargeCanvas("stack")).toBe(true);
  });

  it("save/load round-trips through localStorage", () => {
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
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: ls
    });
    saveLawnViewMode("stack");
    expect(loadLawnViewMode()).toBe("stack");
    saveLawnViewMode("split");
    expect(loadLawnViewMode()).toBe("split");
  });
});
