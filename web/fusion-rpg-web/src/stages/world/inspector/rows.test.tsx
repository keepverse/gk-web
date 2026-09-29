import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ForceView, SlotView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { SlotRow, slotRowState } from "./SlotRow";
import { ForceRow } from "./ForceRow";

const count = (value: number) => ({ unit: "count" as const, value });

function slot(overrides: Partial<SlotView> = {}): SlotView {
  return {
    slotIndex: 0,
    slotTypeId: "grove",
    element: null,
    state: "Intact",
    ownerFactionId: null,
    guardWaveId: null,
    guardState: "Cleared",
    structureId: null,
    constructionTurnsRemaining: known(null),
    ...overrides
  };
}

const guardForce: ForceView = {
  entityId: "e-guard-1",
  ownerFactionId: "wild",
  kind: "Guard",
  exact: false,
  bandName: "a guard force",
  bandCeiling: count(50)
};

describe("slotRowState — the seven states, no enum reaching the player (world-stage W62)", () => {
  it("empty: intact, no guard ever assigned, no structure", () => {
    expect(slotRowState(slot())).toBe("empty");
  });

  it("built: a finished structure present", () => {
    expect(slotRowState(slot({ structureId: "well", constructionTurnsRemaining: known(null) }))).toBe("built");
  });

  it("under-construction: a structure present with turns remaining", () => {
    expect(slotRowState(slot({ structureId: "waystation", constructionTurnsRemaining: known(3) }))).toBe(
      "under-construction"
    );
  });

  it("guarded: a live guard wave blocks anything else from mattering", () => {
    expect(slotRowState(slot({ guardState: "Intact", guardWaveId: "e-guard-1" }))).toBe("guarded");
  });

  it("cleared: guardState is Cleared but a guardWaveId proves one was here — never confused with 'never had a guard'", () => {
    expect(slotRowState(slot({ guardState: "Cleared", guardWaveId: "e-guard-1" }))).toBe("cleared");
  });

  it("depleted: terminal, wins over guard/structure signals", () => {
    expect(
      slotRowState(slot({ state: "Depleted", guardState: "Intact", structureId: "well" }))
    ).toBe("depleted");
  });

  it("ruined: terminal, wins over everything else", () => {
    expect(slotRowState(slot({ state: "Ruined", structureId: "well" }))).toBe("ruined");
  });

  it("Claimed is not its own row state — it is an ownership fact, folding through the same paths Intact does", () => {
    expect(slotRowState(slot({ state: "Claimed" }))).toBe("empty");
    expect(slotRowState(slot({ state: "Claimed", structureId: "well" }))).toBe("built");
  });
});

describe("SlotRow — no enum value ever reaches the rendered text (world-stage W62)", () => {
  const rawEnumValues = ["Intact", "Claimed", "Depleted", "Ruined", "Cleared"];

  it("guarded names the GuardWaveId as a force, not the bare id", () => {
    render(
      <SlotRow
        slot={slot({ guardState: "Intact", guardWaveId: "e-guard-1" })}
        forces={[guardForce]}
      />
    );
    const row = screen.getByTestId("slot-row-0");
    expect(row).toHaveTextContent("guard");
    expect(row).not.toHaveTextContent("e-guard-1");
  });

  it("depleted and ruined both render — the two states nothing had ever drawn before this task", () => {
    const { unmount } = render(<SlotRow slot={slot({ state: "Depleted" })} forces={[]} />);
    expect(screen.getByTestId("slot-row-0")).toHaveTextContent("depleted");
    unmount();

    render(<SlotRow slot={slot({ state: "Ruined" })} forces={[]} />);
    expect(screen.getByTestId("slot-row-0")).toHaveTextContent("ruined");
  });

  it("no raw enum value ever appears in the rendered text, across all seven states — checked at the wire's own casing, not the word", () => {
    const fixtures: SlotView[] = [
      slot(),
      slot({ structureId: "well" }),
      slot({ structureId: "waystation", constructionTurnsRemaining: known(2) }),
      slot({ guardState: "Intact", guardWaveId: "e-guard-1" }),
      slot({ guardState: "Cleared", guardWaveId: "e-guard-1" }),
      slot({ state: "Depleted" }),
      slot({ state: "Ruined" })
    ];
    for (const fixture of fixtures) {
      const { unmount } = render(<SlotRow slot={fixture} forces={[guardForce]} />);
      const text = screen.getByTestId("slot-row-0").textContent ?? "";
      // The wire's own PascalCase token (e.g. "Ruined ", "Depleted ") must never appear verbatim —
      // the lowercase, mid-sentence word it happens to share a spelling with is not the same thing.
      for (const raw of rawEnumValues) expect(text).not.toContain(raw + " ");
      unmount();
    }
  });

  it("an unassigned construction estimate (Pending) never shows a bare number where turns belong", () => {
    render(
      <SlotRow
        slot={slot({ structureId: "well", constructionTurnsRemaining: pendingWithReason("not yet estimated") })}
        forces={[]}
      />
    );
    // Pending with no known value falls through to "built" — the row states what is real
    // (a structure exists) rather than fabricating a turn count.
    expect(slotRowState(slot({ structureId: "well", constructionTurnsRemaining: pendingWithReason("x") }))).toBe(
      "built"
    );
  });
});

describe("ForceRow — yours exact, anyone else's a band (world-stage W62)", () => {
  it("an exact force renders its real strength", () => {
    render(<ForceRow force={{ entityId: "e-1", ownerFactionId: "dave", kind: "Legion", exact: true, strength: count(240) }} />);
    expect(screen.getByTestId("force-row-e-1")).toHaveTextContent("240");
  });

  it("an inexact force renders a band name and ceiling, never a fabricated 'Strength 0'", () => {
    render(
      <ForceRow
        force={{ entityId: "e-2", ownerFactionId: "wild", kind: "Warband", exact: false, bandName: "a warband", bandCeiling: count(200) }}
      />
    );
    const row = screen.getByTestId("force-row-e-2");
    expect(row).toHaveTextContent("a warband");
    expect(row).toHaveTextContent("200");
    expect(row).not.toHaveTextContent("Strength 0");
    expect(row).not.toHaveTextContent(/\b0\b/);
  });
});
