import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import { adaptDelveQuest } from "@/contract/adapt";
import type { QuestView } from "@/contract/types";
import { QuestTracker } from "./QuestTracker";

describe("QuestTracker (D5.6, spec-delve-stage.md §7 — the quest tracker)", () => {
  it("pending: renders the real, live reason — matching adaptDelve's own current, honest gap", () => {
    render(<QuestTracker quests={pendingWithReason("Quest progress isn't shown yet")} />);
    expect(screen.getByTestId("delve-quest-tracker-pending")).toHaveTextContent("Quest progress isn't shown yet");
  });

  it("known, empty: an honest 'no quests' state, not a blank tracker", () => {
    render(<QuestTracker quests={known([])} />);
    expect(screen.getByTestId("delve-quest-tracker-empty")).toBeInTheDocument();
  });

  it("known, populated: renders through the real adaptDelveQuest shape — have/need as formatted counts, done as a distinct style", () => {
    const quests: QuestView[] = [
      adaptDelveQuest({ name: "Clear the fen", flavor: "Something stirs in the reeds.", have: 2, need: 5, done: false }),
      adaptDelveQuest({ name: "Find the shrine", flavor: "An old stone calls.", have: 1, need: 1, done: true })
    ];
    render(<QuestTracker quests={known(quests)} />);

    expect(screen.getByTestId("delve-quest-progress-Clear the fen")).toHaveTextContent("2 / 5");
    expect(screen.getByTestId("delve-quest-name-Find the shrine")).toHaveClass("text-ok");
    expect(screen.getByTestId("delve-quest-name-Clear the fen")).not.toHaveClass("text-ok");
  });
});
