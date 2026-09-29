import { beforeEach, describe, expect, it } from "vitest";
import { useLayerStack } from "./layerStack";

function reset() {
  useLayerStack.setState({ layers: [] });
}

describe("layerStack", () => {
  beforeEach(reset);

  it("push adds a layer and it becomes the top", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    expect(useLayerStack.getState().layers).toEqual([{ id: "roster", band: "panel" }]);
  });

  it("push is idempotent for the same id", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    expect(useLayerStack.getState().layers).toHaveLength(1);
  });

  it("push preserves insertion order across multiple layers", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    useLayerStack.getState().push({ id: "confirm", band: "dialog" });
    useLayerStack.getState().push({ id: "settings", band: "system" });
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual([
      "roster",
      "confirm",
      "settings"
    ]);
  });

  it("pop() with no id removes the top (LIFO)", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    useLayerStack.getState().push({ id: "confirm", band: "dialog" });
    useLayerStack.getState().pop();
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["roster"]);
  });

  it("pop() on an empty stack is a no-op", () => {
    useLayerStack.getState().pop();
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("pop(id) removes a specific entry regardless of position", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    useLayerStack.getState().push({ id: "confirm", band: "dialog" });
    useLayerStack.getState().push({ id: "settings", band: "system" });
    useLayerStack.getState().pop("roster");
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["confirm", "settings"]);
  });

  it("popAll clears the stack in one call", () => {
    useLayerStack.getState().push({ id: "roster", band: "panel" });
    useLayerStack.getState().push({ id: "confirm", band: "dialog" });
    useLayerStack.getState().popAll();
    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("push three then pop three empties the stack one at a time (GG-6)", () => {
    const { push, pop } = useLayerStack.getState();
    push({ id: "a", band: "panel" });
    push({ id: "b", band: "dialog" });
    push({ id: "c", band: "system" });
    expect(useLayerStack.getState().layers).toHaveLength(3);
    pop();
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["a", "b"]);
    pop();
    expect(useLayerStack.getState().layers.map((l) => l.id)).toEqual(["a"]);
    pop();
    expect(useLayerStack.getState().layers).toEqual([]);
  });
});
