import { describe, expect, it } from "vitest";
import type { SectorView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { maximalSector } from "@/stages/world/inspector/fixtures/maximalSector";
import { healthOf, ownershipOf } from "./sectorHealthAndOwnership";

const count = (value: number) => ({ unit: "count" as const, value });

function sector(overrides: Partial<SectorView> = {}): SectorView {
  return { ...maximalSector, ...overrides };
}

describe("ownershipOf — yours/enemy/open, contested never derived without forces (world-stage scene wiring)", () => {
  it("yours: the owner matches the player's own faction", () => {
    expect(ownershipOf(sector({ ownerFactionId: "dave" }), "dave")).toBe("yours");
  });

  it("open: no owner at all", () => {
    expect(ownershipOf(sector({ ownerFactionId: null }), "dave")).toBe("open");
  });

  it("enemy: an owner that is not the player", () => {
    expect(ownershipOf(sector({ ownerFactionId: "zomboss" }), "dave")).toBe("enemy");
  });
});

describe("healthOf — the derivable states, in priority order (world-stage scene wiring)", () => {
  it("will-release wins over every other signal", () => {
    const s = sector({ willReleaseNextTurn: true, habitable: false });
    expect(healthOf(s, "yours")).toBe("will-release");
  });

  it("barren: uninhabitable ground, once release is ruled out", () => {
    const s = sector({ willReleaseNextTurn: false, habitable: false });
    expect(healthOf(s, "yours")).toBe("barren");
  });

  it("warded: your own sector with a known, non-null warden binding", () => {
    const s = sector({ willReleaseNextTurn: false, habitable: true, wardenBindingId: known("e-warden-1") });
    expect(healthOf(s, "yours")).toBe("warded");
  });

  it("a warden binding on ground that is not yours never reads as warded", () => {
    const s = sector({ willReleaseNextTurn: false, habitable: true, wardenBindingId: known("e-warden-1") });
    expect(healthOf(s, "enemy")).not.toBe("warded");
  });

  it("neglected: your own sector, no warden, real neglected turns", () => {
    const s = sector({
      willReleaseNextTurn: false,
      habitable: true,
      wardenBindingId: known(null),
      neglectedTurns: known(count(3))
    });
    expect(healthOf(s, "yours")).toBe("neglected");
  });

  it("fading: stability below the anchored floor, nothing else in play", () => {
    const s = sector({
      willReleaseNextTurn: false,
      habitable: true,
      wardenBindingId: known(null),
      neglectedTurns: known(count(0)),
      stability: { unit: "perMilleRatio", op: "flat", value: 500 }
    });
    expect(healthOf(s, "yours")).toBe("fading");
  });

  it("anchored: everything healthy — the silent, default state", () => {
    const s = sector({
      willReleaseNextTurn: false,
      habitable: true,
      wardenBindingId: known(null),
      neglectedTurns: known(count(0)),
      stability: { unit: "perMilleRatio", op: "flat", value: 950 }
    });
    expect(healthOf(s, "yours")).toBe("anchored");
  });

  it("a Pending warden/neglect reading never fabricates warded/neglected — falls through honestly", () => {
    const s = sector({
      willReleaseNextTurn: false,
      habitable: true,
      wardenBindingId: pendingWithReason("not surveyed"),
      neglectedTurns: pendingWithReason("not surveyed"),
      stability: { unit: "perMilleRatio", op: "flat", value: 950 }
    });
    expect(healthOf(s, "yours")).toBe("anchored");
  });
});
