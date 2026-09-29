import { beforeEach, describe, expect, it } from "vitest";
import { useLayerStack } from "@/shell/layerStack";
import { isWorldMapChromeMuted } from "./mapChromeMute";

describe("isWorldMapChromeMuted (gaps D8 / GG-18)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
  });

  it("is false with only the stage entry", () => {
    useLayerStack.getState().push({ id: "world-stage", band: "stage", close: () => {} });
    expect(isWorldMapChromeMuted()).toBe(false);
  });

  it("is true when a panel sits on top", () => {
    useLayerStack.getState().push({ id: "world-stage", band: "stage", close: () => {} });
    useLayerStack.getState().push({ id: "inspector", band: "panel", close: () => {} });
    expect(isWorldMapChromeMuted()).toBe(true);
  });

  it("is true for dialog", () => {
    useLayerStack.getState().push({ id: "confirm", band: "dialog", close: () => {} });
    expect(isWorldMapChromeMuted()).toBe(true);
  });
});
