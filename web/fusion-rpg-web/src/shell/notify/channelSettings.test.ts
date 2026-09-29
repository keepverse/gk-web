import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHANNEL_SETTINGS_CHANGED_EVENT,
  channelFor,
  clearChannelSettingsForTests,
  setChannel
} from "./channelSettings";

const STORAGE_KEY = "fusionrpg.world-notify.channels.v1";

// This environment's default window.localStorage is incomplete (stages/world/notify/channelSettings.test.ts's
// own note, same root cause as keybindings.test.ts) — stub a real in-memory Storage before each test.
beforeEach(() => {
  const mem: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
});

describe("channelSettings (notify-client spec §3)", () => {
  afterEach(() => {
    clearChannelSettingsForTests();
    vi.restoreAllMocks();
  });

  it("an unset, unpromoted category falls back to defaultChannelOf", () => {
    // supply.change is registered in catalog v2 but not in promotions.toast.
    expect(channelFor("supply.change")).toBe("rail");
  });

  it("an unset, promoted category falls back to toast (world-notify-source v2's own TOAST_TIER)", () => {
    expect(channelFor("loam.shortfall")).toBe("toast");
  });

  it("setChannel persists an override that channelFor then reads back", () => {
    setChannel("loam.shortfall", "off");
    expect(channelFor("loam.shortfall")).toBe("off");
  });

  it("setChannel dispatches the change event so a second mounted control can react", () => {
    const seen = vi.fn();
    window.addEventListener(CHANNEL_SETTINGS_CHANGED_EVENT, seen);
    setChannel("loam.shortfall", "toast");
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHANNEL_SETTINGS_CHANGED_EVENT, seen);
  });

  it("reuses the world-notify storage key — settings saved under it are read here", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ "loam.shortfall": "off" }));
    expect(channelFor("loam.shortfall")).toBe("off");
  });

  it("the player's setting is authoritative even for a category that would otherwise toast", () => {
    setChannel("some.critical.category", "off");
    expect(channelFor("some.critical.category")).toBe("off");
  });
});
