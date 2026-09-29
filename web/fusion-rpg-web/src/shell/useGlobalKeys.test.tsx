import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayerStack } from "./layerStack";
import { registerGlobalVerb, resetKeymapForTests } from "./keymap";
import { useGlobalKeys } from "./useGlobalKeys";

function Mount() {
  useGlobalKeys();
  return null;
}

describe("useGlobalKeys", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("Escape on the window closes the top layer via its registered close()", async () => {
    const user = userEvent.setup();
    const close = vi.fn(() => useLayerStack.getState().pop("panel-1"));
    useLayerStack.getState().push({ id: "panel-1", band: "panel", close });
    render(<Mount />);

    await user.keyboard("{Escape}");

    expect(close).toHaveBeenCalledTimes(1);
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("dispatches a registered global verb key", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    registerGlobalVerb("`", "dev-tree", handler);
    render(<Mount />);

    await user.keyboard("`");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes its listener on unmount", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    registerGlobalVerb("`", "dev-tree", handler);
    const { unmount } = render(<Mount />);
    unmount();

    await user.keyboard("`");

    expect(handler).not.toHaveBeenCalled();
  });
});
