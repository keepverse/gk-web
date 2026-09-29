import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HEALTH_VALUES,
  OWNERSHIP_VALUES,
  channelsFor,
  type Channels,
  type HealthState,
  type Ownership,
  type SectorChannelInput
} from "./sectorChannels";

function input(ownership: Ownership, health: HealthState, stabilityMilli = 700): SectorChannelInput {
  return { intel: "Watched", ownership, health, stabilityMilli };
}

/** Every non-colour channel this module can set — `token` is deliberately excluded (GG-27's whole point). */
function nonColourChannelsSet(c: Channels): number {
  let count = 0;
  if (c.word.length > 0) count += 1;
  if (c.crest.length > 0) count += 1;
  if (c.pattern !== null) count += 1;
  if (c.glyph !== null) count += 1;
  if (c.border.weight !== "normal") count += 1;
  return count;
}

describe("channelsFor — the state matrix (spec-world-render.md §Design 1)", () => {
  it("Unknown intel is a different silhouette, not a card at all — branches on intel, never emptiness", () => {
    const channels = channelsFor({ intel: "Unknown", ownership: "open", health: "anchored", stabilityMilli: 0 });
    expect(channels.shape).toBe("unknown");
    expect(channels.word).toBe("");
  });

  for (const ownership of OWNERSHIP_VALUES) {
    for (const health of HEALTH_VALUES) {
      it(`${ownership} × ${health}: at least two non-colour channels, and no opacity anywhere`, () => {
        const channels = channelsFor(input(ownership, health));
        expect(nonColourChannelsSet(channels)).toBeGreaterThanOrEqual(2);
      });
    }
  }

  it("barren is a flat, distinct look — never a deeper fade of the same pattern fading uses", () => {
    const barren = channelsFor(input("yours", "barren"));
    const fading = channelsFor(input("yours", "fading"));

    expect(barren.pattern).toBe("flat-desaturated");
    expect(barren.pattern).not.toBe(fading.pattern);
    // Barren's meter is null outright — a number would imply "just fading a lot", the exact
    // misreading the ideal's own comment on SectorNode.tsx:43-48 warns about.
    expect(barren.meterMilli).toBeNull();
  });

  it("will-release carries its own heavy-left border weight and a warning glyph, not merely a word", () => {
    const channels = channelsFor(input("yours", "will-release"));
    expect(channels.border.weight).toBe("heavy-left");
    expect(channels.glyph).toBe("⚠");
    expect(channels.word).toContain("will release next turn");
  });

  it("ownership alone reads on two non-colour channels even in the silent anchored health state", () => {
    for (const ownership of OWNERSHIP_VALUES) {
      const channels = channelsFor(input(ownership, "anchored"));
      expect(channels.word).toBe(ownership);
      expect(channels.crest.length).toBeGreaterThan(0);
    }
  });

  it("open ground draws a dashed border for ownership — never the same channel fog uses", () => {
    expect(channelsFor(input("open", "anchored")).border.style).toBe("dashed");
    expect(channelsFor(input("yours", "anchored")).border.style).toBe("solid");
  });

  it("channelsFor never carries an opacity field, on any state — asserted over the module's own source, not spot-checked", () => {
    // Strip comments first: the module's own doc comments *name* the old opacity formula this
    // replaces (prose, not code), and a bare substring match would trip on its own documentation —
    // the same lesson `xyflowGuard.test.ts` (W36) already learned.
    const source = readFileSync(join(__dirname, "sectorChannels.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/\bopacity\b/i);
  });
});
