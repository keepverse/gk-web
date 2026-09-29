import { beforeEach, describe, expect, it } from "vitest";
import {
  appendLogEvent,
  appendLogEvents,
  clearLogEvents,
  getLawnMembershipRing,
  getLogEvents,
  isCaptureGame
} from "./log-store";
import type { EventEnvelope } from "./types";

const ev = (game: string, kind: string, id: number): EventEnvelope => ({
  id,
  t: new Date(id).toISOString(),
  game,
  kind,
  matchKey: "m"
});

describe("live feed game filter (spec-match-source-core precondition 8)", () => {
  beforeEach(() => clearLogEvents());

  it("classifies capture games", () => {
    expect(isCaptureGame("pvzrh-3.8.1")).toBe(true);
    expect(isCaptureGame("pvzrh-4.0")).toBe(true);
    expect(isCaptureGame("")).toBe(true); // legacy events without a game stamp
    expect(isCaptureGame(undefined)).toBe(true);
    expect(isCaptureGame("webrpg-1")).toBe(false);
  });

  it("web battle bursts never enter the live log ring", () => {
    appendLogEvents([
      ev("pvzrh-3.8.1", "zombie.spawn", 1),
      ev("webrpg-1", "board.start", 2),
      ev("webrpg-1", "zombie.die", 3),
      ev("pvzrh-3.8.1", "zombie.die", 4)
    ]);

    const games = getLogEvents().map((e) => e.game);
    expect(games).toEqual(["pvzrh-3.8.1", "pvzrh-3.8.1"]);
  });

  it("single web events are filtered too, and the lawn ring stays capture-only", () => {
    appendLogEvent(ev("webrpg-1", "board.start", 5));
    appendLogEvent(ev("pvzrh-3.8.1", "plant.spawn", 6));

    expect(getLogEvents()).toHaveLength(1);
    expect(getLawnMembershipRing().every((e) => isCaptureGame(e.game))).toBe(true);
  });
});
