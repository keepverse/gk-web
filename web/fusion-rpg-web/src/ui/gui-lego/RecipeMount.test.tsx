import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { clearPieceRegistryForTests, getPiece, registerPiece } from "@/features/gui-lego/pieceRegistry";
import { createSurfaceBus } from "@/features/gui-lego/createSurfaceBus";
import type { RecipeDocument } from "@/features/gui-lego/types";
import { RecipeMount } from "./RecipeMount";
import { registerDerivedPieces, resetDerivedPiecesRegistrationFlagForTests } from "./pieces/register";

describe("RecipeMount", () => {
  beforeEach(() => {
    clearPieceRegistryForTests();
    registerPiece({
      pieceId: "surface-shell",
      slots: ["railPrimary"],
      factory: ({ slots }) => (
        <div className="console" data-testid="fx-console">
          {slots.railPrimary}
        </div>
      )
    });
    registerPiece({
      pieceId: "rail-primary",
      slots: ["chips"],
      factory: ({ slots }) => (
        <div className="rail-primary cat-bar" role="tablist" data-testid="fx-rail">
          {slots.chips}
        </div>
      )
    });
    registerPiece({
      pieceId: "chip",
      slots: [],
      factory: ({ payload }) => (
        <button type="button" role="tab" className="chip" data-instance={payload.instanceId}>
          {String(payload.label ?? "")}
        </button>
      )
    });
    registerPiece({
      pieceId: "phase-loading",
      slots: [],
      factory: ({ payload }) => (
        <div className="phase phase-loading" data-testid="fx-overlay">
          {String(payload.message ?? "")}
        </div>
      )
    });
  });

  afterEach(() => clearPieceRegistryForTests());

  it("renders chips as direct children of rail (no contents wrapper)", () => {
    const recipe: RecipeDocument = {
      surfaceId: "fx-dom",
      root: {
        piece: "surface-shell",
        instanceId: "shell",
        bind: "vm",
        slots: {
          railPrimary: {
            piece: "rail-primary",
            instanceId: "rail",
            bind: "vm.primaryRail",
            slots: {
              chips: {
                $bindArray: "vm.primaryRail.chips",
                piece: "chip",
                instanceIdTemplate: "chip:{id}"
              }
            }
          }
        }
      }
    };
    const vm = {
      phase: "ready",
      revision: 1,
      piece: "surface-shell",
      primaryRail: {
        piece: "rail-primary",
        phase: "ready",
        chips: [
          { piece: "chip", id: "a", label: "A", phase: "ready" },
          { piece: "chip", id: "b", label: "B", phase: "ready" }
        ]
      }
    };
    const plan = bindSurface(recipe, vm);
    const bus = createSurfaceBus();
    const { container } = render(<RecipeMount plan={plan} bus={bus} />);
    const rail = container.querySelector(".rail-primary");
    expect(rail).toBeTruthy();
    const kids = [...(rail?.children ?? [])];
    expect(kids.every((el) => el.tagName === "BUTTON")).toBe(true);
    expect(container.querySelector(".contents")).toBeNull();
  });

  it("mounts overlay when root is null", () => {
    const plan = {
      root: null,
      overlay: {
        instanceId: "overlay:loading",
        pieceId: "phase-loading",
        payload: {
          piece: "phase-loading",
          instanceId: "overlay:loading",
          phase: "loading" as const,
          message: "Please wait"
        },
        slots: {}
      },
      revision: 1
    };
    const bus = createSurfaceBus();
    render(<RecipeMount plan={plan} bus={bus} />);
    expect(screen.getByTestId("fx-overlay")).toHaveTextContent("Please wait");
  });

  it("prefers root over overlay when both present", () => {
    const plan = {
      root: {
        instanceId: "shell",
        pieceId: "surface-shell",
        payload: { piece: "surface-shell", instanceId: "shell", phase: "ready" as const },
        slots: {
          railPrimary: {
            instanceId: "rail",
            pieceId: "rail-primary",
            payload: { piece: "rail-primary", instanceId: "rail", phase: "ready" as const },
            slots: {}
          }
        }
      },
      overlay: {
        instanceId: "overlay:loading",
        pieceId: "phase-loading",
        payload: {
          piece: "phase-loading",
          instanceId: "overlay:loading",
          phase: "loading" as const,
          message: "ignored"
        },
        slots: {}
      },
      revision: 1
    };
    const bus = createSurfaceBus();
    render(<RecipeMount plan={plan} bus={bus} />);
    expect(screen.getByTestId("fx-console")).toBeInTheDocument();
    expect(screen.queryByTestId("fx-overlay")).toBeNull();
  });
});

describe("Derived pieces smoke", () => {
  beforeEach(() => {
    clearPieceRegistryForTests();
    resetDerivedPiecesRegistrationFlagForTests();
    registerDerivedPieces();
  });

  afterEach(() => {
    clearPieceRegistryForTests();
    resetDerivedPiecesRegistrationFlagForTests();
  });

  it("chip emits derived.tab.set / variant.set", () => {
    const chip = getPiece("chip")!;
    const emitted: { event: string; payload: unknown }[] = [];
    const bus = {
      emit: (event: string, payload?: unknown) => emitted.push({ event, payload }),
      on: () => () => undefined
    };
    const { getByRole, rerender } = render(
      <>
        {chip.factory!({
          payload: {
            piece: "chip",
            instanceId: "chip:primary:elements",
            phase: "ready",
            id: "elements",
            label: "Elements",
            rail: "primary",
            selected: false
          },
          slots: {},
          bus
        })}
      </>
    );
    fireEvent.click(getByRole("tab"));
    expect(emitted).toEqual([{ event: "derived.tab.set", payload: { tabId: "elements" } }]);

    emitted.length = 0;
    rerender(
      <>
        {chip.factory!({
          payload: {
            piece: "chip",
            instanceId: "chip:variant:fire",
            phase: "ready",
            id: "fire",
            label: "Fire",
            rail: "variant",
            selected: true
          },
          slots: {},
          bus
        })}
      </>
    );
    fireEvent.click(getByRole("tab"));
    expect(emitted).toEqual([{ event: "derived.variant.set", payload: { variantId: "fire" } }]);
  });

  it("tool-search emits derived.search.set", () => {
    const search = getPiece("tool-search")!;
    const emitted: { event: string; payload: unknown }[] = [];
    const bus = {
      emit: (event: string, payload?: unknown) => emitted.push({ event, payload }),
      on: () => () => undefined
    };
    render(
      <>
        {search.factory!({
          payload: {
            piece: "tool-search",
            instanceId: "tool:search",
            phase: "ready",
            query: ""
          },
          slots: {},
          bus
        })}
      </>
    );
    fireEvent.change(screen.getByTestId("derived-search"), { target: { value: "power" } });
    expect(emitted).toEqual([{ event: "derived.search.set", payload: { query: "power" } }]);
  });

  it("phase-error Retry emits derived.retry", () => {
    const err = getPiece("phase-error")!;
    const emitted: string[] = [];
    const bus = {
      emit: (event: string) => emitted.push(event),
      on: () => () => undefined
    };
    render(
      <>
        {err.factory!({
          payload: {
            piece: "phase-error",
            instanceId: "overlay:error",
            phase: "error",
            message: "Boom",
            canRetry: true,
            retryLabel: "Retry"
          },
          slots: {},
          bus
        })}
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(emitted).toEqual(["derived.retry"]);
  });

  it("gauge-donut uses paint hex fills", () => {
    const donut = getPiece("gauge-donut")!;
    const bus = { emit: () => undefined, on: () => () => undefined };
    const { container } = render(
      <>
        {donut.factory!({
          payload: {
            piece: "gauge-donut",
            instanceId: "inspect:donut",
            phase: "ready",
            slices: [{ key: "equip", label: "Equip", value: 10, share: 100, paint: "#e0b44b" }]
          },
          slots: {},
          bus
        })}
      </>
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("fill")).toBe("#e0b44b");
    expect(path?.getAttribute("fill")?.startsWith("var(")).toBe(false);
  });
});
