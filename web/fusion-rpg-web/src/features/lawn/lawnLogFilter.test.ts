import { describe, expect, it } from "vitest";
import {
  formatLastHit,
  isCombatHitKind,
  lastHitFromEnvelope
} from "./lawnLogFilter";
import { shouldPollBoardStats } from "./lawnViewModel";
import type { EventEnvelope } from "@/lib/bus/types";

describe("isCombatHitKind", () => {
  it("matches combat.hit and hitland only", () => {
    expect(isCombatHitKind("combat.hit")).toBe(true);
    expect(isCombatHitKind("combat.hitland")).toBe(true);
    expect(isCombatHitKind("plant.spawn")).toBe(false);
    expect(isCombatHitKind(undefined)).toBe(false);
  });
});

describe("lastHitFromEnvelope", () => {
  it("parses payload fields", () => {
    const e: EventEnvelope = {
      kind: "combat.hit",
      t: "t",
      game: "g",
      payload: { side: "zombie", damage: 4, targetPtr: "P", source: "pea" }
    };
    expect(lastHitFromEnvelope(e)).toEqual({
      side: "zombie",
      damage: 4,
      targetPtr: "P",
      source: "pea"
    });
  });

  it("returns null for non-hits", () => {
    expect(lastHitFromEnvelope({ kind: "plant.spawn", t: "t", game: "g" })).toBeNull();
    expect(lastHitFromEnvelope(null)).toBeNull();
  });
});

describe("formatLastHit", () => {
  it("formats missing as dash", () => {
    expect(formatLastHit(null)).toBe("—");
    expect(formatLastHit({ source: "pea", damage: 3, targetPtr: "Z" })).toBe(
      "pea dmg 3 → Z"
    );
  });
});

describe("shouldPollBoardStats", () => {
  it("polls InMatch, Paused, Starting; not Idle", () => {
    expect(shouldPollBoardStats("InMatch")).toBe(true);
    expect(shouldPollBoardStats("Paused")).toBe(true);
    expect(shouldPollBoardStats("Starting")).toBe(true);
    expect(shouldPollBoardStats("Idle")).toBe(false);
    expect(shouldPollBoardStats("Ending")).toBe(false);
  });
});
