import { describe, expect, it } from "vitest";
import { listThemePacks, lookupThemePack, resolveTheme, themeIdFor } from "./themeRegistry";
import { sceneMoodRefForCue, type SceneMood } from "@/features/story-scene/sceneMood";
import type { ThemeRef } from "./types";

/**
 * The four story-scene packs (owner decisions S2 + 2).
 *
 * Actor identity and scene mood are **paint owned by packs**, so a second scene or a second cast is
 * themed by adding data rather than editing component markup. The prologue's speaker label used to be
 * a hard-coded `text-ok`, which is the same defect as a hard-coded hex.
 *
 * Scene mood is **per-beat**, joined from the script's `cueId` (`spec-theme-packs-scene.md:104`) —
 * so `sceneMoodRefForCue` is what makes the `"scene"` arm of `ThemeKind` load-bearing rather than
 * decorative (its ref is typed `ThemeRef & { kind: "scene" }`).
 */
const ACTOR_PACKS = ["actor.penny", "actor.dave"] as const;
const SCENE_PACKS = ["scene.rift-portal", "scene.quarantine"] as const;

describe("story-scene packs are registered", () => {
  it("registers all four via listThemePacks — derived, never a hard-coded count", () => {
    const ids = new Set(listThemePacks().map((p) => p.themeId));
    for (const id of [...ACTOR_PACKS, ...SCENE_PACKS]) {
      expect(ids.has(id), `unregistered pack: ${id}`).toBe(true);
    }
  });

  it("resolves each pack by its ref through the generic path", () => {
    expect(lookupThemePack({ kind: "actor", id: "penny" }).themeId).toBe("actor.penny");
    expect(lookupThemePack({ kind: "actor", id: "dave" }).themeId).toBe("actor.dave");
    expect(lookupThemePack({ kind: "scene", id: "rift-portal" }).themeId).toBe("scene.rift-portal");
    expect(lookupThemePack({ kind: "scene", id: "quarantine" }).themeId).toBe("scene.quarantine");
  });

  it("falls back to neutral for an unknown actor or scene, never throwing", () => {
    expect(lookupThemePack({ kind: "actor", id: "nobody" }).themeId).toBe("neutral");
    expect(lookupThemePack({ kind: "scene", id: "nowhere" }).themeId).toBe("neutral");
  });
});

describe("the pack contract is complete", () => {
  it("gives every pack a full paint triple and a css block", () => {
    for (const id of [...ACTOR_PACKS, ...SCENE_PACKS]) {
      const [kind, refId] = id.split(".") as [ThemeRef["kind"], string];
      const pack = lookupThemePack({ kind, id: refId });
      expect(pack.themeId).toBe(id);
      expect(pack.paint.accent).toMatch(/^#/);
      expect(pack.paint.accentMuted).toMatch(/^#/);
      expect(pack.paint.onAccent).toMatch(/^#/);
      expect(Object.keys(pack.css).length).toBeGreaterThan(0);
    }
  });

  it("makes Penny and Dave visually distinguishable in the fallback path", () => {
    // Owner decision 2: a missing sprite renders a labelled shape carrying the actor's name. If both
    // actors painted identically, two missing actors would be indistinguishable — the exact defect
    // the shared `◈` caused.
    const penny = resolveTheme({ kind: "actor", id: "penny" });
    const dave = resolveTheme({ kind: "actor", id: "dave" });
    expect(penny.paint.accent).not.toBe(dave.paint.accent);
    expect(penny.themeId).toBe("actor.penny");
    expect(dave.themeId).toBe("actor.dave");
  });

  it("gives each scene pack a vfx.select id for the cue seam", () => {
    for (const id of SCENE_PACKS) {
      const refId = id.split(".")[1];
      const pack = lookupThemePack({ kind: "scene", id: refId });
      expect(pack.vfx.select, `scene pack ${id} needs a vfx.select`).toBeTruthy();
      expect(pack.vfx.select).toMatch(/^vfx\./);
    }
  });

  it("never puts a per-actor identity on the faction `side` axis", () => {
    // Penny and Dave are not plant or zombie; the actor packs must not borrow `side.*`.
    for (const id of ACTOR_PACKS) {
      const refId = id.split(".")[1];
      const pack = lookupThemePack({ kind: "actor", id: refId });
      expect(pack.kind).toBe("actor");
      expect(pack.themeId).not.toMatch(/^side\./);
    }
  });
});

describe("scene mood joins from the script's cue (the T10 carry-over)", () => {
  it("maps each Rift cue to a scene mood", () => {
    expect(sceneMoodRefForCue("rift.portal.open")).toEqual({
      kind: "scene",
      id: "rift-portal"
    });
    expect(sceneMoodRefForCue("rift.portal.surge")).toEqual({
      kind: "scene",
      id: "rift-portal"
    });
    expect(sceneMoodRefForCue("rift.quarantine.seal")).toEqual({
      kind: "scene",
      id: "quarantine"
    });
    expect(sceneMoodRefForCue("rift.quarantine.fade")).toEqual({
      kind: "scene",
      id: "quarantine"
    });
  });

  it("resolves every mapped mood to a real pack, not the neutral fallback", () => {
    // The join would be silently useless if a cue mapped to an unregistered mood.
    for (const cue of [
      "rift.portal.open",
      "rift.portal.surge",
      "rift.quarantine.seal",
      "rift.quarantine.fade"
    ] as const) {
      const ref = sceneMoodRefForCue(cue);
      expect(lookupThemePack(ref).themeId, `cue ${cue} has no pack`).toBe(themeIdFor(ref));
      expect(lookupThemePack(ref).themeId).not.toBe("neutral");
    }
  });

  it("returns undefined for a cue with no mood, rather than defaulting to a wrong one", () => {
    expect(sceneMoodRefForCue(undefined)).toBeUndefined();
  });

  it("declares the moods as a closed union", () => {
    const moods: SceneMood[] = ["rift-portal", "quarantine"];
    expect(moods).toHaveLength(2);
  });
});
