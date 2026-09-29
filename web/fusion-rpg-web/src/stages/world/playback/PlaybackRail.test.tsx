import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { foldTurnReport } from "@/stages/world/playbackKeyframes";
import type { WorldTurnEntryDto, WorldTurnReportDto } from "@/lib/bus/world";
import { PlaybackRail } from "./PlaybackRail";

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

describe("PlaybackRail (world-stage W75)", () => {
  it("renders nothing to play back honestly, not an empty phase list", () => {
    render(<PlaybackRail phases={[]} activeIndex={0} />);
    expect(screen.getByTestId("playback-rail-empty")).toHaveTextContent("No turn report to play back yet.");
  });

  it("renders phases in report order, not resorted", () => {
    const phases = foldTurnReport(
      report(
        ["Movement", "Sieges", "Pressure"],
        entry("Movement", "event", "a", "arrival:ember-hollow", "ember-hollow"),
        entry("Sieges", "battle", "t1:guard:x", "guard:ember-hollow:a"),
        entry("Pressure", "event", "dave", "supply.cut:ash-waste", "ash-waste")
      )
    );
    render(<PlaybackRail phases={phases} activeIndex={0} />);

    const sections = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(sections).toEqual(["Movement", "Sieges", "Pressure"]);
  });

  it("gives Growth its own designed 'nothing grew' line rather than a blank gap", () => {
    const phases = foldTurnReport(report(["Movement", "Growth"], entry("Movement", "event", "a", "arrival:x", "x")));
    render(<PlaybackRail phases={phases} activeIndex={0} />);

    expect(screen.getByTestId("playback-phase-empty-Growth")).toHaveTextContent("Nothing grew this night.");
  });

  it("marks exactly the active keyframe, by index, not by text search", () => {
    const phases = foldTurnReport(
      report(
        ["Movement"],
        entry("Movement", "event", "a", "arrival:ember-hollow", "ember-hollow"),
        entry("Movement", "event", "b", "arrival:ash-waste", "ash-waste")
      )
    );
    render(<PlaybackRail phases={phases} activeIndex={1} />);

    expect(screen.getByTestId("playback-keyframe-0")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("playback-keyframe-1")).toHaveAttribute("data-active", "true");
  });

  it("renders real prose through the one translation table, never a raw engine token", () => {
    const phases = foldTurnReport(
      report(["Pressure"], entry("Pressure", "event", "dave", "loam.handicap:150", "ember-hollow"))
    );
    render(<PlaybackRail phases={phases} activeIndex={0} />);

    expect(screen.getByTestId("playback-keyframe-0")).toHaveTextContent("15%");
  });
});
