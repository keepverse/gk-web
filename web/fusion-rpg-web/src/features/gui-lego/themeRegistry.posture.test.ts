import { describe, expect, it } from "vitest";
import { listThemePacks, lookupThemePack, resolveTheme } from "./themeRegistry";

describe("posture theme packs (aptitude-sheet AS-0.5)", () => {
  it("registers Force / Finesse / Bastion with non-null vfx.select", () => {
    for (const id of ["force", "finesse", "bastion"] as const) {
      const pack = lookupThemePack({ kind: "posture", id });
      expect(pack.themeId).toBe(`posture.${id}`);
      expect(pack.vfx.select).toBeTruthy();
      const resolved = resolveTheme({ kind: "posture", id });
      expect(resolved.vfx.select).toBeTruthy();
      expect(resolved.paint.accent).toMatch(/^#/);
    }
  });

  it("keeps bucket.aptitude as Derived-bucket only (G5)", () => {
    const bucket = lookupThemePack({ kind: "bucket", id: "aptitude" });
    expect(bucket.themeId).toBe("bucket.aptitude");
    expect(listThemePacks().some((p) => p.themeId === "posture.force")).toBe(true);
    expect(bucket.themeId).not.toMatch(/^posture\./);
  });
});
