import { describe, expect, it } from "vitest";
import scopeSectorDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-scope-sector.json";
import scopeEmpireDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-scope-empire.json";
import scopeWorldDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-scope-world.json";
import scopeMultiverseDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-scope-multiverse.json";
import rarityCommonDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-rarity-common.json";
import rarityUniqueDesign from "../../../../../docs/design/gui-lego/themes/packs/wonder-rarity-unique.json";
import { listThemePacks, lookupThemePack, resolveTheme } from "./themeRegistry";

const SCOPE_IDS = ["Sector", "Empire", "World", "Multiverse"] as const;
const RARITY_IDS = ["Common", "Unique"] as const;

describe("wonder theme packs (wonder-display 4D.4 — built once here, 4D.3 by contract)", () => {
  it("registers the closed scope vocabulary with exact wire case (no case-folding)", () => {
    for (const id of SCOPE_IDS) {
      const pack = lookupThemePack({ kind: "wonder-scope", id });
      expect(pack.themeId).toBe(`wonder-scope.${id}`);
      expect(pack.kind).toBe("wonder-scope");
      expect(pack.id).toBe(id);
    }
  });

  it("registers the closed rarity vocabulary with exact wire case", () => {
    for (const id of RARITY_IDS) {
      const pack = lookupThemePack({ kind: "wonder-rarity", id });
      expect(pack.themeId).toBe(`wonder-rarity.${id}`);
    }
  });

  it("every member carries css + paint hex + vfx slots (the element-fire shape, new kinds only)", () => {
    for (const themeId of listThemePacks().filter((p) => p.themeId.startsWith("wonder-"))) {
      expect(Object.keys(themeId.css)).toEqual(
        expect.arrayContaining(["--piece-accent", "--piece-rail-edge", "--piece-select-glow"])
      );
      expect(themeId.paint.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(themeId.paint.accentMuted).toMatch(/^#[0-9a-f]{6}$/);
      expect(themeId.paint.onAccent).toMatch(/^#[0-9a-f]{6}$/);
      expect("select" in themeId.vfx && "idle" in themeId.vfx).toBe(true);
    }
  });

  it("vfx slots stay null (GG-32 reduced-motion honored — the card starts no animation)", () => {
    for (const themeId of listThemePacks().filter((p) => p.themeId.startsWith("wonder-"))) {
      expect(themeId.vfx.select).toBeNull();
      expect(themeId.vfx.idle).toBeNull();
    }
  });

  it("reserved tiers share one muted not-yet treatment — never a per-surface improvisation", () => {
    const world = lookupThemePack({ kind: "wonder-scope", id: "World" });
    const multiverse = lookupThemePack({ kind: "wonder-scope", id: "Multiverse" });
    expect(world.paint).toEqual(multiverse.paint);
    expect(world.css).toEqual(multiverse.css);
    // And the treatment reads as muted beside the live tiers.
    expect(world.paint.accent).not.toBe(lookupThemePack({ kind: "wonder-scope", id: "Empire" }).paint.accent);
  });

  it("packs extend the kit's own paint slots — no second palette, no new css dimension", () => {
    const elementSlots = new Set(["--piece-accent", "--piece-rail-edge", "--piece-select-glow"]);
    for (const themeId of listThemePacks().filter((p) => p.themeId.startsWith("wonder-"))) {
      for (const key of Object.keys(themeId.css)) expect(elementSlots.has(key)).toBe(true);
    }
  });

  it("resolves through the shared registry (the composer's lookup path)", () => {
    const resolved = resolveTheme({ kind: "wonder-scope", id: "Empire" });
    expect(resolved.themeId).toBe("wonder-scope.Empire");
    expect(resolved.paint.accent).toMatch(/^#/);
  });

  it("FE copies match the design SSOT member-for-member (README §FE sync — re-copy on change)", () => {
    const pairs = [
      [{ kind: "wonder-scope", id: "Sector" }, scopeSectorDesign],
      [{ kind: "wonder-scope", id: "Empire" }, scopeEmpireDesign],
      [{ kind: "wonder-scope", id: "World" }, scopeWorldDesign],
      [{ kind: "wonder-scope", id: "Multiverse" }, scopeMultiverseDesign],
      [{ kind: "wonder-rarity", id: "Common" }, rarityCommonDesign],
      [{ kind: "wonder-rarity", id: "Unique" }, rarityUniqueDesign]
    ] as const;
    for (const [ref, design] of pairs) {
      expect(lookupThemePack({ kind: ref.kind, id: ref.id })).toEqual(design);
    }
  });
});
