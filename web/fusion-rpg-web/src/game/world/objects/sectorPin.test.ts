import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Display: { Color: { HexStringToColor: () => ({ color: 0xffffff }) } }
  }
}));

import { channelsFor } from "@/stages/world/render/sectorChannels";
import { fogTreatmentFor } from "@/stages/world/render/fogTreatments";
import { pinDescriptor, pinPaintOps } from "./sectorPin";

describe("pinDescriptor — intel-first pin matrix (spec-world-map-runtime)", () => {
  it("Unknown vs Watched kinds differ — never a dimmed disc", () => {
    const unknown = pinDescriptor({
      channels: channelsFor({ intel: "Unknown", ownership: "open", health: "anchored", stabilityMilli: 0 }),
      fog: fogTreatmentFor("Unknown", 0),
      zoom: "map"
    });
    const watched = pinDescriptor({
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 900 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "map"
    });
    expect(unknown.kind).toBe("unknown");
    expect(watched.kind).toBe("disc");
    expect(unknown.kind).not.toBe(watched.kind);
  });

  it("descriptor never carries an opacity field", () => {
    const desc = pinDescriptor({
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "fading", stabilityMilli: 400 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "detail"
    });
    expect("opacity" in desc).toBe(false);
    expect("opacity" in desc.channels).toBe(false);
  });

  it("fog forces strip is absent from pin fog encoding", () => {
    for (const intel of ["Scouted", "Rumored"] as const) {
      const desc = pinDescriptor({
        channels: channelsFor({ intel, ownership: "open", health: "anchored", stabilityMilli: 500 }),
        fog: fogTreatmentFor(intel, 3),
        zoom: "map"
      });
      expect(desc.fog).not.toBeNull();
      expect(desc.fog).not.toHaveProperty("forcesStrip");
      expect(JSON.stringify(desc)).not.toContain("who stands here is not known");
    }
  });
});

describe("pinPaintOps — gaps D11/D12/D13", () => {
  it("includes crest and word so yours vs enemy reads without hue", () => {
    const yours = pinPaintOps({
      id: "homeworld",
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 900 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "map",
      x: 0,
      y: 0
    });
    const enemy = pinPaintOps({
      id: "ash",
      channels: channelsFor({ intel: "Watched", ownership: "enemy", health: "anchored", stabilityMilli: 900 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "map",
      x: 0,
      y: 0
    });
    const yoursCrest = yours.find((o) => o.op === "crest");
    const enemyCrest = enemy.find((o) => o.op === "crest");
    const yoursWord = yours.find((o) => o.op === "word");
    const enemyWord = enemy.find((o) => o.op === "word");
    expect(yoursCrest).toMatchObject({ op: "crest" });
    expect(enemyCrest).toMatchObject({ op: "crest" });
    expect(yoursCrest).not.toEqual(enemyCrest);
    expect(yoursWord).not.toEqual(enemyWord);
  });

  it("draws hatch/glyph/meter for non-anchored health — not fill alone", () => {
    const ops = pinPaintOps({
      id: "homeworld",
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "fading", stabilityMilli: 400 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "detail",
      x: 0,
      y: 0
    });
    expect(ops.some((o) => o.op === "hatch")).toBe(true);
    expect(ops.some((o) => o.op === "glyph" || o.op === "meter")).toBe(true);
  });

  it("uses fog stamp text, not a literal middle-dot pip", () => {
    const fog = fogTreatmentFor("Rumored", 2);
    const ops = pinPaintOps({
      id: "homeworld",
      channels: channelsFor({ intel: "Rumored", ownership: "open", health: "anchored", stabilityMilli: 500 }),
      fog,
      zoom: "map",
      x: 0,
      y: 0
    });
    const stamp = ops.find((o) => o.op === "fog-stamp");
    expect(stamp).toBeDefined();
    expect(stamp).toMatchObject({ op: "fog-stamp", text: fog.stamp });
    expect(stamp && "text" in stamp ? stamp.text : "").not.toBe("·");
  });

  it("emits slot dots at map and shapes at detail; net-loam only at detail when provided", () => {
    const slots = [
      { slotIndex: 0, slotTypeId: "rootbed" },
      { slotIndex: 1, slotTypeId: "seat" }
    ];
    const mapOps = pinPaintOps({
      id: "homeworld",
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 900 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "map",
      x: 0,
      y: 0,
      slots,
      netLoam: 22
    });
    expect(mapOps.some((o) => o.op === "slot-dot")).toBe(true);
    expect(mapOps.some((o) => o.op === "slot-shape")).toBe(false);
    expect(mapOps.some((o) => o.op === "net-loam")).toBe(false);

    const detailOps = pinPaintOps({
      id: "homeworld",
      channels: channelsFor({ intel: "Watched", ownership: "yours", health: "anchored", stabilityMilli: 900 }),
      fog: fogTreatmentFor("Watched", 0),
      zoom: "detail",
      x: 0,
      y: 0,
      slots,
      netLoam: 22
    });
    expect(detailOps.some((o) => o.op === "slot-shape")).toBe(true);
    expect(detailOps.some((o) => o.op === "net-loam" && o.text === "22")).toBe(true);
  });
});
