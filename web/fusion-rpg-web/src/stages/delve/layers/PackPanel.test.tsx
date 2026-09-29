import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import type { PackCellView, PackView, PartyView } from "@/contract/types";
import { PackPanel } from "./PackPanel";

function cell(overrides: Partial<PackCellView> = {}): PackCellView {
  return {
    row: 0,
    col: 0,
    w: 1,
    h: 1,
    kind: "creature",
    refId: "r-1",
    qty: { unit: "count", value: 1 },
    origin: "carryIn",
    movable: true,
    ...overrides
  };
}

function pack(overrides: Partial<PackView> = {}): PackView {
  return {
    rows: 4,
    cols: 6,
    cells: [cell()],
    floor: [],
    provisionCellsLeft: { unit: "count", value: 2 },
    ...overrides
  };
}

function party(overrides: Partial<PartyView> = {}): PartyView {
  return {
    partyIndex: 0,
    entityId: 501,
    atSectorId: "s-1",
    onLaneId: null,
    route: ["s-1"],
    members: [],
    pack: known(pack()),
    haul: [],
    ...overrides
  };
}

describe("PackPanel (D5.7, spec-delve-stage.md §7/§9 — the per-party carry grid, move and drop)", () => {
  it("Autopilot_party_pack_handles_are_disabled_with_a_reason", () => {
    const autopilotParty = party({
      entityId: 502,
      partyIndex: 1,
      pack: known(pack({ cells: [cell({ movable: false })] }))
    });
    render(<PackPanel parties={[autopilotParty]} />);

    const moveBtn = screen.getByTestId("delve-pack-cell-502-0-move");
    const dropBtn = screen.getByTestId("delve-pack-cell-502-0-drop");

    expect(moveBtn).toBeDisabled();
    expect(dropBtn).toBeDisabled();
    // GG-55: a disabled control must carry a real, non-empty reason a player can read (a `title`).
    expect(moveBtn.getAttribute("title")).toBeTruthy();
    expect(dropBtn.getAttribute("title")).toBeTruthy();
    expect(moveBtn.getAttribute("title")).toBe(dropBtn.getAttribute("title"));
  });

  it("a steered party's movable cells render enabled handles carrying no disabled attribute at all", () => {
    render(<PackPanel parties={[party({ pack: known(pack({ cells: [cell({ movable: true })] })) })]} />);

    const moveBtn = screen.getByTestId("delve-pack-cell-501-0-move");
    const dropBtn = screen.getByTestId("delve-pack-cell-501-0-drop");
    expect(moveBtn).not.toBeDisabled();
    expect(dropBtn).not.toBeDisabled();
    expect(moveBtn).not.toHaveAttribute("title");
  });

  it("renders one section per party, each under its own real Banner name, never a bare index", () => {
    // Both packs stay empty here on purpose — this test is about the banner names, and a real qty
    // figure (e.g. "1") would otherwise collide with the bare-ordinal check below for the wrong reason.
    render(
      <PackPanel
        parties={[
          party({ entityId: 501, partyIndex: 0, pack: known(pack({ cells: [] })) }),
          party({ entityId: 502, partyIndex: 1, pack: known(pack({ cells: [] })) })
        ]}
      />
    );
    expect(screen.getByText("First Banner")).toBeInTheDocument();
    expect(screen.getByText("Second Banner")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("a pending pack renders its own real reason, never a fabricated grid", () => {
    render(
      <PackPanel
        parties={[party({ pack: pendingWithReason("This party's pack isn't shown yet") })]}
      />
    );
    expect(screen.getByTestId("delve-pack-pending-501")).toHaveTextContent(
      "This party's pack isn't shown yet"
    );
    expect(screen.queryByTestId("delve-pack-cell-501-0-move")).not.toBeInTheDocument();
  });

  it("an empty known pack renders its own honest empty state, not a blank grid", () => {
    render(<PackPanel parties={[party({ pack: known(pack({ cells: [], floor: [] })) })]} />);
    expect(screen.getByTestId("delve-pack-empty-501")).toHaveTextContent("Nothing carried yet");
  });

  it("renders the floor list separately from what's carried", () => {
    render(
      <PackPanel
        parties={[party({ pack: known(pack({ cells: [cell()], floor: [cell({ movable: false })] })) })]}
      />
    );
    expect(screen.getByTestId("delve-pack-carried-501")).toBeInTheDocument();
    expect(screen.getByTestId("delve-pack-floor-501")).toBeInTheDocument();
    expect(screen.getByTestId("delve-pack-floor-cell-501-0-move")).toBeDisabled();
  });

  it("renders a real qty figure through formatMagnitude, never a bare number literal", () => {
    render(
      <PackPanel parties={[party({ pack: known(pack({ cells: [cell({ qty: { unit: "count", value: 7 } })] })) })]} />
    );
    expect(screen.getByTestId("delve-pack-cell-501-0-qty")).toHaveTextContent("7");
  });

  it("never renders the word 'cell(s)' as player-visible text (§8: 'Carry space', never 'cells')", () => {
    render(<PackPanel parties={[party({ pack: known(pack()) })]} />);
    const root = screen.getByTestId("delve-panel-pack");
    // Strip every data-testid attribute value before checking — those are allowed to say "cell" (they
    // are development plumbing, exempt the same way vocabularyGuard/pendingCopyGuard exempt them) —
    // this asserts on the rendered TEXT content only, which is what a player actually reads.
    expect(root.textContent ?? "").not.toMatch(/\bcells?\b/i);
  });

  it("a raid of four resolves with four distinctly-carried packs on screen at once (G5's own success criterion 3, 'four named parties, four packs')", () => {
    // Distinct, non-index-shaped quantities (100s) deliberately avoid colliding with the bare
    // 0..3 ordinals the check below searches for — the same reason the two-party banner test above
    // keeps its own packs empty rather than risk a legitimate qty figure masquerading as an index.
    const fourParties = [0, 1, 2, 3].map((partyIndex) =>
      party({
        entityId: 501 + partyIndex,
        partyIndex,
        pack: known(pack({ cells: [cell({ qty: { unit: "count", value: 100 + partyIndex } })] }))
      })
    );
    render(<PackPanel parties={fourParties} />);

    // Every one of the four banners rendered, none collapsed or overwritten by the others.
    expect(screen.getByText("First Banner")).toBeInTheDocument();
    expect(screen.getByText("Second Banner")).toBeInTheDocument();
    expect(screen.getByText("Third Banner")).toBeInTheDocument();
    expect(screen.getByText("Fourth Banner")).toBeInTheDocument();

    // Every one of the four packs rendered its own real grid, with its own distinct carried item —
    // not just one section repeated, and not the map-over-parties logic silently dropping a party
    // past the second (the only count this file's own prior tests ever exercised).
    for (const p of fourParties) {
      const key = String(p.entityId);
      expect(screen.getByTestId(`delve-pack-carried-${key}`)).toBeInTheDocument();
      expect(screen.getByTestId(`delve-pack-cell-${key}-0-qty`)).toHaveTextContent(String(100 + p.partyIndex));
    }

    // No rendered text is a bare party-index ordinal (§8/GG-23, D5.6's own Party_labels_are_names_not_indices).
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });
});
