import { describe, expect, it } from "vitest";
import {
  ELEMENT_PAINT_CATALOG_IDS,
  elementPaintAccentHex,
  elementPaintAccentPhaser,
  resolveElementPaint
} from "./elementPaint";

describe("resolveElementPaint", () => {
  it("resolves every catalog element id to a pack themeId", () => {
    expect(ELEMENT_PAINT_CATALOG_IDS.length).toBeGreaterThanOrEqual(7);
    for (const id of ELEMENT_PAINT_CATALOG_IDS) {
      const paint = resolveElementPaint(id);
      expect(paint.themeId).toBe(`element.${id}`);
      expect(paint.dataEl).toBe(id);
      expect(paint.paint.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(paint.label.length).toBeGreaterThan(0);
    }
  });

  it("dark is not mute-only — accent differs from muted and from neutral", () => {
    const dark = resolveElementPaint("dark");
    const neutral = resolveElementPaint("not-a-real-element");
    expect(dark.themeId).toBe("element.dark");
    expect(dark.paint.accent).not.toBe(dark.paint.accentMuted);
    expect(dark.paint.accent).not.toBe(neutral.paint.accent);
  });

  it("unknown id falls back to neutral", () => {
    const paint = resolveElementPaint("poison");
    expect(paint.themeId).toBe("neutral");
    expect(paint.dataEl).toBe("neutral");
  });

  it("HUD helpers match paint accent", () => {
    const fire = resolveElementPaint("fire");
    expect(elementPaintAccentHex("fire")).toBe(fire.paint.accent);
    expect(elementPaintAccentPhaser("fire")).toBe(
      Number.parseInt(fire.paint.accent.slice(1), 16)
    );
  });
});
