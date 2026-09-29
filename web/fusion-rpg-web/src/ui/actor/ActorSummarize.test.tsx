import { describe, expect, it } from "vitest";
import { known } from "@/contract/pending";
import { ActorSummarize } from "./ActorSummarize";
import { render, screen } from "@testing-library/react";

describe("ActorSummarize", () => {
  it("shows Lv + role-badge — no mute Lv · role sole presentation, no species chips", () => {
    render(
      <ActorSummarize
        displayName={known("Emberling")}
        instanceId="a1"
        level={14}
        roleLabel="Plant"
        side="plant"
        collapsed={false}
        sheet={{
          instanceId: "a1",
          playerId: 1,
          side: "plant",
          typeId: 3,
          displayName: "Emberling",
          speciesId: "ember-sprout",
          speciesName: "Ember Sprout",
          phase: "ActiveBound",
          roleLabel: "Specimen",
          level: 14,
          xp: 2140,
          xpToNext: 3400,
          elementTyping: { primary: "fire", secondary: "earth" },
          derived: [],
          primary: []
        }}
      />
    );
    expect(screen.getByTestId("actor-summarize-level")).toHaveTextContent("Lv 14");
    const badge = screen.getByTestId("role-badge");
    expect(badge).toHaveTextContent("Specimen");
    expect(badge).toHaveClass("role-badge");
    expect(screen.getByTestId("actor-summarize-meta").textContent).not.toMatch(/Lv 14\s*·/);
    expect(screen.queryByText("Ember Sprout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actor-summarize-element-fire")).not.toBeInTheDocument();
  });

  it("omits role-badge when roleLabel is empty whitespace", () => {
    render(
      <ActorSummarize
        displayName={known("Emberling")}
        instanceId="a1"
        level={7}
        roleLabel="   "
        side="zombie"
        collapsed={false}
      />
    );
    expect(screen.getByTestId("actor-summarize-level")).toHaveTextContent("Lv 7");
    expect(screen.queryByTestId("role-badge")).not.toBeInTheDocument();
  });
});
