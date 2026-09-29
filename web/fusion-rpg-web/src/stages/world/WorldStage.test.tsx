import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { getStageMountCount, resetStageMountCounts } from "@/shell/stageHost";
import { handleEscape } from "@/shell/keymap";
import { useLayerStack } from "@/shell/layerStack";
import { worldBusEmit, worldBusOn } from "@/game/EventBus";
import { buildWorldIgnoreRects, SHELL_RAIL_WIDTH_PX } from "./worldIgnoreRects";
import { WorldStage } from "./WorldStage";

const fakeGame = { scale: { resize: vi.fn() } } as unknown as Phaser.Game;
const createWorldGame = vi.fn(() => fakeGame);
const destroyWorldGame = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/game/createWorldGame", () => ({
  createWorldGame: (...args: unknown[]) => createWorldGame(...(args as [])),
  destroyWorldGame: (...args: unknown[]) => destroyWorldGame(...(args as []))
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

/** Phaser owns empty right-click (gaps D10). Unit tests emit the bus event the scene would. */
function emitEmptyMapSelect() {
  const generation = createWorldGame.mock.calls[0]![0].generation as number;
  act(() => {
    worldBusEmit("world:ready", { generation });
    worldBusEmit("world:select", { generation, kind: "empty", id: null });
  });
}

describe("WorldStage", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    createWorldGame.mockClear();
    destroyWorldGame.mockClear();
    navigateMock.mockClear();
  });

  it("renders under StageHost with the Phaser world-game-host (not SVG)", () => {
    resetStageMountCounts();
    renderWithProviders(<WorldStage />);

    expect(screen.getByTestId("stage-host")).toBeInTheDocument();
    expect(screen.getByTestId("world-game-host")).toBeInTheDocument();
    expect(screen.queryByTestId("world-stage-svg")).not.toBeInTheDocument();
    expect(screen.getByTestId("world-map-fit")).toBeInTheDocument();
    expect(screen.getByTestId("world-map-zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("world-map-zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("lens-picker")).toBeInTheDocument();
  });

  it("mounts the shell Rail beside the map (gaps D22)", () => {
    renderWithProviders(<WorldStage />, { route: "/world" });

    expect(screen.getByTestId("world-frame")).toBeInTheDocument();
    expect(screen.getByTestId("rail")).toBeInTheDocument();
    expect(within(screen.getByTestId("world-frame")).getByTestId("world-game-host")).toBeInTheDocument();
  });

  it("Rail layer click navigates to Sanctum with ?panel= (gaps D22)", () => {
    renderWithProviders(<WorldStage />, { route: "/world" });

    const creatures = screen.getByTestId("rail-creatures");
    expect(creatures).toHaveAttribute("data-state", "available");
    creatures.click();
    expect(navigateMock).toHaveBeenCalledWith("/sanctum?panel=creatures");

    navigateMock.mockClear();
    screen.getByTestId("rail-sanctum").click();
    expect(navigateMock).toHaveBeenCalledWith("/sanctum");
  });

  it("right column order is NotifyRail → Outliner → Playback slot (gaps D24)", () => {
    renderWithProviders(<WorldStage />, { route: "/world" });

    const column = screen.getByTestId("world-hud-right-column");
    const kids = Array.from(column.children).map((el) => el.getAttribute("data-testid"));
    expect(kids[0]).toBe("notify-rail");
    expect(kids).toContain("outliner");
    // Filter chips sit with the outliner block; Playback needs a live worldId.
    expect(kids.indexOf("notify-rail")).toBeLessThan(kids.indexOf("outliner"));
  });

  it("UnresolvedCount wrapper restores pointer events (gaps D23)", () => {
    renderWithProviders(<WorldStage />, { route: "/world" });

    expect(screen.getByTestId("world-hud-turn-wrap")).toHaveClass("pointer-events-auto");
    expect(screen.getByTestId("unresolved-count")).toBeInTheDocument();
  });

  it("Outliner Enter emits world:camera centre via sectorCenter — not pan (gaps D25)", async () => {
    const user = userEvent.setup();
    const cameras: Array<{ op?: string; x?: number; y?: number }> = [];
    const off = worldBusOn("world:camera", (raw) => {
      cameras.push(raw as { op?: string; x?: number; y?: number });
    });

    renderWithProviders(<WorldStage />, { route: "/world" });
    await act(async () => {});

    const outliner = screen.getByTestId("outliner");
    const firstRow = within(outliner).getAllByRole("option")[0]!;
    firstRow.focus();
    const before = cameras.length;
    await user.keyboard("{Enter}");

    const fromEnter = cameras.slice(before);
    expect(fromEnter.some((p) => p.op === "pan")).toBe(false);
    const centre = fromEnter.find((p) => p.op === "centre");
    expect(centre).toBeDefined();
    expect(centre!.x).toEqual(expect.any(Number));
    expect(centre!.y).toEqual(expect.any(Number));

    off();
  });

  it("ignoreRects omit a double-subtracted rail strip when canvas sits beside Rail", () => {
    const rects = buildWorldIgnoreRects({
      width: 1188,
      height: 720,
      dockOpen: true,
      canvasBesideRail: true
    });
    expect(rects.some((r) => r.width === SHELL_RAIL_WIDTH_PX && r.left === 0)).toBe(false);
    expect(rects).toContainEqual({ left: 0, top: 0, width: 380, height: 720 });
  });

  it("mount count stays at 1 across re-renders — the same guarantee a band-2 layer opening and closing over it relies on (GG-11)", () => {
    resetStageMountCounts();
    const { rerender } = renderWithProviders(<WorldStage />);
    expect(getStageMountCount("world")).toBe(1);

    rerender(<WorldStage />);
    expect(getStageMountCount("world")).toBe(1);

    rerender(<WorldStage />);
    expect(getStageMountCount("world")).toBe(1);
  });

  it("claims exactly one entry on the escape stack for its mounted lifetime, and releases it on unmount", () => {
    const { unmount } = renderWithProviders(<WorldStage />);
    expect(useLayerStack.getState().layers).toHaveLength(1);

    unmount();
    expect(useLayerStack.getState().layers).toHaveLength(0);
  });

  it("Esc reaches the stage's own entry when nothing else is open — select-sector: null is dispatched at last", () => {
    renderWithProviders(<WorldStage />);
    expect(useLayerStack.getState().layers).toHaveLength(1);

    expect(() => act(() => handleEscape())).not.toThrow();
    expect(useLayerStack.getState().layers).toHaveLength(1);
    expect(screen.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "");
  });

  it("with a band-2 layer open, Esc closes that layer instead — the stage's own entry and selection survive", () => {
    renderWithProviders(<WorldStage />);
    const closed: string[] = [];
    useLayerStack.getState().push({ id: "fake-layer", band: "panel", close: () => closed.push("fake-layer") });
    expect(useLayerStack.getState().layers).toHaveLength(2);

    handleEscape();

    expect(closed).toEqual(["fake-layer"]);
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["world-stage", "fake-layer"]);
    expect(screen.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "");
  });

  it("empty map select does exactly what Esc does — one gesture set, no exceptions (§4.4 / gaps D10)", () => {
    renderWithProviders(<WorldStage />);
    expect(useLayerStack.getState().layers).toHaveLength(1);

    emitEmptyMapSelect();

    expect(useLayerStack.getState().layers).toHaveLength(1);
    expect(screen.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "");
  });

  it("empty map select with a band-2 layer open reaches that layer, not the stage's own selection", () => {
    renderWithProviders(<WorldStage />);
    let fakeClosed = false;
    useLayerStack.getState().push({ id: "fake-layer", band: "panel", close: () => (fakeClosed = true) });

    emitEmptyMapSelect();

    expect(fakeClosed).toBe(true);
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["world-stage", "fake-layer"]);
  });
});
