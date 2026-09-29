import { describe, expect, it, beforeEach } from "vitest";
import {
  allocGameGeneration,
  lawnBusClearAll,
  lawnBusEmit,
  lawnBusOn,
  resetGameGenerationForTests,
  worldBusClearAll,
  worldBusEmit,
  worldBusOn
} from "./EventBus";

describe("EventBus world:* beside lawn:*", () => {
  beforeEach(() => {
    lawnBusClearAll();
    worldBusClearAll();
    resetGameGenerationForTests();
  });

  it("does not widen LawnBusEvent names — lawn emit still works", () => {
    const seen: unknown[] = [];
    lawnBusOn("lawn:ready", (p) => seen.push(p));
    lawnBusEmit("lawn:ready", { generation: 1 });
    expect(seen).toEqual([{ generation: 1 }]);
  });

  it("worldBusClearAll does not wipe lawn listeners", () => {
    const lawnSeen: unknown[] = [];
    const worldSeen: unknown[] = [];
    lawnBusOn("lawn:ready", (p) => lawnSeen.push(p));
    worldBusOn("world:ready", (p) => worldSeen.push(p));
    worldBusClearAll();
    lawnBusEmit("lawn:ready", { generation: 1 });
    worldBusEmit("world:ready", { generation: 1 });
    expect(lawnSeen).toEqual([{ generation: 1 }]);
    expect(worldSeen).toEqual([]);
  });

  it("lawnBusClearAll does not wipe world listeners", () => {
    const lawnSeen: unknown[] = [];
    const worldSeen: unknown[] = [];
    lawnBusOn("lawn:ready", (p) => lawnSeen.push(p));
    worldBusOn("world:ready", (p) => worldSeen.push(p));
    lawnBusClearAll();
    lawnBusEmit("lawn:ready", { generation: 1 });
    worldBusEmit("world:ready", { generation: 2 });
    expect(lawnSeen).toEqual([]);
    expect(worldSeen).toEqual([{ generation: 2 }]);
  });

  it("world:model carries modelSeq", () => {
    const seen: unknown[] = [];
    worldBusOn("world:model", (p) => seen.push(p));
    worldBusEmit("world:model", { generation: 3, modelSeq: 7, model: { sectors: [] } });
    expect(seen[0]).toMatchObject({ generation: 3, modelSeq: 7 });
  });

  it("allocGameGeneration is shared and monotonic", () => {
    expect(allocGameGeneration()).toBe(1);
    expect(allocGameGeneration()).toBe(2);
  });

  it("subscribers can drop foreign generation", () => {
    const hostGen = 2;
    const applied: number[] = [];
    worldBusOn("world:select", (raw) => {
      const p = raw as { generation: number };
      if (p.generation !== hostGen) return;
      applied.push(p.generation);
    });
    worldBusEmit("world:select", { generation: 1, kind: "empty" });
    worldBusEmit("world:select", { generation: 2, kind: "empty" });
    expect(applied).toEqual([2]);
  });
});
