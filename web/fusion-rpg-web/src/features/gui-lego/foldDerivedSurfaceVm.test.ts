import { describe, expect, it } from "vitest";
import { actorSurfaceFixture, derivedSurfaceFromFixture } from "@/lib/bus/actorSurface";
import { formatDerivedMagnitude } from "./cook/formatDerivedMagnitude";
import { SOURCES_TITLE, UNATTRIBUTED_LABEL } from "./cook/derivedPlayerCopy";
import { foldDerivedSurfaceVm } from "./foldDerivedSurfaceVm";
import { defaultThemeRegistry } from "./themeRegistry";

describe("formatDerivedMagnitude", () => {
  it("formats channel totals without a leading +", () => {
    const m = formatDerivedMagnitude(2847, "GameUnits", { role: "total" });
    expect(m.valueText).toBe("2,847");
    expect(m.valueText.startsWith("+")).toBe(false);
  });

  it("keeps signed delta for contribution lines", () => {
    const m = formatDerivedMagnitude(980, "GameUnits", { role: "delta" });
    expect(m.valueText).toMatch(/^\+9,?80$/);
  });

  it("formats LadderIndex via ladderIndex UnitClass (DC-5)", () => {
    const m = formatDerivedMagnitude(24, "LadderIndex", { role: "total" });
    expect(m.formatterId).toBe("ladderIndex");
    expect(m.valueText).toBe("24");
    expect(m.valueText.startsWith("+")).toBe(false);
  });
});

describe("foldDerivedSurfaceVm", () => {
  it("builds chips, families, and unsigned total valueText", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "Emberling", level: 24, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "combat.power.fire",
          displayName: "Power",
          reading: "Fire power",
          composeKind: "FlatSum",
          value: 2847,
          unitClass: "GameUnits",
          renderState: "active",
          contributions: [
            { sourceId: "equip:muzzle:ember", label: "Equip", op: "Flat", value: 980 },
            { sourceId: "aptitude.Might", label: "Might", op: "Flat", value: 185 }
          ]
        }
      ],
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: true,
        selectedChannelId: "combat.power.fire"
      },
      availability: "ready",
      revision: 1
    });

    expect(vm.phase).toBe("ready");
    expect(vm.primaryRail.chips.map((c) => c.id)).toEqual([
      "elements",
      "status",
      "resources",
      "other"
    ]);
    expect(vm.primaryRail.chips.some((c) => c.id === "elements" && c.selected)).toBe(true);
    expect(vm.variantRail.chips.some((c) => c.id === "fire")).toBe(true);
    const fireChip = vm.variantRail.chips.find((c) => c.id === "fire");
    expect(fireChip?.themeResolved?.glyphDefault).toBe("flame");
    expect(fireChip?.themeResolved?.vfx?.select).toBe("vfx.ember-pulse");
    expect((vm as { identity?: unknown }).identity).toBeUndefined();
    const row = vm.families
      .flatMap((f) => f.rows as { channelId: string; valueText: string; selected: boolean }[])
      .find((r) => r.channelId === "combat.power.fire");
    expect(row?.selected).toBe(true);
    expect(row?.valueText).toBe("2,847");
    expect(vm.inspect.hero.valueText).toBe("2,847");
    const bars = vm.inspect.stack.bars as { valueText: string }[];
    expect(bars[0]?.valueText.startsWith("+")).toBe(true);
    expect(vm.inspect.donut.slices).toBeTruthy();
    expect((vm.inspect.donut.slices as { paint: string }[])[0]?.paint).toMatch(/^#/);
    expect(vm.familyList.count).toBeGreaterThan(0);
    expect(String(vm.inspect.sources.title)).toBe(SOURCES_TITLE);
    expect(String(vm.inspect.sources.title)).not.toMatch(/GG-49/);
    const meta = vm.inspect.meta.sentences as string[];
    expect(meta.some((s) => s.startsWith("Join:"))).toBe(false);
    expect(meta.some((s) => /Sources add together/.test(s))).toBe(true);
  });

  it("D4: hides default only; no-producer stays visible", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "combat.power.fire",
          value: 0,
          composeKind: "FlatSum",
          unitClass: "GameUnits",
          defaultValue: 0,
          renderState: "default",
          contributions: []
        }
      ],
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: false,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const fireRows = vm.families.flatMap((f) =>
      (f.rows as { channelId: string }[]).map((r) => r.channelId)
    );
    expect(fireRows).not.toContain("combat.power.fire");

    const ice = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "combat.power.ice",
          value: 0,
          composeKind: "FlatSum",
          unitClass: "GameUnits",
          renderState: "no-producer",
          contributions: []
        }
      ],
      ui: {
        tabId: "elements",
        variantId: "ice",
        query: "",
        showUnchanged: false,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const iceRows = ice.families.flatMap((f) =>
      (f.rows as { channelId: string }[]).map((r) => r.channelId)
    );
    expect(iceRows).toContain("combat.power.ice");
  });

  it("shows unattributed contribution when SourceId empty (DC-8)", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "combat.power.fire",
          value: 50,
          composeKind: "FlatSum",
          unitClass: "GameUnits",
          renderState: "active",
          contributions: [{ sourceId: "", label: "", op: "Flat", value: 50 }]
        }
      ],
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: true,
        selectedChannelId: "combat.power.fire"
      },
      availability: "ready"
    });
    const items = vm.inspect.sources.items as { label: string; unattributed?: boolean }[];
    expect(items.some((i) => i.label === UNATTRIBUTED_LABEL && i.unattributed)).toBe(true);
  });

  it("accepts injected themeRegistry (D5)", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    let hits = 0;
    const registry = {
      resolve: (ref: Parameters<typeof defaultThemeRegistry.resolve>[0]) => {
        hits += 1;
        return defaultThemeRegistry.resolve(ref);
      },
      lookup: defaultThemeRegistry.lookup
    };
    foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      themeRegistry: registry,
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    expect(hits).toBeGreaterThan(0);
  });

  it("OTHER action chips use action-category theme packs (DC-7)", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      ui: {
        tabId: "other",
        variantId: "attack",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const attack = vm.variantRail.chips.find((c) => c.id === "attack");
    expect(attack?.themeRef).toEqual({ kind: "action-category", id: "attack" });
    expect(attack?.themeResolved?.themeId).toBe("action-category.attack");
    expect(vm.primaryRail.chips.find((c) => c.id === "elements")?.themeResolved?.themeId).toBe(
      "cook-tab.elements"
    );
  });

  it("maps loading availability to phase loading", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "loading"
    });
    expect(vm.phase).toBe("loading");
    expect(vm.phasePayload.message).toMatch(/Loading/);
  });

  it("maps error availability to phase error with retry", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "error"
    });
    expect(vm.phase).toBe("error");
    expect(vm.phasePayload.canRetry).toBe(true);
    expect(vm.phasePayload.retryLabel).toBe("Retry");
  });

  it("zero visible rows → empty phase and familyList.count 0", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [],
      ui: {
        tabId: "elements",
        variantId: "fire",
        query: "zzz-no-match",
        showUnchanged: false,
        selectedChannelId: null
      },
      availability: "ready"
    });
    expect(vm.phase).toBe("empty");
    expect(vm.familyList.count).toBe(0);
    expect(vm.families).toHaveLength(0);
  });

  it("resource variants resolve resource theme packs", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      ui: {
        tabId: "resources",
        variantId: "hp",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const hp = vm.variantRail.chips.find((c) => c.id === "hp");
    expect(hp?.themeResolved?.themeId).toBe("resource.hp");
    expect(hp?.themeResolved?.glyphDefault).toBe("heart");
    expect(vm.themeResolved?.themeId).toBe("resource.hp");
  });

  it("status rail cooks Omni + L2b category chips (D1)", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      statuses: surface.statuses,
      ui: {
        tabId: "status",
        variantId: "dot",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const ids = vm.variantRail.chips.map((c) => c.id);
    expect(ids).toEqual(["omni", "dot", "cc", "contagion"]);
    expect(vm.variantRail.ariaLabel).toBe("Status catalog variants");
    const dot = vm.variantRail.chips.find((c) => c.id === "dot");
    expect(dot?.themeResolved?.glyphDefault).toBeTruthy();
  });

  it("OTHER Shared lists expand:none only; Attack lists action-category only", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const shared = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "progression.bonus.arm1",
          displayName: "Bonus arm1",
          reading: "Flat",
          composeKind: "FlatSum",
          value: 691,
          contributions: [{ sourceId: "aptitude.Might", label: "Aptitude", op: "Flat", value: 691 }]
        },
        {
          channelId: "skill.cooldown.attack",
          displayName: "Skill cooldown",
          reading: "Cd",
          composeKind: "FlatSum",
          value: 10,
          contributions: []
        }
      ],
      ui: {
        tabId: "other",
        variantId: null,
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const sharedChipIds = shared.variantRail.chips.map((c) => c.id);
    expect(sharedChipIds[0]).toBe("shared");
    expect(sharedChipIds).toContain("attack");
    const sharedRows = shared.families.flatMap((f) =>
      (f.rows as { channelId: string }[]).map((r) => r.channelId)
    );
    expect(sharedRows).toContain("progression.bonus.arm1");
    expect(sharedRows.some((id) => id.startsWith("skill."))).toBe(false);
    expect(shared.families[0]?.hint).toBe("other · shared");

    const attack = foldDerivedSurfaceVm({
      identity: { displayName: "X", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels: [
        {
          channelId: "progression.bonus.arm1",
          displayName: "Bonus arm1",
          reading: "Flat",
          composeKind: "FlatSum",
          value: 691,
          contributions: []
        },
        {
          channelId: "skill.cooldown.attack",
          displayName: "Skill cooldown",
          reading: "Cd",
          composeKind: "FlatSum",
          value: 10,
          contributions: []
        }
      ],
      ui: {
        tabId: "other",
        variantId: "attack",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready"
    });
    const attackRows = attack.families.flatMap((f) =>
      (f.rows as { channelId: string }[]).map((r) => r.channelId)
    );
    expect(attackRows).toContain("skill.cooldown.attack");
    expect(attackRows).toContain("skill.effectiveness.attack");
    expect(attackRows).not.toContain("progression.bonus.arm1");
  });
});
