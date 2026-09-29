import { describe, expect, it, vi } from "vitest";
import { LAWN_CELL_STACK_MAX_SPRITES } from "@/ui/lawn/lawnPresentationTokens";
import { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import { layoutGrid } from "./LayoutGridSystem";

function fakeGo() {
  const children = new Map<string, { destroy: ReturnType<typeof vi.fn>; setText?: ReturnType<typeof vi.fn>; setVisible?: ReturnType<typeof vi.fn> }>();
  const go = {
    setVisible: vi.fn(),
    setPosition: vi.fn(),
    setDepth: vi.fn(),
    setScale: vi.fn(),
    getByName: (name: string) => children.get(name) ?? null,
    add: (child: { name?: string; destroy: ReturnType<typeof vi.fn> }) => {
      if (child.name) children.set(child.name, child as never);
    },
    scene: {
      add: {
        circle: () => {
          const pip = {
            name: "boundPip",
            setStrokeStyle: vi.fn().mockReturnThis(),
            setName: vi.fn(function (this: { name: string }, n: string) {
              this.name = n;
              return this;
            }),
            setVisible: vi.fn(),
            destroy: vi.fn()
          };
          return pip;
        },
        text: () => {
          const label = {
            name: "stackOverflow",
            setOrigin: vi.fn().mockReturnThis(),
            setName: vi.fn(function (this: { name: string }, n: string) {
              this.name = n;
              return this;
            }),
            setText: vi.fn(),
            setVisible: vi.fn(),
            destroy: vi.fn()
          };
          return label;
        }
      }
    }
  };
  return go;
}

describe("layoutGrid stackDrawPlan", () => {
  it("hides overflow sprites and paints +K on the last drawn", () => {
    const registry = new PtrEntityRegistry();
    const count = LAWN_CELL_STACK_MAX_SPRITES + 3;
    const gos = Array.from({ length: count }, () => fakeGo());
    gos.forEach((go, i) => {
      registry.set({
        ptr: `p:z:${i}`,
        side: "zombie",
        typeId: 1,
        row: 2,
        col: 3,
        chips: [],
        selected: false,
        go: go as never
      });
    });

    layoutGrid(registry, {} as never, "stack");

    for (let i = 0; i < LAWN_CELL_STACK_MAX_SPRITES; i++) {
      expect(gos[i]!.setVisible).toHaveBeenCalledWith(true);
    }
    for (let i = LAWN_CELL_STACK_MAX_SPRITES; i < count; i++) {
      expect(gos[i]!.setVisible).toHaveBeenCalledWith(false);
    }
    const anchor = gos[LAWN_CELL_STACK_MAX_SPRITES - 1]!;
    const overflow = anchor.getByName("stackOverflow");
    expect(overflow).toBeTruthy();
    expect(overflow!.setText).toHaveBeenCalledWith("+3");
  });

  it("paints Bound pip when instanceId is set", () => {
    const registry = new PtrEntityRegistry();
    const go = fakeGo();
    registry.set({
      ptr: "p:z:bound",
      side: "zombie",
      typeId: 1,
      row: 1,
      col: 1,
      chips: [],
      selected: false,
      instanceId: "creature-1",
      go: go as never
    });

    layoutGrid(registry, {} as never, "stack");

    expect(go.getByName("boundPip")).toBeTruthy();
  });
});
