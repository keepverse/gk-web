import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { useLayerStack } from "@/shell/layerStack";
import { resetKeymapForTests } from "@/shell/keymap";
import { DevTreeHost } from "./DevTreeHost";
import { isDevModeEnabled, setDevModeEnabled } from "./devMode";

beforeEach(() => {
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
  useLayerStack.setState({ layers: [] });
  resetKeymapForTests();
});

describe("DevTreeHost (T12)", () => {
  it("stays closed with no ?dev= param", () => {
    renderWithProviders(<DevTreeHost />, { withGlobalKeys: true, route: "/status" });
    expect(screen.queryByTestId("dev-tree")).not.toBeInTheDocument();
  });

  it("?dev=<surface> opens directly on that tab", () => {
    renderWithProviders(<DevTreeHost />, { withGlobalKeys: true, route: "/status?dev=cheats" });
    expect(screen.getByTestId("dev-tree")).toBeInTheDocument();
    expect(screen.getByTestId("dev-tree-surface-cheats")).toBeInTheDocument();
  });

  it("backtick does nothing while dev mode is off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DevTreeHost />, { withGlobalKeys: true, route: "/status" });
    await user.keyboard("`");
    expect(screen.queryByTestId("dev-tree")).not.toBeInTheDocument();
  });

  it("backtick opens and closes it once dev mode is enabled", async () => {
    setDevModeEnabled(true);
    const user = userEvent.setup();
    renderWithProviders(<DevTreeHost />, { withGlobalKeys: true, route: "/status" });

    await user.keyboard("`");
    await waitFor(() => expect(screen.getByTestId("dev-tree")).toBeInTheDocument());

    await user.keyboard("`");
    await waitFor(() => expect(screen.queryByTestId("dev-tree")).not.toBeInTheDocument());
  });

  it("?devmode=1 persists the gate, and backtick opens the tree afterwards", async () => {
    renderWithProviders(<DevTreeHost />, { withGlobalKeys: true, route: "/status?devmode=1" });
    await waitFor(() => expect(isDevModeEnabled()).toBe(true));

    const user = userEvent.setup();
    await user.keyboard("`");
    await waitFor(() => expect(screen.getByTestId("dev-tree")).toBeInTheDocument());
  });
});
