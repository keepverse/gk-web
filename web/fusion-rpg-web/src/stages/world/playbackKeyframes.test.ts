import { describe, expect, it } from "vitest";
import type { WorldTurnEntryDto, WorldTurnReportDto } from "@/lib/bus/world";
import { flattenKeyframes, foldTurnReport, stepKeyframe } from "./playbackKeyframes";

const entry = (
  phase: string,
  kind: string,
  subject: string,
  detail: string,
  sectorId?: string | null
): WorldTurnEntryDto => ({ phase, kind, subject, detail, sectorId });

const report = (phases: string[], ...entries: WorldTurnEntryDto[]): WorldTurnReportDto => ({
  turn: 3,
  stateHash: "abc",
  phases,
  entries
});

describe("foldTurnReport", () => {
  it("returns nothing for no report", () => {
    expect(foldTurnReport(null)).toEqual([]);
    expect(foldTurnReport(undefined)).toEqual([]);
  });

  it("walks phases in report order, not sorted or reordered", () => {
    const phases = foldTurnReport(
      report(
        ["Movement", "Sieges", "Pressure"],
        entry("Movement", "event", "e-dave-legion-1", "arrival:ember-hollow", "ember-hollow"),
        entry("Sieges", "battle", "t1:guard:x", "guard:ember-hollow:a"),
        entry("Pressure", "event", "dave", "supply.cut:ash-waste", "ash-waste")
      )
    );

    expect(phases.map((p) => p.phase)).toEqual(["Movement", "Sieges", "Pressure"]);
  });

  it("gives a phase that ran with nothing to report its own empty section, not a vanished phase", () => {
    const phases = foldTurnReport(report(["Movement", "Growth", "Pressure"]));

    expect(phases.map((p) => p.phase)).toEqual(["Movement", "Growth", "Pressure"]);
    expect(phases.find((p) => p.phase === "Growth")?.keyframes).toEqual([]);
  });

  it("drops the accepted-command noise, same as the rest of the report pipeline", () => {
    const phases = foldTurnReport(
      report(
        ["Reveal", "Movement"],
        entry("Reveal", "command.accepted", "t0-dave", "move"),
        entry("Movement", "event", "e-dave-legion-1", "arrival:ember-hollow", "ember-hollow")
      )
    );

    expect(flattenKeyframes(phases)).toHaveLength(1);
  });

  it("indexes keyframes contiguously across phase boundaries, never restarting per phase", () => {
    const phases = foldTurnReport(
      report(
        ["Movement", "Sieges"],
        entry("Movement", "event", "a", "arrival:ember-hollow", "ember-hollow"),
        entry("Movement", "event", "b", "arrival:ash-waste", "ash-waste"),
        entry("Sieges", "battle", "t1:guard:x", "guard:ember-hollow:a")
      )
    );

    expect(flattenKeyframes(phases).map((k) => k.index)).toEqual([0, 1, 2]);
  });

  it("reads focusId from the entry's own sectorId field, never by parsing detail text", () => {
    const phases = foldTurnReport(
      report(["Snapshot"], entry("Snapshot", "event", "k1", "claim.held:ember-hollow", "ember-hollow"))
    );

    expect(flattenKeyframes(phases)[0].focusId).toBe("ember-hollow");
  });

  it("renders real prose through the one translation table, never a raw engine token", () => {
    const phases = foldTurnReport(
      report(["Pressure"], entry("Pressure", "event", "dave", "loam.handicap:150", "ember-hollow"))
    );

    expect(flattenKeyframes(phases)[0].text).toContain("15%");
    expect(flattenKeyframes(phases)[0].text).not.toContain("150");
  });
});

describe("stepKeyframe", () => {
  it("clamps at both ends rather than wrapping or going out of range", () => {
    expect(stepKeyframe(0, 5, -1)).toBe(0);
    expect(stepKeyframe(4, 5, 1)).toBe(4);
  });

  it("jumps to either end on an infinite delta — the rail's ⏮/⏭ controls", () => {
    expect(stepKeyframe(2, 5, -Infinity)).toBe(0);
    expect(stepKeyframe(2, 5, Infinity)).toBe(4);
  });

  it("stays at 0 for an empty keyframe list", () => {
    expect(stepKeyframe(0, 0, 1)).toBe(0);
  });
});
