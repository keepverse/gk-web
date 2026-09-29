import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Display: { Color: { HexStringToColor: () => ({ color: 0xffffff }) } }
  }
}));

import { laneChannelsFor, LANE_KIND_VALUES, LANE_STATE_CASES } from "@/stages/world/render/laneChannels";
import { lanePaintOps } from "./laneStroke";

describe("lanePaintOps — full LaneChannels (gaps D14)", () => {
  it("covers every LaneChannels field across the kind×state matrix", () => {
    for (const kind of LANE_KIND_VALUES) {
      for (const { state } of LANE_STATE_CASES) {
        const channels = laneChannelsFor(kind, state);
        const ops = lanePaintOps(channels);
        expect(ops.some((o) => o.op === "stroke")).toBe(true);
        const stroke = ops.find((o) => o.op === "stroke");
        expect(stroke).toMatchObject({
          op: "stroke",
          style: channels.strokeStyle,
          token: channels.token,
          severedGap: channels.severedGap
        });

        const kinds = new Set(ops.filter((o) => o.op === "marker").map((o) => o.kind));
        if (channels.arrowheads) expect(kinds.has("arrow")).toBe(true);
        if (channels.noSupplyMark) expect(kinds.has("no-supply")).toBe(true);
        if (channels.gateGlyph) expect(kinds.has("gate")).toBe(true);
        if (channels.severedGlyph) expect(kinds.has("severed")).toBe(true);
        if (channels.wardBadge) expect(kinds.has("ward")).toBe(true);
        if (channels.hazardBadge) expect(kinds.has("hazard")).toBe(true);
      }
    }
  });

  it("severed lanes carry both gap stroke and ✕ marker", () => {
    const channels = laneChannelsFor("corridor", {
      severed: true,
      wardLevel: null,
      hazardMilli: 0
    });
    const ops = lanePaintOps(channels);
    expect(ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "stroke", severedGap: true }),
        expect.objectContaining({ op: "marker", kind: "severed", text: "✕" })
      ])
    );
  });
});
