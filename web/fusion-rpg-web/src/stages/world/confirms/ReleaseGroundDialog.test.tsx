import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Magnitude, SlotView } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { ReleaseGroundDialog, type ReleaseGroundDialogProps } from "./ReleaseGroundDialog";

function loam(value: number): Magnitude {
  return { unit: "loamUnits", value };
}

function slot(overrides?: Partial<SlotView>): SlotView {
  return {
    slotIndex: 0,
    slotTypeId: "well",
    element: null,
    state: "built",
    ownerFactionId: "player",
    guardWaveId: null,
    guardState: "none",
    structureId: null,
    constructionTurnsRemaining: pendingWithReason("not projected"),
    ...overrides
  };
}

function baseProps(overrides?: Partial<ReleaseGroundDialogProps>): ReleaseGroundDialogProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    sectorName: "Frost Mire",
    componentProduction: loam(210),
    componentUpkeep: loam(248),
    componentStock: loam(0),
    splitsTerritory: false,
    slots: [],
    pourOptions: [],
    onPourLoam: vi.fn(),
    ...overrides
  };
}

describe("ReleaseGroundDialog (world-stage W104, spec-world-confirms.md §4)", () => {
  it("names both halves of the arithmetic and the shortfall — never just one number", () => {
    render(<ReleaseGroundDialog {...baseProps()} />);
    const arithmetic = screen.getByTestId("release-ground-arithmetic");
    expect(arithmetic).toHaveTextContent("210");
    expect(arithmetic).toHaveTextContent("248");
    expect(arithmetic).toHaveTextContent("38"); // the shortfall, 248 - 210
    expect(arithmetic).toHaveTextContent("empty");
  });

  it("names the sector that goes", () => {
    render(<ReleaseGroundDialog {...baseProps()} />);
    expect(screen.getByTestId("release-ground-sector")).toHaveTextContent("Frost Mire");
  });

  it("what goes with it — built slots are named, and an empty sector says so plainly", () => {
    render(<ReleaseGroundDialog {...baseProps()} />);
    expect(screen.getByTestId("release-ground-slots-empty")).toBeInTheDocument();

    render(
      <ReleaseGroundDialog
        {...baseProps({
          slots: [slot({ slotIndex: 1, structureId: "waystation", constructionTurnsRemaining: known(3) })]
        })}
      />
    );
    const row = screen.getByTestId("release-ground-slot-1");
    expect(row).toHaveTextContent("waystation");
    expect(row).toHaveTextContent("3 nights of building lost");
  });

  it("states whether losing it splits the territory, both ways", () => {
    const { rerender } = render(<ReleaseGroundDialog {...baseProps({ splitsTerritory: false })} />);
    expect(screen.getByTestId("release-ground-split")).toHaveTextContent("will not split");

    rerender(<ReleaseGroundDialog {...baseProps({ splitsTerritory: true })} />);
    expect(screen.getByTestId("release-ground-split")).toHaveTextContent("cut your territory in two");
  });

  it("offers pour-in-the-shortfall with what a legion is actually carrying, checkable rather than aspirational", async () => {
    const user = userEvent.setup();
    const onPourLoam = vi.fn();
    render(
      <ReleaseGroundDialog
        {...baseProps({
          pourOptions: [{ entityId: "e-1", displayName: "Legion 1", carriedLoam: known(loam(60)) }],
          onPourLoam
        })}
      />
    );
    const row = screen.getByTestId("release-ground-pour-e-1");
    expect(row).toHaveTextContent("Legion 1");
    expect(row).toHaveTextContent("60");

    await user.click(screen.getByTestId("release-ground-pour-button-e-1"));
    expect(onPourLoam).toHaveBeenCalledWith("e-1");
  });

  it("says plainly when nothing nearby could pour in", () => {
    render(<ReleaseGroundDialog {...baseProps({ pourOptions: [] })} />);
    expect(screen.getByTestId("release-ground-pour-empty")).toBeInTheDocument();
  });

  it("offers no bind-a-warden act — the warden is retired (warden-freeze-fix, server RulesetVersion 13)", () => {
    // A binding no longer stops a sector fading and the server refuses every bind with
    // `warden.retired`, so this dialog must neither start a bind nor list one as a way to stop the
    // release. It was the only designed opener of `BindWardenDialog`.
    const { container } = render(
      <ReleaseGroundDialog
        {...baseProps({
          pourOptions: [{ entityId: "e-1", displayName: "Legion 1", carriedLoam: known(loam(10)) }]
        })}
      />
    );
    expect(screen.queryByTestId("release-ground-bind-warden")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/warden/i);
  });

  it("never says 'choose what to release' or any synonym offering a choice of victim", () => {
    const { container } = render(
      <ReleaseGroundDialog
        {...baseProps({
          slots: [slot({ slotIndex: 2, structureId: "waystation" })],
          pourOptions: [{ entityId: "e-1", displayName: "Legion 1", carriedLoam: known(loam(10)) }]
        })}
      />
    );
    expect(container.textContent).not.toMatch(/choose what to release/i);
    expect(container.textContent).not.toMatch(/pick which sector/i);
    expect(container.textContent).not.toMatch(/select which ground/i);
  });

  it("declares no z-index", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const text = readFileSync(join(__dirname, "ReleaseGroundDialog.tsx"), "utf8");
    expect(text).not.toMatch(/zIndex\s*[:=]|z-index\s*:/);
  });
});
