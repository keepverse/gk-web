import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { useLayerStack } from "@/shell/layerStack";
import { resetKeymapForTests } from "@/shell/keymap";
import { clearBindingsForTests } from "./keybindings";
import { SystemHost } from "./SystemHost";

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
  clearBindingsForTests();
});

describe("SystemHost (T20)", () => {
  it("stays closed with no ?system= param", () => {
    renderWithProviders(<SystemHost />, { withGlobalKeys: true, route: "/sanctum" });
    expect(screen.queryByTestId("system-layer")).not.toBeInTheDocument();
  });

  it("?system=1 opens directly", () => {
    renderWithProviders(<SystemHost />, { withGlobalKeys: true, route: "/sanctum?system=1" });
    expect(screen.getByTestId("system-layer")).toBeInTheDocument();
  });

  it("Escape on an empty layer stack opens System (GG-5's Shell/System row)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemHost />, { withGlobalKeys: true, route: "/sanctum" });
    expect(screen.queryByTestId("system-layer")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByTestId("system-layer")).toBeInTheDocument());
  });

  it("Escape with another layer on the stack pops that layer instead of opening System", async () => {
    const user = userEvent.setup();
    let closed = false;
    useLayerStack.getState().push({ id: "some-panel", band: "panel", close: () => (closed = true) });

    renderWithProviders(<SystemHost />, { withGlobalKeys: true, route: "/sanctum" });
    await user.keyboard("{Escape}");

    expect(closed).toBe(true);
    expect(screen.queryByTestId("system-layer")).not.toBeInTheDocument();
  });

  it("Done closes System via the real onOpenChange path, dropping the URL param", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemHost />, { withGlobalKeys: true, route: "/sanctum?system=1" });
    expect(screen.getByTestId("system-layer")).toBeInTheDocument();

    await user.click(screen.getByTestId("system-done"));
    await waitFor(() => expect(screen.queryByTestId("system-layer")).not.toBeInTheDocument());
  });
});
