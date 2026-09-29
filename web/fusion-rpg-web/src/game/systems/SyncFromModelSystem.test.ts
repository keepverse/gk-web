import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ActorHudSnapshot } from "@/features/lawn/lawnViewModel";

// `sceneArtState` (reached through ActorHudDisplay) needs `Phaser.Loader.Events.COMPLETE` as a
// value, so the module graph now contains the real engine, which cannot initialise under jsdom.
// Shaped exactly like the shim in `syncOccupantBandB.test.ts` in this directory.
vi.mock("phaser", () => ({
  default: {
    Geom: { Rectangle: { Contains: () => false } },
    Loader: { Events: { COMPLETE: "complete", FILE_LOAD_ERROR: "fileloaderror" } }
  }
}));

import {
  layoutHudRows,
  setHudDisplay,
  shieldSegmentWidths,
  shouldShowHud,
  shouldShowShield
} from "./ActorHudDisplay";
import { CELL_H } from "../gridMath";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenActorHud = JSON.parse(
  readFileSync(join(__dirname, "../../../e2e/fixtures/actor-hud-golden.json"), "utf8")
) as ActorHudSnapshot;

type MockGo = {
  name: string;
  x?: number;
  y?: number;
  text?: string;
  width?: number;
  destroy: () => void;
  setName: (n: string) => MockGo;
  setStrokeStyle: () => MockGo;
  setOrigin: () => MockGo;
  setScrollFactor?: () => MockGo;
  getByName?: (n: string) => MockGo | null;
  add?: (child: MockGo) => MockGo;
  list?: MockGo[];
};

function makeMockContainer(x = 0, y = 0, children: MockGo[] = []): MockGo {
  const kids = children;
  const container: MockGo = {
    name: "",
    destroy: () => {
      container.name = "__destroyed__";
    },
    setName(n: string) {
      container.name = n;
      return container;
    },
    setStrokeStyle() {
      return container;
    },
    setOrigin() {
      return container;
    },
    setScrollFactor() {
      return container;
    },
    getByName(n: string) {
      if (container.name === n && container.name !== "__destroyed__") return container;
      for (const child of kids) {
        if (child.name === "__destroyed__") continue;
        if (child.name === n) return child;
        const nested = child.getByName?.(n);
        if (nested && nested.name !== "__destroyed__") return nested;
      }
      return null;
    },
    add(child: MockGo) {
      kids.push(child);
      return container;
    },
    list: kids
  };
  container.x = x;
  container.y = y;
  return container;
}

function makeMockScene() {
  return {
    add: {
      container: (x?: number, y?: number, ch?: MockGo[]) => makeMockContainer(x ?? 0, y ?? 0, ch ?? []),
      rectangle: (x: number, y: number, w: number, _h: number) => {
        const rect: MockGo = {
          name: "",
          width: w,
          destroy: () => {
            rect.name = "__destroyed__";
          },
          setName(n: string) {
            rect.name = n;
            return rect;
          },
          setStrokeStyle() {
            return rect;
          },
          setOrigin() {
            return rect;
          }
        };
        rect.x = x;
        rect.y = y;
        return rect;
      },
      text: (x: number, y: number, text: string) => {
        const node: MockGo = {
          name: "",
          destroy: () => {
            node.name = "__destroyed__";
          },
          setName(n: string) {
            node.name = n;
            return node;
          },
          setStrokeStyle() {
            return node;
          },
          setOrigin() {
            return node;
          }
        };
        node.x = x;
        node.y = y;
        node.text = text;
        return node;
      },
      circle: (x: number, y: number, _r: number, _fill: number, _alpha: number) => {
        const node: MockGo = {
          name: "",
          destroy: () => {
            node.name = "__destroyed__";
          },
          setName(n: string) {
            node.name = n;
            return node;
          },
          setStrokeStyle() {
            return node;
          },
          setOrigin() {
            return node;
          }
        };
        node.x = x;
        node.y = y;
        return node;
      }
    }
  };
}

describe("ActorHudDisplay pure helpers", () => {
  it("layoutHudRows mirrors tuning row offsets", () => {
    const rows = layoutHudRows(CELL_H);
    expect(rows.identityY).toBeCloseTo(-CELL_H * 0.42);
    expect(rows.resourcesY).toBeCloseTo(-CELL_H * 0.28);
    expect(rows.statusesY).toBeCloseTo(-CELL_H * 0.14);
  });

  it("shieldSegmentWidths_fire_stack_nonzero", () => {
    const widths = shieldSegmentWidths([{ hp: 50, max: 80 }], 40);
    expect(widths[0]).toBeGreaterThan(0);
  });

  it("shieldSegmentWidths_dual_stack", () => {
    const widths = shieldSegmentWidths(
      [
        { hp: 30, max: 50 },
        { hp: 20, max: 30 }
      ],
      40
    );
    expect(widths[0]).toBeGreaterThan(0);
    expect(widths[1]).toBeGreaterThan(0);
    expect(widths[0]! + widths[1]!).toBeLessThanOrEqual(40);
  });

  it("shouldShowHud is false for undefined", () => {
    expect(shouldShowHud(undefined)).toBe(false);
    expect(shouldShowHud(goldenActorHud)).toBe(true);
  });

  it("shouldShowShield_false_when_hp_zero", () => {
    expect(
      shouldShowShield({
        hp: 0,
        max: 80,
        stacks: [{ element: "fire", hp: 0, max: 80 }]
      })
    ).toBe(false);
    expect(
      shouldShowShield({
        hp: 50,
        max: 80,
        stacks: [{ element: "fire", hp: 50, max: 80 }]
      })
    ).toBe(true);
  });
});

describe("setHudDisplay", () => {
  it("setHudDisplay_shield_and_statuses", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    setHudDisplay(scene as never, container as never, goldenActorHud);

    expect(container.getByName?.("hudStack")).not.toBeNull();
    expect(container.getByName?.("hudIdentity")).not.toBeNull();
    expect(container.getByName?.("hudShield")).not.toBeNull();
    expect(container.getByName?.("hudStatus0")).not.toBeNull();
    expect(container.getByName?.("hudStatus1")).not.toBeNull();
    const shield = container.getByName?.("hudShield");
    expect(shield?.width).toBeGreaterThan(0);
  });

  it("setHudDisplay_hides_shield_when_hp_zero", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    const zeroHp: ActorHudSnapshot = {
      ...goldenActorHud,
      resources: {
        shield: {
          hp: 0,
          max: 80,
          stacks: [{ element: "fire", hp: 0, max: 80 }]
        }
      }
    };
    setHudDisplay(scene as never, container as never, zeroHp);

    expect(container.getByName?.("hudShield")).toBeNull();
    expect(container.getByName?.("hudIdentity")).not.toBeNull();
    expect(container.getByName?.("hudStatus0")).not.toBeNull();
  });

  it("setHudDisplay_status_strip_capped", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    const capped: ActorHudSnapshot = {
      ...goldenActorHud,
      statuses: [
        { id: "command", cc: false, magnitudeBand: "low" },
        { id: "expose", cc: false, magnitudeBand: "mid" },
        { id: "spark", cc: false, magnitudeBand: "low" },
        { id: "freeze", cc: false, magnitudeBand: "high" }
      ],
      overflow: { statusCount: 2 }
    };
    setHudDisplay(scene as never, container as never, capped);

    expect(container.getByName?.("hudStatus0")).not.toBeNull();
    expect(container.getByName?.("hudStatus1")).not.toBeNull();
    expect(container.getByName?.("hudStatus2")).not.toBeNull();
    expect(container.getByName?.("hudStatus3")).toBeNull();
    const overflow = container.getByName?.("hudOverflow");
    expect(overflow?.text).toBe("+2");
  });

  it("setHudDisplay_clears_on_undefined", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    setHudDisplay(scene as never, container as never, goldenActorHud);
    expect(container.getByName?.("hudStack")).not.toBeNull();

    setHudDisplay(scene as never, container as never, undefined);
    expect(container.getByName?.("hudStack")).toBeNull();
    expect(container.getByName?.("hudShield")).toBeNull();
    expect(container.getByName?.("hudStatus0")).toBeNull();
  });
});
