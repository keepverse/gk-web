import { describe, expect, it } from "vitest";
import {
  translateForceKind,
  translateIntel,
  translateOwnership,
  translatePhase
} from "./worldEnums";

describe("translateIntel — IntelState (FactionIntel.cs:133-140)", () => {
  it("maps every real wire value, exact casing", () => {
    expect(translateIntel("Unknown")).toBe("unexplored");
    expect(translateIntel("Rumored")).toBe("rumoured");
    expect(translateIntel("Scouted")).toBe("scouted");
    expect(translateIntel("Watched")).toBe("watched");
  });

  it("the American wire spelling matches — 'Rumoured' (British) is not a value the wire ever sends", () => {
    expect(() => translateIntel("Rumoured")).toThrow(/unmapped intel/);
    expect(() => translateIntel("Rumored")).not.toThrow();
  });

  it("lowercase never matches — the exact defect a naive `=== \"watched\"` comparison would hit", () => {
    expect(() => translateIntel("watched")).toThrow(/unmapped intel/);
    expect(() => translateIntel("rumored")).toThrow(/unmapped intel/);
  });

  it("an unmapped value throws loudly rather than rendering blank", () => {
    expect(() => translateIntel("Glimpsed")).toThrow(/unmapped intel value "Glimpsed"/);
  });
});

describe("translatePhase — SectorPhase (WorldState.cs:6-15)", () => {
  it("maps all seven real wire values", () => {
    expect(translatePhase("Unknown")).toBe("unexplored");
    expect(translatePhase("Explored")).toBe("explored");
    expect(translatePhase("Contested")).toBe("contested");
    expect(translatePhase("Held")).toBe("held");
    expect(translatePhase("Developed")).toBe("developed");
    expect(translatePhase("Besieged")).toBe("besieged");
    expect(translatePhase("Lost")).toBe("lost");
  });

  it("an unmapped value throws loudly", () => {
    expect(() => translatePhase("held")).toThrow(/unmapped phase/);
  });
});

describe("translateForceKind — WorldEntityKind (WorldState.cs:51-58)", () => {
  it("maps all five real wire values", () => {
    expect(translateForceKind("Legion")).toBe("legion");
    expect(translateForceKind("Warband")).toBe("warband");
    expect(translateForceKind("Guard")).toBe("guard");
    expect(translateForceKind("Caravan")).toBe("caravan");
    expect(translateForceKind("Warlord")).toBe("warlord");
  });

  it("an unmapped value throws loudly", () => {
    expect(() => translateForceKind("Warlock")).toThrow(/unmapped force kind/);
  });
});

describe("translateOwnership — a closed, client-derived union", () => {
  it("maps all four ownership values", () => {
    expect(translateOwnership("yours")).toBe("yours");
    expect(translateOwnership("enemy")).toBe("enemy");
    expect(translateOwnership("open")).toBe("open");
    expect(translateOwnership("contested")).toBe("contested");
  });
});

describe("no enum value reaches a player surface untranslated (GG-23)", () => {
  it("every translator's own word differs from the raw wire token it replaces, for at least the casing-sensitive cases", () => {
    expect(translateIntel("Watched")).not.toBe("Watched");
    expect(translatePhase("Held")).not.toBe("Held");
    expect(translateForceKind("Legion")).not.toBe("Legion");
  });
});
