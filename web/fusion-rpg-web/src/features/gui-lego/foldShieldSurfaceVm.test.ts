import { describe, expect, it } from "vitest";
import type { ActorShieldLayerDto } from "@/lib/bus/aura";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { foldShieldSurfaceVm } from "./foldShieldSurfaceVm";
import { joinShieldOmniRows, listShieldOmniChannelIds } from "./joinShieldOmniRows";
import { shieldPriorityLabel } from "./shieldPriorityLabel";

const families = actorSurfaceFixture().families;

function layer(partial: Partial<ActorShieldLayerDto> & Pick<ActorShieldLayerDto, "shieldId">): ActorShieldLayerDto {
  return {
    elementId: "ice",
    current: 40,
    max: 40,
    priority: 30,
    sourceId: "aura:ice",
    isInnate: false,
    ...partial
  };
}

describe("shieldPriorityLabel", () => {
  it("maps aura / skill / innate fiction", () => {
    expect(shieldPriorityLabel(30)).toBe("Aura");
    expect(shieldPriorityLabel(20)).toBe("Skill");
    expect(shieldPriorityLabel(10)).toBe("Innate");
    expect(shieldPriorityLabel(20, true)).toBe("Innate");
  });
});

describe("joinShieldOmniRows", () => {
  it("lists cook shield omni channel ids", () => {
    const ids = listShieldOmniChannelIds(families);
    expect(ids).toEqual([
      "combat.shield.capacity.omni",
      "combat.shield.toughness.omni",
      "combat.shield.pen.omni",
      "combat.shield.regen.omni"
    ]);
  });

  it("marks missing channels Pending", () => {
    const rows = joinShieldOmniRows({ families, channels: [] });
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.valueText === "Pending")).toBe(true);
    expect(rows[0]?.phase).toBe("pending");
  });

  it("formats live omni magnitudes", () => {
    const rows = joinShieldOmniRows({
      families,
      channels: [
        {
          channelId: "combat.shield.capacity.omni",
          displayName: "Shield capacity",
          reading: "Extra HP",
          composeKind: "FlatSum",
          value: 120,
          contributions: [],
          unitClass: "GameUnits",
          defaultValue: 0,
          cap: null,
          renderState: "active"
        }
      ]
    });
    const cap = rows.find((r) => r.channelId === "combat.shield.capacity.omni");
    expect(cap?.phase).toBe("ready");
    expect(cap?.valueText).not.toBe("Pending");
    expect(String(cap?.valueText)).toMatch(/120/);
  });
});

describe("foldShieldSurfaceVm", () => {
  it("Pending: no Empty layer wells, emptySlots 0, pending chrome", () => {
    const vm = foldShieldSurfaceVm({
      layers: [],
      families,
      availability: "pending"
    });
    expect(vm.phase).toBe("pending");
    expect(vm.stack.emptySlots).toBe(0);
    expect(vm.stack.segments).toEqual([]);
    expect(JSON.stringify(vm)).not.toMatch(/Empty layer/i);
    expect(JSON.stringify(vm)).not.toMatch(/Ward/i);
    expect(vm.stack.message).toMatch(/Shield details aren't ready/i);
  });

  it("Hot-empty: ready stack with 3 dashed slots, empty inspect", () => {
    const vm = foldShieldSurfaceVm({
      layers: [],
      summary: null,
      families,
      availability: "ready"
    });
    expect(vm.phase).toBe("ready");
    expect(vm.stack.phase).toBe("ready");
    expect(vm.stack.segments).toEqual([]);
    expect(vm.stack.emptySlots).toBe(3);
    expect(vm.inspect.phase).toBe("empty");
    expect(vm.omni.length).toBe(4);
    expect(JSON.stringify(vm)).not.toMatch(/Empty layer/i);
  });

  it("N-segments: 1 layer → 1 segment + 2 empty slots, Aura label", () => {
    const vm = foldShieldSurfaceVm({
      layers: [layer({ shieldId: "aura-1", priority: 30 })],
      summary: { elementId: "ice", current: 40, max: 40, stacks: 1 },
      families,
      availability: "ready"
    });
    const segments = vm.stack.segments as Record<string, unknown>[];
    expect(segments).toHaveLength(1);
    expect(vm.stack.emptySlots).toBe(2);
    expect(segments[0]?.priorityLabel).toBe("Aura");
    expect(vm.inspect.piece).toBe("shield-layer-inspect");
    expect(vm.inspect.phase).toBe("ready");
  });

  it("N-segments: 2 layers keep drain order + Skill/Innate labels", () => {
    const vm = foldShieldSurfaceVm({
      layers: [
        layer({ shieldId: "aura-1", priority: 30, current: 40, max: 40 }),
        layer({
          shieldId: "skill-1",
          priority: 20,
          elementId: "fire",
          current: 60,
          max: 60,
          sourceId: "skill:fire"
        })
      ],
      summary: { elementId: "ice", current: 100, max: 100, stacks: 2 },
      families,
      availability: "ready"
    });
    const segments = vm.stack.segments as Record<string, unknown>[];
    expect(segments.map((s) => s.shieldId)).toEqual(["aura-1", "skill-1"]);
    expect(segments.map((s) => s.priorityLabel)).toEqual(["Aura", "Skill"]);
    expect(vm.stack.emptySlots).toBe(1);
  });

  it("N-segments: 3 layers → emptySlots 0", () => {
    const vm = foldShieldSurfaceVm({
      layers: [
        layer({ shieldId: "a", priority: 30 }),
        layer({ shieldId: "b", priority: 20, elementId: "fire" }),
        layer({
          shieldId: "c",
          priority: 10,
          elementId: null,
          isInnate: true,
          sourceId: "innate:body"
        })
      ],
      families,
      availability: "ready"
    });
    expect((vm.stack.segments as unknown[]).length).toBe(3);
    expect(vm.stack.emptySlots).toBe(0);
    const segments = vm.stack.segments as Record<string, unknown>[];
    expect(segments[2]?.priorityLabel).toBe("Innate");
  });

  it("broken layer keeps empty fill slot", () => {
    const vm = foldShieldSurfaceVm({
      layers: [layer({ shieldId: "broke", current: 0, max: 80, broken: true })],
      families,
      availability: "ready"
    });
    const seg = (vm.stack.segments as Record<string, unknown>[])[0]!;
    expect(seg.broken).toBe(true);
    expect(seg.fillPct).toBe(0);
    expect(vm.stack.emptySlots).toBe(2);
  });

  it("closed bus events live on recipe host (select + retry documented)", () => {
    // Fold does not own the bus; surface-vm exposes select via segment shieldId for host wiring.
    const vm = foldShieldSurfaceVm({
      layers: [layer({ shieldId: "pick-me" })],
      families,
      availability: "ready",
      selectedShieldId: "pick-me"
    });
    const seg = (vm.stack.segments as Record<string, unknown>[])[0]!;
    expect(seg.selected).toBe(true);
    expect(vm.phasePayload.retryEvent ?? "shield.retry").toBe("shield.retry");
  });
});
