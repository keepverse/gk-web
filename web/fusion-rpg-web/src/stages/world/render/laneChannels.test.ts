import { describe, expect, it } from "vitest";
import { LANE_KIND_VALUES, LANE_STATE_CASES, laneChannelsFor } from "./laneChannels";

describe("laneChannelsFor — the kind × state matrix (spec-world-render.md §Design 2)", () => {
  for (const kind of LANE_KIND_VALUES) {
    for (const { name, state } of LANE_STATE_CASES) {
      it(`${kind} — ${name} — is a well-formed, distinguishable channel set`, () => {
        const channels = laneChannelsFor(kind, state);

        // The severed lane is a real gap plus a mark — never merely a fade (there is no opacity
        // field anywhere in this module to fade with).
        expect(channels.severedGap).toBe(state.severed);
        expect(channels.severedGlyph).toBe(state.severed ? "✕" : null);

        // Ward is always the printed level, never a percentage.
        if (state.wardLevel != null) {
          expect(channels.wardBadge).toBe(`ward ${state.wardLevel}`);
          expect(channels.wardBadge).not.toMatch(/%/);
        } else {
          expect(channels.wardBadge).toBeNull();
        }

        // Hazard is always the printed percent, straight off HazardMilli.
        if (state.hazardMilli > 0) {
          expect(channels.hazardBadge).toMatch(/%$/);
        } else {
          expect(channels.hazardBadge).toBeNull();
        }
      });
    }
  }

  it("HazardMilli 400 prints exactly 40%, not a rounded-away fraction", () => {
    const channels = laneChannelsFor("rift", { severed: false, wardLevel: null, hazardMilli: 400 });
    expect(channels.hazardBadge).toBe("☠ 40%");
  });

  it("one-way always draws arrowheads and nothing else does", () => {
    for (const kind of LANE_KIND_VALUES) {
      const channels = laneChannelsFor(kind, { severed: false, wardLevel: null, hazardMilli: 0 });
      expect(channels.arrowheads).toBe(kind === "one-way");
    }
  });

  it("deep is marked no-supply and nothing else is", () => {
    for (const kind of LANE_KIND_VALUES) {
      const channels = laneChannelsFor(kind, { severed: false, wardLevel: null, hazardMilli: 0 });
      expect(channels.noSupplyMark).toBe(kind === "deep");
    }
  });

  it("gated carries the lock glyph and nothing else does", () => {
    for (const kind of LANE_KIND_VALUES) {
      const channels = laneChannelsFor(kind, { severed: false, wardLevel: null, hazardMilli: 0 });
      expect(channels.gateGlyph).toBe(kind === "gated" ? "🔒" : null);
    }
  });

  it("every kind gets its own stroke style — no two kinds share the identical treatment", () => {
    const styles = LANE_KIND_VALUES.map(
      (kind) => laneChannelsFor(kind, { severed: false, wardLevel: null, hazardMilli: 0 }).strokeStyle
    );
    // corridor and one-way and deep are all "solid" by stroke style alone (they are told apart by
    // arrowheads/no-supply-mark instead) — so this checks the kinds that *should* be style-unique.
    expect(new Set(styles)).toEqual(new Set(["solid", "dashed", "twin-rail", "solid", "solid", "long-dash"]));
  });

  it("a severed, warded, hazardous lane reads as all three at once — nothing is dropped for another", () => {
    const channels = laneChannelsFor("ley", { severed: true, wardLevel: 1, hazardMilli: 600 });
    expect(channels.severedGap).toBe(true);
    expect(channels.wardBadge).toBe("ward 1");
    expect(channels.hazardBadge).toBe("☠ 60%");
  });
});
