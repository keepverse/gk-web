import { describe, expect, it } from "vitest";
import type { WorldTurnEntryDto, WorldTurnReportDto } from "@/lib/bus/world";
import { stepPlayback, toKeyframes } from "./turnPlayback";

const entry = (
  phase: string,
  kind: string,
  subject: string,
  detail: string
): WorldTurnEntryDto => ({ phase, kind, subject, detail });

const report = (...entries: WorldTurnEntryDto[]): WorldTurnReportDto => ({
  turn: 3,
  stateHash: "abc",
  phases: [...new Set(entries.map((e) => e.phase))],
  entries
});

describe("toKeyframes", () => {
  it("drops the accepted-command noise and keeps what actually happened", () => {
    const frames = toKeyframes(
      report(
        entry("Reveal", "command.accepted", "t0-dave", "move"),
        entry("Movement", "event", "e-dave-legion-1", "arrival:ember-hollow")
      )
    );

    expect(frames).toHaveLength(1);
    expect(frames[0].kind).toBe("march");
  });

  it("keeps report order — the engine already wrote the turn in the order it unfolded", () => {
    const frames = toKeyframes(
      report(
        entry("Movement", "event", "b", "arrival:ash-waste"),
        entry("Movement", "event", "a", "arrival:ember-hollow"),
        entry("Sieges", "battle", "t1:guard:x", "guard:ember-hollow:a")
      )
    );

    expect(frames.map((f) => f.subject)).toEqual(["b", "a", "t1:guard:x"]);
    expect(frames.map((f) => f.index)).toEqual([0, 1, 2]);
  });

  it("lights up the place a battle happened, not the winner", () => {
    const frames = toKeyframes(
      report(entry("Movement", "battle", "t1:lane:x", "lane:l-home-ember:e-dave-legion-1"))
    );

    expect(frames[0].focusId).toBe("l-home-ember");
    expect(frames[0].text).toContain("e-dave-legion-1 wins");
  });

  it("says plainly when nobody won", () => {
    const frames = toKeyframes(
      report(entry("Movement", "battle", "t1:sector:x", "sector:ember-hollow:none"))
    );

    expect(frames[0].text).toContain("nobody wins");
  });

  it("classifies every wave-1 report line", () => {
    const frames = toKeyframes(
      report(
        entry("Reveal", "command.dropped", "t1-dave", "entity.routed"),
        entry("Movement", "event", "a", "arrival:ember-hollow"),
        entry("Movement", "event", "a", "halt:zoc:ash-waste"),
        entry("Sieges", "battle", "b1", "guard:ember-hollow:a"),
        entry("Pressure", "event", "dave", "supply.cut:ash-waste"),
        entry("Events", "calendar", "week", "ordinary"),
        entry("Snapshot", "event", "k1", "claim.held:ember-hollow")
      )
    );

    expect(frames.map((f) => f.kind)).toEqual([
      "order",
      "march",
      "halt",
      "battle",
      "supply",
      "calendar",
      "claim"
    ]);
  });

  it("never classifies `attrition:` — the engine dropped it (LegionSupply.Resolve replaced wound attrition, SupplyGraph.cs:42-45), and re-adding a row for it is a deliberate act", () => {
    const frames = toKeyframes(
      report(entry("Pressure", "event", "a", "attrition:ash-waste"))
    );

    expect(frames[0].kind).not.toBe("supply");
    expect(frames[0].kind).toBe("note");
  });

  it("names the sector a claim changed hands in", () => {
    const frames = toKeyframes(report(entry("Snapshot", "event", "k1", "claim.held:ember-hollow")));
    expect(frames[0].text).toBe("ember-hollow changes hands");
    expect(frames[0].focusId).toBe("ember-hollow");
  });

  it("has nothing to play back for a missing report", () => {
    expect(toKeyframes(null)).toEqual([]);
    expect(toKeyframes(undefined)).toEqual([]);
    expect(toKeyframes(report())).toEqual([]);
  });
});

describe("stepPlayback", () => {
  const frames = toKeyframes(
    report(
      entry("Movement", "event", "a", "arrival:ember-hollow"),
      entry("Movement", "event", "b", "arrival:ash-waste")
    )
  );

  it("walks forward and back", () => {
    expect(stepPlayback(0, frames, 1)).toBe(1);
    expect(stepPlayback(1, frames, -1)).toBe(0);
  });

  it("stops at both ends instead of running off", () => {
    expect(stepPlayback(1, frames, 5)).toBe(1);
    expect(stepPlayback(0, frames, -5)).toBe(0);
  });

  it("stays at zero when there is nothing to play", () => {
    expect(stepPlayback(0, [], 1)).toBe(0);
  });
});
