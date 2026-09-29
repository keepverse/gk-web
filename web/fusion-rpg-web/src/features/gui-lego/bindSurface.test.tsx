import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { bindSurface } from "./bindSurface";
import { clearPieceRegistryForTests, registerPiece } from "./pieceRegistry";
import { clearRecipeRegistryForTests, registerRecipe } from "./recipeRegistry";
import type { RecipeDocument } from "./types";

const fixtureRecipe: RecipeDocument = {
  surfaceId: "fixture-array",
  root: {
    piece: "surface-shell",
    instanceId: "shell:fx",
    bind: "vm",
    slots: {
      railPrimary: {
        piece: "rail-primary",
        instanceId: "rail:primary",
        bind: "vm.primaryRail",
        slots: {
          chips: {
            $bindArray: "vm.primaryRail.chips",
            piece: "chip",
            instanceIdTemplate: "chip:primary:{id}"
          }
        }
      },
      main: {
        piece: "family-list",
        instanceId: "families:fx",
        bind: "vm.families",
        slots: {
          blocks: {
            $bindArray: "vm.families",
            piece: "family-block",
            instanceIdTemplate: "family:{familyId}",
            slots: {
              rows: {
                $bindArray: "rows",
                piece: "channel-row",
                instanceIdTemplate: "row:{channelId}"
              }
            }
          }
        }
      }
    }
  },
  lifecycleOverlays: {
    loading: { piece: "phase-loading", instanceId: "overlay:loading", bind: "vm.phasePayload" },
    empty: { piece: "phase-empty", instanceId: "overlay:empty", bind: "vm.phasePayload" },
    error: { piece: "phase-error", instanceId: "overlay:error", bind: "vm.phasePayload" }
  }
};

function readyVm() {
  return {
    phase: "ready",
    revision: 3,
    piece: "surface-shell",
    instanceId: "shell:fx",
    primaryRail: {
      piece: "rail-primary",
      instanceId: "rail:primary",
      phase: "ready",
      chips: [
        { piece: "chip", id: "elements", label: "Elements", phase: "ready", selected: true },
        { piece: "chip", id: "status", label: "Status", phase: "ready", selected: false }
      ]
    },
    families: [
      {
        piece: "family-block",
        familyId: "power",
        title: "Power",
        phase: "ready",
        rows: [
          {
            piece: "channel-row",
            channelId: "combat.power.fire",
            phase: "ready",
            title: "Power"
          }
        ]
      }
    ],
    phasePayload: { piece: "phase-loading", phase: "loading", message: "Loading…" }
  };
}

describe("bindSurface", () => {
  beforeEach(() => {
    clearPieceRegistryForTests();
    clearRecipeRegistryForTests();
    registerRecipe(fixtureRecipe);
    for (const id of [
      "surface-shell",
      "rail-primary",
      "chip",
      "family-list",
      "family-block",
      "channel-row",
      "phase-loading",
      "phase-empty",
      "phase-error"
    ]) {
      registerPiece({ pieceId: id, slots: [] });
    }
  });

  afterEach(() => {
    clearPieceRegistryForTests();
    clearRecipeRegistryForTests();
  });

  it("expands $bindArray with instanceIdTemplate", () => {
    const plan = bindSurface(fixtureRecipe, readyVm());
    expect(plan.root).not.toBeNull();
    const chips = plan.root!.slots.railPrimary as import("./types").MountNode;
    const chipNodes = chips.slots.chips as import("./types").MountNode[];
    expect(chipNodes.map((c) => c.instanceId)).toEqual([
      "chip:primary:elements",
      "chip:primary:status"
    ]);
    const list = plan.root!.slots.main as import("./types").MountNode;
    const blocks = list.slots.blocks as import("./types").MountNode[];
    expect(blocks[0]!.instanceId).toBe("family:power");
    const rows = blocks[0]!.slots.rows as import("./types").MountNode[];
    expect(rows[0]!.instanceId).toBe("row:combat.power.fire");
  });

  it("applies lifecycle overlay when phase is loading", () => {
    const vm = {
      ...readyVm(),
      phase: "loading",
      phasePayload: {
        piece: "phase-loading",
        phase: "loading",
        message: "Loading derived…",
        canRetry: false
      }
    };
    const plan = bindSurface(fixtureRecipe, vm);
    expect(plan.root).toBeNull();
    expect(plan.overlay?.pieceId).toBe("phase-loading");
    expect(plan.overlay?.instanceId).toBe("overlay:loading");
    expect(plan.overlay?.payload.message).toBe("Loading derived…");
    expect(plan.overlay?.payload.phase).toBe("loading");
  });

  it("empty phase keeps root and does not attach surface overlay", () => {
    const vm = {
      ...readyVm(),
      phase: "empty",
      phasePayload: { piece: "phase-empty", phase: "empty", message: "Nothing" }
    };
    const plan = bindSurface(fixtureRecipe, vm);
    expect(plan.root).not.toBeNull();
    expect(plan.overlay).toBeNull();
  });

  it("throws when payload.piece mismatches recipe piece", () => {
    const vm = readyVm();
    vm.primaryRail.piece = "chip";
    expect(() => bindSurface(fixtureRecipe, vm)).toThrow(/payload.piece/);
  });

  it("attaches themeResolved from themeRef", () => {
    const vm = readyVm();
    (vm.primaryRail.chips[0] as { themeRef?: { kind: string; id: string } }).themeRef = {
      kind: "element",
      id: "fire"
    };
    const plan = bindSurface(fixtureRecipe, vm);
    const chips = (plan.root!.slots.railPrimary as import("./types").MountNode).slots
      .chips as import("./types").MountNode[];
    expect(chips[0]!.payload.themeResolved?.themeId).toBe("element.fire");
    expect(chips[0]!.payload.themeResolved?.paint.accent).toMatch(/^#/);
  });

  it("resolves shieldThemeRef to ice paint, not fire default", () => {
    const vm = {
      ...readyVm(),
      piece: "surface-shell",
      instanceId: "shell:fx",
      shieldThemeRef: { kind: "element", id: "ice" }
    };
    const plan = bindSurface(fixtureRecipe, vm);
    expect(plan.root!.payload.shieldThemeResolved?.themeId).toBe("element.ice");
    expect(plan.root!.payload.shieldThemeResolved?.paint.accent).not.toMatch(/e0703c/i);
  });
});
