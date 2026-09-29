import { beforeEach, describe, expect, it } from "vitest";
import { useLayerStack } from "./layerStack";
import {
  dispatchGlobalVerb,
  handleEscape,
  registerEmptyStackEscapeFallback,
  registerGlobalVerb,
  resetKeymapForTests
} from "./keymap";

function pushLayer(id: string, band: "panel" | "dialog" | "system" | "toast" | "hud", close: () => void) {
  useLayerStack.getState().push({ id, band, close });
}

describe("keymap", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
    resetKeymapForTests();
  });

  it("push three, Esc three times: each pop closes exactly the top layer, one at a time (GG-6)", () => {
    const closed: string[] = [];
    pushLayer("a", "panel", () => {
      closed.push("a");
      useLayerStack.getState().pop("a");
    });
    pushLayer("b", "dialog", () => {
      closed.push("b");
      useLayerStack.getState().pop("b");
    });
    pushLayer("c", "system", () => {
      closed.push("c");
      useLayerStack.getState().pop("c");
    });

    handleEscape();
    expect(closed).toEqual(["c"]);
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["a", "b"]);

    handleEscape();
    expect(closed).toEqual(["c", "b"]);
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["a"]);

    handleEscape();
    expect(closed).toEqual(["c", "b", "a"]);
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("Esc skips a Toast (auto-expire only, GG-5) and closes the next dismissible layer below it", () => {
    const closed: string[] = [];
    pushLayer("roster", "panel", () => closed.push("roster"));
    pushLayer("drop-toast", "toast", () => closed.push("drop-toast"));

    handleEscape();

    expect(closed).toEqual(["roster"]);
  });

  it("Esc on an empty stack calls the registered System-layer fallback", () => {
    let opened = false;
    registerEmptyStackEscapeFallback("system-layer", () => {
      opened = true;
    });

    handleEscape();

    expect(opened).toBe(true);
  });

  it("Esc on an empty stack with no fallback registered is a safe no-op", () => {
    expect(() => handleEscape()).not.toThrow();
  });

  it("registerGlobalVerb refuses F10", () => {
    expect(() => registerGlobalVerb("F10", "dev-tree", () => {})).toThrow(/F10/);
  });

  it("registerGlobalVerb refuses a second owner for the same key", () => {
    registerGlobalVerb("`", "dev-tree", () => {});
    expect(() => registerGlobalVerb("`", "someone-else", () => {})).toThrow(/already registered/);
  });

  it("dispatchGlobalVerb calls the registered handler and reports it handled the key", () => {
    let calls = 0;
    registerGlobalVerb("`", "dev-tree", () => {
      calls += 1;
    });

    expect(dispatchGlobalVerb("`")).toBe(true);
    expect(calls).toBe(1);
    expect(dispatchGlobalVerb("q")).toBe(false);
  });

  it("unregistering a verb frees its key for a new owner", () => {
    const unregister = registerGlobalVerb("`", "dev-tree", () => {});
    unregister();
    expect(() => registerGlobalVerb("`", "someone-else", () => {})).not.toThrow();
  });
});
