import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STORY_CUE_IDS,
  cueDataAttribute,
  cueVfxClass,
  isStoryCueId,
  prefersReducedMotion
} from "./storyCue";

/**
 * The cue seam: semantic ids that travel as a `data-cue` attribute, resolve to motion through the
 * scene pack, and never reach the player as text. The FE owns the cue; there is no injector-side
 * story state machine and this module opens no socket, binds no key, and invents no transport.
 */

describe("story-cue — closed vocabulary", () => {
  it("lists exactly the four v1 Rift cue ids", () => {
    expect([...STORY_CUE_IDS].sort()).toEqual(
      ["rift.portal.open", "rift.portal.surge", "rift.quarantine.seal", "rift.quarantine.fade"].sort()
    );
  });

  it("accepts each member and rejects typos, empties, and prototype-chain names", () => {
    for (const id of STORY_CUE_IDS) expect(isStoryCueId(id)).toBe(true);
    for (const bad of [
      "rift.portal.opne",
      "RIFT.PORTAL.OPEN",
      "",
      "   ",
      "toString",
      "constructor",
      "hasOwnProperty",
      "rift.portal.open ",
      "quarantine.seal"
    ]) {
      expect(isStoryCueId(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("story-cue — ids travel as attributes, never as text", () => {
  it("returns exactly one key, so a cue id cannot leak into player-visible copy", () => {
    for (const id of STORY_CUE_IDS) {
      const attrs = cueDataAttribute(id);
      expect(Object.keys(attrs)).toEqual(["data-cue"]);
      expect(attrs["data-cue"]).toBe(id);
    }
  });

  it("an absent cue yields no attribute, never data-cue=undefined", () => {
    // Spreading the result is how a host applies it; an empty object adds nothing to the DOM, so
    // there is no attribute to read back as the string "undefined".
    const attrs = cueDataAttribute(undefined);
    expect(attrs).toEqual({});
    expect("data-cue" in attrs).toBe(false);
  });

  it("display names are not cue ids and cue ids are not display names", () => {
    // Guards the naming rule both ways: fiction stays fiction, ids stay internal.
    for (const name of ["Penny", "Dave", "Gnome signal", "The Rift is opening"]) {
      expect(isStoryCueId(name)).toBe(false);
    }
  });
});

describe("story-cue — pack-owned resolution", () => {
  const pack = (select: string | null | undefined) => ({
    themeId: "scene.rift-portal",
    css: {},
    paint: { accent: "#c46bff", accentMuted: "#7d43a8", onAccent: "#120821" },
    vfx: { select: select ?? null, idle: null }
  });

  it("resolves the pack's vfx.select id, whatever it names", () => {
    expect(cueVfxClass(pack("vfx.rift-portal-surge"))).toBe("vfx.rift-portal-surge");
    expect(cueVfxClass(pack("vfx.something-else-entirely"))).toBe("vfx.something-else-entirely");
  });

  it("a pack with no select resolves to null — state change only, never a guessed class", () => {
    expect(cueVfxClass(pack(null))).toBeNull();
    expect(cueVfxClass(pack(""))).toBeNull();
    expect(cueVfxClass(null)).toBeNull();
    expect(cueVfxClass(undefined)).toBeNull();
  });

  it("resolution is synchronous and host-independent — no socket, no transport hiding here", () => {
    // Every seam function returns a plain value, never a Promise: there is no async channel for a
    // transport to hide behind. (Structural, but it fails loudly the day someone makes one async.)
    for (const id of STORY_CUE_IDS) {
      expect(cueDataAttribute(id)).not.toBeInstanceOf(Promise);
      expect(isStoryCueId(id)).not.toBeInstanceOf(Promise);
    }
    expect(cueVfxClass(pack("vfx.rift-portal-surge"))).not.toBeInstanceOf(Promise);
    expect(prefersReducedMotion()).not.toBeInstanceOf(Promise);
  });
});

describe("story-cue — reduced motion", () => {
  const realMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  function mockMatchMedia(matches: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {}
    }) as unknown as typeof window.matchMedia;
  }

  it("reports the OS preference when the API exists", () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("queries the reduce query, not some other media feature", () => {
    const seen: string[] = [];
    window.matchMedia = vi.fn().mockImplementation((q: string) => {
      seen.push(q);
      return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    }) as unknown as typeof window.matchMedia;
    prefersReducedMotion();
    expect(seen).toEqual(["(prefers-reduced-motion: reduce)"]);
  });

  it("absent matchMedia means no preference expressed — motion stays on", () => {
    // jsdom/SSR have no matchMedia; the CSS media query remains the real enforcement in browsers.
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
  });
});
