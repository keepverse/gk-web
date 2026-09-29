import { describe, expect, it } from "vitest";
import {
  isExplicitlySet,
  readBoolSetting,
  VISUAL_EFFECTS_KEY,
  WORLD_HUD_KEY,
  type UserSettingsResponse,
} from "./userSettings";

function res(entries: UserSettingsResponse["entries"]): UserSettingsResponse {
  return { playerId: 1, entries };
}

const worldHud = (value: string, isDefault: boolean) => ({
  key: WORLD_HUD_KEY,
  kind: "Bool" as const,
  summary: "Draw the in-world actor HUD.",
  value,
  isDefault,
});

const visualEffects = (value: string, isDefault: boolean) => ({
  key: VISUAL_EFFECTS_KEY,
  kind: "Bool" as const,
  summary: "Render cosmetic combat effects.",
  value,
  isDefault,
});

describe("readBoolSetting", () => {
  it("reads true and false", () => {
    expect(readBoolSetting(res([worldHud("true", false)]), WORLD_HUD_KEY)).toBe(true);
    expect(readBoolSetting(res([worldHud("false", false)]), WORLD_HUD_KEY)).toBe(false);
    expect(readBoolSetting(res([visualEffects("false", false)]), VISUAL_EFFECTS_KEY)).toBe(false);
  });

  it("tolerates casing, since the value is JSON text rather than a parsed bool", () => {
    expect(readBoolSetting(res([worldHud("TRUE", false)]), WORLD_HUD_KEY)).toBe(true);
  });

  it("falls back rather than coercing an unparseable value", () => {
    // The point: "yes" must not read as true, and must not read as a deliberate false either.
    expect(readBoolSetting(res([worldHud("yes", false)]), WORLD_HUD_KEY, true)).toBe(true);
    expect(readBoolSetting(res([worldHud("yes", false)]), WORLD_HUD_KEY, false)).toBe(false);
  });

  it("falls back for a missing key or a missing response", () => {
    expect(readBoolSetting(res([]), WORLD_HUD_KEY, true)).toBe(true);
    expect(readBoolSetting(null, WORLD_HUD_KEY, true)).toBe(true);
    expect(readBoolSetting(undefined, WORLD_HUD_KEY)).toBe(false);
  });
});

describe("isExplicitlySet", () => {
  it("separates a chosen value from an inherited default", () => {
    // Both read false; only one was chosen. That distinction is why the server does not write
    // defaults into the table on read.
    expect(isExplicitlySet(res([worldHud("false", true)]), WORLD_HUD_KEY)).toBe(false);
    expect(isExplicitlySet(res([worldHud("false", false)]), WORLD_HUD_KEY)).toBe(true);
  });

  it("is false when the setting is absent entirely", () => {
    expect(isExplicitlySet(res([]), WORLD_HUD_KEY)).toBe(false);
    expect(isExplicitlySet(null, WORLD_HUD_KEY)).toBe(false);
  });
});
