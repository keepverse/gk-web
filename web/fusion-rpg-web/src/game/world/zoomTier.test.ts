import { describe, expect, it } from "vitest";
import { DETAIL_MIN, FIT_MAX, lodChannels, zoomTier } from "./zoomTier";

describe("zoomTier", () => {
  it("uses named structural breakpoints", () => {
    expect(FIT_MAX).toBeGreaterThan(0);
    expect(DETAIL_MIN).toBeGreaterThan(FIT_MAX);
  });

  it("classifies fit / map / detail", () => {
    expect(zoomTier(0.4)).toBe("fit");
    expect(zoomTier(0.9)).toBe("map");
    expect(zoomTier(1.5)).toBe("detail");
  });

  it("LOD channels are strict supersets", () => {
    const fit = lodChannels("fit");
    const map = lodChannels("map");
    const detail = lodChannels("detail");
    for (const c of fit) expect(map.has(c)).toBe(true);
    for (const c of map) expect(detail.has(c)).toBe(true);
    expect(fit.has("ownership")).toBe(true);
    expect(fit.has("health")).toBe(true);
    expect(fit.has("unknownShape")).toBe(true);
    expect(fit.has("name")).toBe(false);
  });
});
