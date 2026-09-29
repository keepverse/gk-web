import { describe, expect, it } from "vitest";
import { stripTmpRichText } from "./almanacText";

describe("stripTmpRichText", () => {
  it("strips Unity color tags", () => {
    expect(stripTmpRichText("伤害：<color=red>20</color>")).toBe("伤害：20");
    expect(stripTmpRichText("<color=#3D1400>韧性：</color><color=red>270</color>")).toBe("韧性：270");
  });

  it("handles empty", () => {
    expect(stripTmpRichText(null)).toBe("");
    expect(stripTmpRichText(undefined)).toBe("");
    expect(stripTmpRichText("")).toBe("");
  });

  it("strips b i size tags", () => {
    expect(stripTmpRichText("<b>Bold</b> <i>Italic</i>")).toBe("Bold Italic");
    expect(stripTmpRichText("<size=24>Big</size>")).toBe("Big");
  });
});
