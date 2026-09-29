import { describe, expect, it } from "vitest";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { PLAYER_PENDING } from "@/contract/adapt";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { foldConditionSurfaceVm, sumCombatPowerLabel } from "./foldConditionSurfaceVm";

function actor(): ActorView {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
}

function baseSheet() {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant" as const,
    typeId: 3,
    displayName: "Emberling",
    speciesName: "Sunflower",
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: 3400,
    elementTyping: { primary: "fire", secondary: "light" },
    standing: {
      offense: 77,
      survivability: 58,
      control: 36,
      utility: 26,
      economy: 49
    },
    resourcePools: [
      { resourceId: "hp", current: 1240, max: 1800 },
      { resourceId: "stamina", current: 44, max: 60 },
      { resourceId: "hunger", current: 12, max: 40 },
      { resourceId: "spirit", current: 22, max: 40 },
      { resourceId: "qi", current: 8, max: 24 },
      { resourceId: "poise", current: 18, max: 20 }
    ],
    liveStatuses: [] as { statusId: string }[],
    derived: [],
    primary: []
  };
}

describe("foldConditionSurfaceVm", () => {
  it("emits progression, identity, hero, stand in grid order", () => {
    const surface = actorSurfaceFixture();
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: null,
      surface,
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    expect(vm.main.map((m) => m.piece)).toEqual([
      "progression-gauge",
      "actor-identity",
      "cond-hero",
      "stand-row"
    ]);
    const hero = vm.main[2] as { meters?: { poolId: string }[] };
    expect(hero.meters).toHaveLength(surface.resources.length);
  });

  it("uses /sheet xpToNext and standing when available", () => {
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: baseSheet(),
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const prog = vm.main[0] as {
      fillPct?: number | null;
      message?: string | null;
      phase?: string;
      revision?: number;
    };
    expect(prog.fillPct).toBeGreaterThan(0);
    expect(prog.message).toBeNull();
    expect(prog.phase).toBe("ready");
    expect(prog.revision).toBe(1);

    const identity = vm.main[1] as {
      speciesName?: string;
      phaseBadge?: { piece?: string; label?: string };
      elementBadges?: { elementId?: string; themeRef?: { kind: string; id: string } }[];
    };
    expect(identity.speciesName).toBe("Sunflower");
    expect(identity.phaseBadge?.piece).toBe("phase-badge");
    expect(identity.phaseBadge?.label).toBe("ActiveBound");
    expect(identity.elementBadges?.map((e) => e.elementId)).toEqual(["fire", "light"]);
    expect(identity.elementBadges?.[0]?.themeRef).toEqual({ kind: "element", id: "fire" });

    const stand = vm.main[3] as {
      bars?: {
        phase?: string;
        title?: string;
        revision?: number;
        axes?: { id: string; value: number; fillPct: number; paint: string }[];
      };
      radar?: { revision?: number; axes?: { paint: string }[] };
      statusStrip?: { phase?: string; title?: string };
    };
    expect(stand.bars?.phase).toBe("ready");
    expect(stand.bars?.title).toBe("Standing");
    expect(stand.bars?.revision).toBe(1);
    expect(stand.radar?.revision).toBe(1);
    expect(stand.bars?.axes?.find((a) => a.id === "offense")?.value).toBe(77);
    expect(stand.bars?.axes?.find((a) => a.id === "offense")?.fillPct).toBe(100);
    expect(stand.bars?.axes?.find((a) => a.id === "offense")?.paint).toMatch(/^#/);
    expect(stand.statusStrip).toBeUndefined();

    const hero = vm.main[2] as {
      radial?: { hpPct?: number | null; revision?: number };
      meters?: { fillPct?: number | null; icon?: string; themeRef?: unknown; revision?: number }[];
      shield?: unknown;
    };
    expect(hero.radial?.hpPct).toBeGreaterThan(0);
    expect(hero.radial?.revision).toBe(1);
    expect(hero.meters?.every((m) => m.fillPct != null)).toBe(true);
    expect(hero.meters?.every((m) => m.icon && m.themeRef && m.revision === 1)).toBe(true);
    expect(hero.shield).toBeUndefined();
  });

  it("Standing pending never fabricates zero axes", () => {
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: null,
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const standing = vm.main[3] as {
      radar?: { phase?: string; title?: string; axes?: unknown[]; message?: string };
      bars?: { phase?: string; axes?: unknown[] };
    };
    expect(standing.radar?.phase).toBe("pending");
    expect(standing.bars?.phase).toBe("pending");
    expect(standing.radar?.title).toBe("Standing");
    expect(standing.radar?.axes).toBeUndefined();
    expect(standing.bars?.axes).toBeUndefined();
  });

  it("sheet present with liveStatuses empty omits strip (Q3)", () => {
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...baseSheet(), liveStatuses: [] },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const strip = (vm.main[3] as { statusStrip?: unknown }).statusStrip;
    expect(strip).toBeUndefined();
  });

  it("sheet null omits status strip", () => {
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: null,
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const strip = (vm.main[3] as { statusStrip?: unknown }).statusStrip;
    expect(strip).toBeUndefined();
  });

  it("mounts shield-status only when summary current > 0", () => {
    const cold = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...baseSheet(), shieldSummary: null },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    expect((cold.main[2] as { shield?: unknown }).shield).toBeUndefined();

    const zero = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...baseSheet(), shieldSummary: { elementId: "ice", current: 0, max: 2000 } },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    expect((zero.main[2] as { shield?: unknown }).shield).toBeUndefined();
    expect((zero.main[2] as { radial?: { shieldPct?: number | null } }).radial?.shieldPct).toBeNull();

    const hot = foldConditionSurfaceVm({
      data: actor(),
      sheet: {
        ...baseSheet(),
        shieldSummary: { elementId: "ice", current: 1200, max: 2000, stacks: 2 }
      },
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const shield = (hot.main[2] as { shield?: Record<string, unknown> }).shield;
    expect(shield?.piece).toBe("shield-status");
    expect(shield?.current).toBe(1200);
    expect(shield?.elementId).toBe("ice");
    expect(shield?.themeRef).toEqual({ kind: "element", id: "ice" });
    expect((hot.main[2] as { radial?: { shieldPct?: number } }).radial?.shieldPct).toBe(60);
  });

  it("live statuses mount Effects strip without author notes", () => {
    const surface = actorSurfaceFixture();
    const statusId = surface.statuses[0]?.id;
    expect(statusId).toBeTruthy();
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: { ...baseSheet(), liveStatuses: [{ statusId: statusId! }] },
      surface,
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const strip = (vm.main[3] as { statusStrip?: { title?: string; phase?: string } }).statusStrip;
    expect(strip?.phase).toBe("ready");
    expect(strip?.title).toBe("Effects");
  });

  it("copy-surfaces (T11): combat power label is Offense + Survivability + Control only", () => {
    const standing = { offense: 77, survivability: 58, control: 36, utility: 26, economy: 49 };
    expect(sumCombatPowerLabel(standing)).toBe(171);

    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: baseSheet(),
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const stand = vm.main[3] as { combatPowerText?: string | null; bars?: { axes?: { id: string }[] } };
    expect(stand.combatPowerText).toBe("171");
    // Five-axis vector retained for inspect — Utility/Economy still present, just excluded from the label.
    expect(stand.bars?.axes?.map((a) => a.id).sort()).toEqual(
      ["control", "economy", "offense", "survivability", "utility"].sort()
    );
  });

  it("copy-surfaces (T11): Standing pending never fabricates a combat power number", () => {
    const vm = foldConditionSurfaceVm({
      data: actor(),
      sheet: null,
      surface: actorSurfaceFixture(),
      selectedPoolId: "hp",
      availability: "ready",
      revision: 1
    });
    const stand = vm.main[3] as { combatPowerText?: string | null };
    expect(stand.combatPowerText).toBeNull();
  });
});
