import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { pendingWithReason } from "@/contract/pending";
import type { MemberView, PartyView } from "@/contract/types";
import { PartyRail } from "./PartyRail";

function member(instanceId: string): MemberView {
  return {
    instanceId,
    pools: { hp: { unit: "count", value: 80 } },
    poolMax: pendingWithReason("test"),
    poolFill: pendingWithReason("test"),
    nerveStacks: 0,
    nerveStage: pendingWithReason("test"),
    downed: false,
    downedOnce: false,
    shield: pendingWithReason("test"),
    statuses: pendingWithReason("test")
  };
}

function party(partyIndex: number, entityId: number, haulCount: number): PartyView {
  return {
    partyIndex,
    entityId,
    atSectorId: "s-1",
    onLaneId: null,
    route: ["s-1"],
    members: [member(`m-${entityId}-1`)],
    pack: pendingWithReason("test"),
    haul: Array.from({ length: haulCount }, (_, i) => ({
      kind: "creature",
      speciesId: "sp-1",
      rarity: "common",
      variant: "base",
      traitIds: [],
      row: 0,
      col: i,
      n: 1
    }))
  };
}

describe("PartyRail (D5.6, spec-delve-stage.md §7 — party strip, parties by name)", () => {
  it("Party_labels_are_names_not_indices — every one of the four real banner names renders, and none of them is a bare ordinal", () => {
    // Haul counts (7, 12, 3, 9) are deliberately not sequential-looking, so this test cannot pass by
    // accidentally matching some OTHER rendered number to the party's own index.
    const parties = [party(0, 501, 7), party(1, 502, 12), party(2, 503, 3), party(3, 504, 9)];
    render(<PartyRail parties={parties} />);

    const expectedNames = ["First Banner", "Second Banner", "Third Banner", "Fourth Banner"];
    parties.forEach((p, i) => {
      const nameEl = screen.getByTestId(`delve-party-banner-name-${p.entityId}`);
      expect(nameEl).toHaveTextContent(expectedNames[i]!);
      // The literal acceptance wording: "no rendered string carries a bare ordinal" — the banner's
      // own name text is never the bare partyIndex, in any form (0-based or 1-based).
      expect(nameEl.textContent).not.toBe(String(p.partyIndex));
      expect(nameEl.textContent).not.toBe(String(p.partyIndex + 1));
      expect(/^\d+$/.test(nameEl.textContent ?? "")).toBe(false);
    });
  });

  it("a raid of four resolves with four distinctly-named parties on screen at once (G5's own success criterion 3)", () => {
    const parties = [party(0, 501, 0), party(1, 502, 0), party(2, 503, 0), party(3, 504, 0)];
    render(<PartyRail parties={parties} />);
    expect(screen.getByText("First Banner")).toBeInTheDocument();
    expect(screen.getByText("Second Banner")).toBeInTheDocument();
    expect(screen.getByText("Third Banner")).toBeInTheDocument();
    expect(screen.getByText("Fourth Banner")).toBeInTheDocument();
  });

  it("haul: a non-empty haul renders a real count through formatMagnitude", () => {
    render(<PartyRail parties={[party(0, 501, 4)]} />);
    expect(screen.getByTestId("delve-party-haul-501")).toHaveTextContent("4 to carry out");
  });

  it("haul: an empty haul renders its own honest empty state, never '0 to carry out'", () => {
    render(<PartyRail parties={[party(0, 501, 0)]} />);
    expect(screen.getByTestId("delve-party-haul-501")).toHaveTextContent("Nothing to carry yet");
  });

  it("renders one member row per party member, nested under its own party", () => {
    const p = party(0, 501, 0);
    render(<PartyRail parties={[p]} />);
    expect(screen.getByTestId(`delve-member-${p.members[0]!.instanceId}`)).toBeInTheDocument();
  });
});
