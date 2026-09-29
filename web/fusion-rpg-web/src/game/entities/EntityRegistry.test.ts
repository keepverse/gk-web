import { describe, expect, it, vi } from "vitest";
import { EntityRegistry } from "./EntityRegistry";

type ActorRecord = { key: string; hp: number };

describe("EntityRegistry — genericity over a plain actor-key string (no normalization, no disposal)", () => {
  it("get/set/delete/keys/entries all work with an identity key and no dispose callback", () => {
    const reg = new EntityRegistry<string, ActorRecord>();
    reg.set("e-a:0", { key: "e-a:0", hp: 100 });
    reg.set("e-d:1", { key: "e-d:1", hp: 50 });

    expect(reg.get("e-a:0")).toEqual({ key: "e-a:0", hp: 100 });
    expect(reg.keys().sort()).toEqual(["e-a:0", "e-d:1"]);
    expect([...reg.entries()]).toHaveLength(2);

    expect(reg.delete("e-a:0")).toEqual({ key: "e-a:0", hp: 100 });
    expect(reg.get("e-a:0")).toBeUndefined();
    expect(reg.keys()).toEqual(["e-d:1"]);
  });

  it("an identity key is never normalized — case and whitespace are significant", () => {
    const reg = new EntityRegistry<string, ActorRecord>();
    reg.set(" e-a:0 ", { key: " e-a:0 ", hp: 1 });
    expect(reg.get("e-a:0")).toBeUndefined();
    expect(reg.get(" e-a:0 ")).toBeDefined();
  });

  it("clear empties the registry and calls dispose on nothing when none is supplied", () => {
    const reg = new EntityRegistry<string, ActorRecord>();
    reg.set("a", { key: "a", hp: 1 });
    reg.clear();
    expect(reg.keys()).toEqual([]);
    expect([...reg.entries()]).toHaveLength(0);
  });
});

describe("EntityRegistry — genericity over a ptr-shaped string key with normalization and disposal", () => {
  type PtrRecord = { ptr: string; destroy: () => void };

  it("normalizeKey and dispose both run, matching PtrEntityRegistry's own pre-extraction behavior", () => {
    const destroy = vi.fn();
    const reg = new EntityRegistry<string, PtrRecord>({
      normalizeKey: (ptr) => ptr.trim().toUpperCase(),
      dispose: (rec) => rec.destroy()
    });

    reg.set("ab", { ptr: "ab", destroy });
    expect(reg.get("AB")).toBeDefined();
    expect(reg.get(" ab ")).toBeDefined();
    expect(reg.keys()).toEqual(["AB"]);

    reg.clear();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(reg.keys()).toEqual([]);
  });
});

describe("EntityRegistry — a numeric key type works too, proving genericity over the key TYPE, not just string shape", () => {
  it("accepts a plain number as a key", () => {
    const reg = new EntityRegistry<number, string>();
    reg.set(1, "one");
    reg.set(2, "two");
    expect(reg.get(1)).toBe("one");
    expect(reg.keys().sort()).toEqual([1, 2]);
  });
});
