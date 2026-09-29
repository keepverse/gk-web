import { describe, expect, it } from "vitest";
import {
  clearEmptyShield,
  foldActorHud,
  foldHudFromPayload,
  hudSnapshotsEqual
} from "./foldActorHud";

const golden = {
  identity: {
    tier: "normal",
    role: "vanilla",
    levelBand: 12,
    flags: [] as string[]
  },
  resources: {
    shield: {
      hp: 50,
      max: 80,
      stacks: [{ element: "fire", hp: 50, max: 80 }]
    }
  },
  statuses: [
    { id: "command", cc: false, magnitudeBand: "low" },
    { id: "expose", cc: false, magnitudeBand: "mid" }
  ],
  overflow: { statusCount: 0 }
};

describe("foldActorHud", () => {
  it("accepts golden wire shape", () => {
    const hud = foldActorHud(golden);
    expect(hud?.statuses).toHaveLength(2);
    expect(hud?.resources?.shield?.hp).toBe(50);
    expect(hud?.identity.levelBand).toBe(12);
  });

  it("preserves valid primary and secondary elements", () => {
    const hud = foldActorHud({ ...golden, elements: { primary: "fire", secondary: "ice" } });
    expect(hud?.elements).toEqual({ primary: "fire", secondary: "ice" });
  });

  it("rejects malformed tier", () => {
    expect(
      foldActorHud({
        ...golden,
        identity: { ...golden.identity, tier: "not-a-tier" }
      })
    ).toBeUndefined();
  });

  it("rejects missing overflow", () => {
    const { overflow: _o, ...rest } = golden;
    expect(foldActorHud(rest)).toBeUndefined();
  });

  it("clearEmptyShield drops shield when max is 0", () => {
    const hud = foldActorHud({
      ...golden,
      resources: {
        shield: { hp: 0, max: 0, stacks: [] }
      }
    });
    expect(hud?.resources?.shield).toBeUndefined();
  });

  it("clearEmptyShield drops shield when hp is 0 but max positive", () => {
    const hud = foldActorHud({
      ...golden,
      resources: {
        shield: { hp: 0, max: 80, stacks: [{ element: "fire", hp: 0, max: 80 }] }
      }
    });
    expect(hud?.resources?.shield).toBeUndefined();
  });

  it("clearEmptyShield preserves other resources", () => {
    const base = foldActorHud(golden)!;
    const withSliver = clearEmptyShield({
      ...base,
      resources: { hpSliver: { ratio: 0.5 }, shield: { hp: 0, max: 0, stacks: [] } }
    });
    expect(withSliver.resources?.shield).toBeUndefined();
    expect(withSliver.resources?.hpSliver?.ratio).toBe(0.5);
  });

  it("foldHudFromPayload absent key preserves fallback", () => {
    const fallback = foldActorHud(golden);
    expect(foldHudFromPayload({ ptr: "Z1" }, fallback)).toBe(fallback);
  });

  it("foldHudFromPayload null clears hud", () => {
    expect(foldHudFromPayload({ actorHud: null }, golden as never)).toBeUndefined();
  });

  it("hudSnapshotsEqual detects identical content", () => {
    const a = foldActorHud(golden);
    const b = foldActorHud(golden);
    expect(hudSnapshotsEqual(a, b)).toBe(true);
  });

  it("hudSnapshotsEqual detects shield hp change", () => {
    const a = foldActorHud(golden);
    const b = foldActorHud({
      ...golden,
      resources: { shield: { hp: 40, max: 80, stacks: golden.resources.shield.stacks } }
    });
    expect(hudSnapshotsEqual(a, b)).toBe(false);
  });
});
