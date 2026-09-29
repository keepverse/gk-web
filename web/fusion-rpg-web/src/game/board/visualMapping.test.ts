import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VisualMappingError, visualFor, type VisualMap } from "./visualMapping";

describe("visualFor — a caller-supplied kind→visual map, generic over the descriptor shape", () => {
  it("returns the descriptor for a known kind", () => {
    type LawnDescriptor = { color: number; shape: "rect" | "circle" };
    const map: VisualMap<LawnDescriptor> = {
      plant: { color: 0x3d6b45, shape: "rect" },
      zombie: { color: 0x6e5a7a, shape: "rect" }
    };
    expect(visualFor(map, "plant")).toEqual({ color: 0x3d6b45, shape: "rect" });
  });

  it("throws VisualMappingError, naming the kind, when a kind has no entry — never a silent default", () => {
    const map: VisualMap<{ color: number }> = { plant: { color: 1 } };
    expect(() => visualFor(map, "zombie")).toThrow(VisualMappingError);
    expect(() => visualFor(map, "zombie")).toThrow(/zombie/);
  });

  it("is generic over a wholly different descriptor shape — no lawn field (color/shape) is assumed", () => {
    type SiegeDescriptor = { spriteSheet: string; frame: number; hpBar: boolean };
    const map: VisualMap<SiegeDescriptor> = {
      rampart: { spriteSheet: "siege-structures", frame: 3, hpBar: true },
      raider: { spriteSheet: "siege-units", frame: 0, hpBar: false }
    };
    expect(visualFor(map, "rampart")).toEqual({ spriteSheet: "siege-structures", frame: 3, hpBar: true });
    expect(visualFor(map, "raider").hpBar).toBe(false);
  });

  it("never resolves a kind through the prototype chain (e.g. 'toString', 'constructor')", () => {
    const map: VisualMap<{ color: number }> = { plant: { color: 1 } };
    expect(() => visualFor(map, "toString")).toThrow(VisualMappingError);
    expect(() => visualFor(map, "constructor")).toThrow(VisualMappingError);
    expect(() => visualFor(map, "__proto__")).toThrow(VisualMappingError);
  });
});

describe("visualMapping.ts imports nothing at all — it knows no board's kind vocabulary", () => {
  it("has zero import statements", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "visualMapping.ts");
    const src = readFileSync(path, "utf8");
    const importLines = src.match(/^import .+$/gm) ?? [];
    expect(importLines).toEqual([]);
  });
});
