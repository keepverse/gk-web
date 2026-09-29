import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ActorHudSnapshot } from "@/features/lawn/lawnViewModel";

vi.mock("phaser", () => ({
  default: {
    Geom: { Rectangle: { Contains: () => false } },
    Loader: { Events: { COMPLETE: "complete" } }
  }
}));

import { syncOccupantBandB } from "./SyncFromModelSystem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenActorHud = JSON.parse(
  readFileSync(join(__dirname, "../../../e2e/fixtures/actor-hud-golden.json"), "utf8")
) as ActorHudSnapshot;

type MockGo = {
  name: string;
  text?: string;
  destroy: () => void;
  setName: (n: string) => MockGo;
  setStrokeStyle: () => MockGo;
  setOrigin: () => MockGo;
  setScrollFactor?: () => MockGo;
  getByName?: (n: string) => MockGo | null;
  add?: (child: MockGo) => MockGo;
  list?: MockGo[];
};

function makeMockContainer(children: MockGo[] = []): MockGo {
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
  return container;
}

function makeMockScene() {
  return {
    add: {
      container: () => makeMockContainer(),
      rectangle: () => {
        const rect: MockGo = {
          name: "",
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
        return rect;
      },
      text: (_x: number, _y: number, text: string) => {
        const node: MockGo = {
          name: "",
          text,
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
        return node;
      },
      circle: () => {
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
        return node;
      }
    }
  };
}

describe("syncOccupantBandB", () => {
  it("setHudDisplay_no_chipRow_when_hud", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    syncOccupantBandB(scene as never, container as never, {
      hud: goldenActorHud,
      statusChips: ["butter"]
    });

    expect(container.getByName?.("hudStack")).not.toBeNull();
    expect(container.getByName?.("chipRow")).toBeNull();
  });

  it("syncOccupantBandB_keeps_chipRow_without_hud", () => {
    const scene = makeMockScene();
    const container = makeMockContainer();
    syncOccupantBandB(scene as never, container as never, {
      hud: undefined,
      statusChips: ["butter"]
    });

    expect(container.getByName?.("hudStack")).toBeNull();
    expect(container.getByName?.("chipRow")).not.toBeNull();
  });
});
