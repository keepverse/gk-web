import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { getStageMountCount, resetStageMountCounts } from "@/shell/stageHost";
import { resetKeymapForTests } from "@/shell/keymap";
import { setDevModeEnabled } from "@/dev/devMode";
import {
  isLawnKeyboardMuted,
  resetLawnKeyboardMuteForTests
} from "@/game/focusGate";
import { LawnStage } from "./LawnStage";

const mutateAsync = vi.fn();
const mutate = vi.fn();

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return {
    ...actual,
    useSpawnExtraIntent: () => ({ mutateAsync, mutate, isPending: false }),
    useLawnDebugPost: () => ({ mutateAsync, mutate, isPending: false }),
    useUniqueActor: () => ({ data: undefined, isError: false, isLoading: false })
  };
});

const fakeGame = { scale: { resize: vi.fn() } } as unknown as Phaser.Game;
const createLawnGame = vi.fn(() => fakeGame);
const destroyLawnGame = vi.fn();

vi.mock("@/game/createLawnGame", () => ({
  createLawnGame: (...args: unknown[]) => createLawnGame(...(args as [])),
  destroyLawnGame: (...args: unknown[]) => destroyLawnGame(...(args as []))
}));

describe("LawnStage — GG-11 keystone proof", () => {
  beforeEach(() => {
    createLawnGame.mockClear();
    destroyLawnGame.mockClear();
    resetStageMountCounts();
    resetKeymapForTests();
    resetLawnKeyboardMuteForTests();
    // This environment's default window.localStorage is incomplete (same pattern
    // SystemLayer.test.tsx already uses) — stub a real in-memory Storage before each test.
    const mem: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const key of Object.keys(mem)) delete mem[key];
      },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      get length() {
        return Object.keys(mem).length;
      }
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
    // T28: `lawn-stage-open-panel` (the GG-11 proof button) is gated behind developer mode now
    // that a real Rail on this stage makes it redundant scaffolding for a live player — this test
    // is specifically about the developer-facing proof, so it turns the gate on directly.
    setDevModeEnabled(true);
  });

  it("opening and closing a panel leaves the Phaser Game instance identical and never unmounts the stage", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LawnStage />, { withGlobalKeys: true });

    await waitFor(() => expect(createLawnGame).toHaveBeenCalledTimes(1));
    const gameBeforeOpen = createLawnGame.mock.results[0]!.value;
    expect(getStageMountCount("lawn")).toBe(1);

    await user.click(screen.getByTestId("lawn-stage-open-panel"));
    await waitFor(() => expect(screen.getByTestId("lawn-stage-panel")).toBeInTheDocument());
    expect(isLawnKeyboardMuted()).toBe(true);

    // The board host never left the tree, the Phaser Game was never
    // recreated or destroyed, and the stage component was never remounted.
    expect(screen.getByTestId("lawn-game-host")).toBeInTheDocument();
    expect(createLawnGame).toHaveBeenCalledTimes(1);
    expect(createLawnGame.mock.results[0]!.value).toBe(gameBeforeOpen);
    expect(destroyLawnGame).not.toHaveBeenCalled();
    expect(getStageMountCount("lawn")).toBe(1);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("lawn-stage-panel")).not.toBeInTheDocument());
    expect(isLawnKeyboardMuted()).toBe(false);

    expect(screen.getByTestId("lawn-game-host")).toBeInTheDocument();
    expect(createLawnGame).toHaveBeenCalledTimes(1);
    expect(destroyLawnGame).not.toHaveBeenCalled();
    expect(getStageMountCount("lawn")).toBe(1);
  });

  it("leaving the stage entirely still runs the full destroy checklist", async () => {
    const { unmount } = renderWithProviders(<LawnStage />);
    await waitFor(() => expect(createLawnGame).toHaveBeenCalledTimes(1));

    unmount();

    expect(destroyLawnGame).toHaveBeenCalledTimes(1);
  });
});
