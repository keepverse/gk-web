/**
 * DC-4 six-state goldens + DC-10 volume guards.
 * Spec: derived-render-states · derived-volume-guard
 */
import { describe, expect, it } from "vitest";
import { actorSurfaceFixture, derivedSurfaceFromFixture } from "@/lib/bus/actorSurface";
import {
  isUnchangedState,
  resolveDerivedRenderState,
  type LiveChannelView
} from "./derivedCook";
import { foldDerivedSurfaceVm } from "../foldDerivedSurfaceVm";

function live(
  channelId: string,
  value: number,
  contributions: LiveChannelView["contributions"] = [],
  extra: Partial<LiveChannelView> = {}
): LiveChannelView {
  return {
    channelId,
    value,
    displayName: channelId,
    reading: "",
    composeKind: "FlatSum",
    contributions,
    present: true,
    ...extra
  };
}

describe("derivedCook six-state goldens (DC-4)", () => {
  it("golden:status.resist.dot@cap → capped", () => {
    expect(
      resolveDerivedRenderState(
        "status.resist.dot",
        live(
          "status.resist.dot",
          0.95,
          [{ sourceId: "tree.x", label: "Tree", op: "Increased", value: 0.95 }],
          { cap: 0.95, renderState: "capped" }
        ),
        "categoryResistCap"
      )
    ).toBe("capped");
  });

  it("golden:status.resist.omni@default → default", () => {
    expect(
      resolveDerivedRenderState(
        "status.resist.omni",
        live("status.resist.omni", 0, [], { cap: null, defaultValue: 0, renderState: "default" }),
        null
      )
    ).toBe("default");
  });

  it("golden:progression.power → stub", () => {
    expect(
      resolveDerivedRenderState("progression.power", live("progression.power", 1), null)
    ).toBe("stub");
  });

  it("golden:progression.bonus.arm1 → no-producer", () => {
    expect(resolveDerivedRenderState("progression.bonus.arm1", undefined, null)).toBe(
      "no-producer"
    );
  });

  it("golden:turn.moveSpeed → unregistered", () => {
    expect(resolveDerivedRenderState("turn.moveSpeed", undefined, null)).toBe("unregistered");
  });

  it("golden:combat.power.fire@live → active", () => {
    expect(
      resolveDerivedRenderState(
        "combat.power.fire",
        live(
          "combat.power.fire",
          100,
          [{ sourceId: "aptitude.Might", label: "Might", op: "Flat", value: 100 }],
          { renderState: "active" }
        ),
        null
      )
    ).toBe("active");
  });

  it("D4: show-unchanged hides default only", () => {
    expect(isUnchangedState("default")).toBe(true);
    expect(isUnchangedState("no-producer")).toBe(false);
    expect(isUnchangedState("unregistered")).toBe(false);
    expect(isUnchangedState("active")).toBe(false);
  });
});

describe("volume guards (DC-10 / G6)", () => {
  it("volume:current expands without throw; omni not dropped", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const sheetChannels = surface.families.flatMap((f) => {
      if (f.expand === "none") {
        return [
          {
            channelId: f.family,
            value: 0,
            displayName: f.displayName,
            reading: f.reading,
            composeKind: f.compose,
            unitClass: f.unitClass,
            defaultValue: 0,
            cap: null,
            renderState: "default" as const,
            contributions: [] as { sourceId: string; label: string; op: string; value: number }[]
          }
        ];
      }
      if (f.expand === "element") {
        return surface.elements.map((el) => ({
          channelId: `${f.family}.${el.id}`,
          value: el.id === "fire" ? 10 : 0,
          displayName: f.displayName,
          reading: f.reading,
          composeKind: f.compose,
          unitClass: f.unitClass,
          defaultValue: 0,
          cap: null as number | null,
          renderState: (el.id === "fire" ? "active" : "default") as "active" | "default",
          contributions:
            el.id === "fire"
              ? [{ sourceId: "equip:x", label: "Equip", op: "Flat", value: 10 }]
              : []
        }));
      }
      if (f.expand === "status-category" || f.expand === "status-id") {
        return ["omni", "dot", "cc", "contagion"].map((v) => ({
          channelId: `${f.family}.${v}`,
          value: 0,
          displayName: f.displayName,
          reading: f.reading,
          composeKind: f.compose,
          unitClass: f.unitClass,
          defaultValue: 0,
          cap: v === "omni" ? null : 0.95,
          renderState: "default" as const,
          contributions: [] as { sourceId: string; label: string; op: string; value: number }[]
        }));
      }
      if (f.expand === "resource") {
        return surface.resources.map((r) => ({
          channelId: `${f.family}.${r.id}`,
          value: 0,
          displayName: f.displayName,
          reading: f.reading,
          composeKind: f.compose,
          unitClass: f.unitClass,
          defaultValue: 0,
          cap: null as number | null,
          renderState: "default" as const,
          contributions: [] as { sourceId: string; label: string; op: string; value: number }[]
        }));
      }
      if (f.expand === "action-category") {
        return ["attack", "defense", "support", "movement", "status"].map((v) => ({
          channelId: `${f.family}.${v}`,
          value: 0,
          displayName: f.displayName,
          reading: f.reading,
          composeKind: f.compose,
          unitClass: f.unitClass,
          defaultValue: 0,
          cap: null as number | null,
          renderState: "default" as const,
          contributions: [] as { sourceId: string; label: string; op: string; value: number }[]
        }));
      }
      return [];
    });

    expect(sheetChannels.length).toBeGreaterThan(200);

    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "Volume", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      statuses: surface.statuses,
      sheetChannels,
      ui: {
        tabId: "status",
        variantId: "omni",
        query: "",
        showUnchanged: true,
        selectedChannelId: null
      },
      availability: "ready",
      revision: 1
    });

    expect(vm.phase).toBe("ready");
    const rowIds = vm.families.flatMap((f) =>
      (f.rows as { channelId: string }[]).map((r) => r.channelId)
    );
    expect(rowIds.some((id) => id.endsWith(".omni"))).toBe(true);
    expect(vm.inspect.hero).toBeTruthy();
  });

  it("volume:stress500 fold completes; selection/inspect defined", () => {
    const surface = actorSurfaceFixture();
    const cook = derivedSurfaceFromFixture(surface);
    const sheetChannels = Array.from({ length: 500 }, (_, i) => ({
      channelId: i === 0 ? "combat.power.fire" : `stress.channel.${i}`,
      value: i === 0 ? 42 : 0,
      displayName: `Stress ${i}`,
      reading: "stress",
      composeKind: "FlatSum",
      unitClass: "GameUnits",
      defaultValue: 0,
      cap: null as number | null,
      renderState: (i === 0 ? "active" : "default") as "active" | "default",
      contributions:
        i === 0
          ? [{ sourceId: "equip:x", label: "Equip", op: "Flat", value: 42 }]
          : ([] as { sourceId: string; label: string; op: string; value: number }[])
    }));

    const vm = foldDerivedSurfaceVm({
      identity: { displayName: "Stress", level: 1, side: "plant" },
      cookTabs: cook.tabs,
      elements: surface.elements,
      sheetChannels,
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

    expect(vm.selectedChannelId).toBe("combat.power.fire");
    expect(vm.inspect.phase).toBe("ready");
    expect(vm.inspect.hero.valueText).toBeTruthy();
    // Not a live FPS claim — unit/contract scope only (G6).
  });
});
