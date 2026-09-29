import { describe, expect, it } from "vitest";
import { auraLabel, auraPreviewMilli } from "./patronView";

describe("patron aura preview (mirrors PatronPolicy — drift fails here)", () => {
  it("computes rarityBase + 10·star + level with the clamp", () => {
    expect(auraPreviewMilli("common", 0, 0)).toBe(20);
    expect(auraPreviewMilli("epic", 2, 10)).toBe(75);
    expect(auraPreviewMilli("legendary", 5, 90)).toBe(150); // clamped
    expect(auraPreviewMilli("unknown", 0, 0)).toBe(0);
  });

  it("labels per-mille as trimmed percentages", () => {
    expect(auraLabel("fire", 75, 37)).toBe("+7.5% fire power · +3.7% defense");
    expect(auraLabel("dark", 150, 75)).toBe("+15% dark power · +7.5% defense");
  });
});
