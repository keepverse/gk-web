import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent, known, pendingWithReason } from "@/contract/pending";
import type { TalkView } from "@/contract/types";
import { TalkPanel } from "./TalkPanel";

function talkView(offered: string[]): TalkView {
  return {
    offered,
    effectiveBand: pendingWithReason("test"),
    quote: pendingWithReason("test"),
    decision: pendingWithReason("test")
  };
}

describe("TalkPanel (D5.7, spec-delve-stage.md §7 — verbs, wild-room-scoped)", () => {
  it("renders every offered verb through wildVerbLabel, never the raw WildVerb id", () => {
    render(<TalkPanel talk={known(talkView(["Flatter", "OfferSouls", "Leave"]))} />);
    expect(screen.getByTestId("delve-talk-verb-Flatter")).toHaveTextContent("Flatter");
    expect(screen.getByTestId("delve-talk-verb-OfferSouls")).toHaveTextContent("Offer souls");
    expect(screen.getByTestId("delve-talk-verb-Leave")).toHaveTextContent("Leave");
    // The raw ids past their translated words never leak as visible text.
    const root = screen.getByTestId("delve-panel-talk");
    expect(root.textContent).not.toMatch(/OfferSouls/);
  });

  it("a pending talk (a real wild room, no producer yet) renders its own real reason", () => {
    render(<TalkPanel talk={pendingWithReason("What this room has to say isn't shown yet")} />);
    expect(screen.getByTestId("delve-talk-fallback")).toHaveTextContent(
      "What this room has to say isn't shown yet"
    );
  });

  it("an absent talk (no room, or a non-wild room) renders its own honest, non-Pending copy", () => {
    render(<TalkPanel talk={absent()} />);
    expect(screen.getByTestId("delve-talk-fallback")).toHaveTextContent("There's no one to talk to here.");
  });

  it("an unrecognised verb id falls back to a named safe word, never a raw id", () => {
    render(<TalkPanel talk={known(talkView(["SomeFutureVerb"]))} />);
    expect(screen.getByTestId("delve-talk-verb-SomeFutureVerb")).toHaveTextContent("Leave");
  });
});
