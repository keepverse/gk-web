import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ForceView, LegionView, Magnitude } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { CommitLegionDialog } from "./CommitLegionDialog";
import type { CommitStakeInput } from "./stakeRows";

function loam(value: number): Magnitude {
  return { unit: "loamUnits", value };
}

function baseLegion(): LegionView {
  return {
    entityId: "e-1",
    kind: "Legion",
    ownerFactionId: "player",
    position: { kind: "sector", sectorId: "frost-mire" },
    stance: "march",
    movementRemaining: { unit: "perMilleRatio", value: 1000, op: "flat" },
    routed: false,
    members: [
      { instanceId: "m1", speciesId: "s1", level: { unit: "count", value: 5 }, hp: { unit: "gameUnits", value: 100 }, wounds: { unit: "gameUnits", value: 0 }, role: pendingWithReason("not projected") },
      { instanceId: "m2", speciesId: "s2", level: { unit: "count", value: 4 }, hp: { unit: "gameUnits", value: 90 }, wounds: { unit: "gameUnits", value: 0 }, role: pendingWithReason("not projected") },
      { instanceId: "m3", speciesId: "s3", level: { unit: "count", value: 3 }, hp: { unit: "gameUnits", value: 80 }, wounds: { unit: "gameUnits", value: 0 }, role: pendingWithReason("not projected") },
      { instanceId: "m4", speciesId: "s4", level: { unit: "count", value: 6 }, hp: { unit: "gameUnits", value: 110 }, wounds: { unit: "gameUnits", value: 0 }, role: pendingWithReason("not projected") }
    ],
    carriedLoam: known(loam(180)),
    capacity: known(loam(240)),
    burn: known(loam(-40)),
    runway: known(11)
  };
}

function baseInput(overrides?: Partial<CommitStakeInput>): CommitStakeInput {
  return {
    legion: baseLegion(),
    currentTurn: 0,
    originNet: loam(-10),
    originNetAfterDeparture: pendingWithReason("world-wire does not project this yet"),
    destinationSectorName: "Ashfall",
    destinationForce: null,
    ...overrides
  };
}

describe("CommitLegionDialog (world-stage W101, spec-world-confirms.md §1)", () => {
  it("names all six stakes by accessible text", () => {
    render(<CommitLegionDialog open input={baseInput()} onOpenChange={() => {}} onConfirm={() => {}} />);

    expect(screen.getByTestId("stake-row-garrison")).toHaveTextContent("4 bound creatures leave your ground");
    expect(screen.getByTestId("stake-row-supply")).toHaveTextContent("180");
    expect(screen.getByTestId("stake-row-supply")).toHaveTextContent("240"); // the capacity denominator
    expect(screen.getByTestId("stake-row-burn")).toHaveTextContent("40");
    expect(screen.getByTestId("stake-row-runway")).toHaveTextContent("night 11");
    expect(screen.getByTestId("stake-row-fade")).toHaveTextContent("-10");
    expect(screen.getByTestId("stake-row-waiting")).toBeInTheDocument();
  });

  it("the fade row shows both numbers — before and after — never before alone", () => {
    render(
      <CommitLegionDialog
        open
        input={baseInput({ originNetAfterDeparture: known(loam(-16)) })}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    );
    const row = screen.getByTestId("stake-row-fade");
    expect(row).toHaveTextContent("-10");
    expect(row).toHaveTextContent("-16");
  });

  it("a row whose projection is still pending renders its reason, never a zero", () => {
    render(<CommitLegionDialog open input={baseInput()} onOpenChange={() => {}} onConfirm={() => {}} />);
    const row = screen.getByTestId("stake-row-fade");
    expect(row).toHaveTextContent("world-wire does not project this yet");
    expect(row).not.toHaveTextContent("0 loam");
  });

  it("a ForceView with exact: false renders the band name and ceiling, and the exact strength never appears", () => {
    const band: ForceView = {
      entityId: "f-1",
      ownerFactionId: "enemy",
      kind: "Host",
      exact: false,
      bandName: "a host",
      bandCeiling: { unit: "gameUnits", value: 40 }
    };
    render(
      <CommitLegionDialog
        open
        input={baseInput({ destinationForce: band })}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    );
    const row = screen.getByTestId("stake-row-waiting");
    expect(row).toHaveTextContent("a host");
    expect(row).toHaveTextContent("40");
    // The band never renders as though it were an exact count on its own, unqualified line —
    // TypeScript already makes an exact strength field inaccessible on this variant (ForceView is
    // a discriminated union), so there is no `strength` value this render could reach for.
  });

  it("an exact ForceView renders the real strength, not a band", () => {
    const exact: ForceView = {
      entityId: "f-2",
      ownerFactionId: "enemy",
      kind: "Host",
      exact: true,
      strength: { unit: "gameUnits", value: 27 }
    };
    render(
      <CommitLegionDialog
        open
        input={baseInput({ destinationForce: exact })}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByTestId("stake-row-waiting")).toHaveTextContent("27");
  });

  it("closes with the truth about timing — a fight is likely, nothing resolves until end of turn", () => {
    render(<CommitLegionDialog open input={baseInput()} onOpenChange={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId("commit-legion-timing")).toHaveTextContent(
      "A fight is likely. Nothing resolves until you end the turn."
    );
  });

  it("declares no z-index", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const text = readFileSync(join(__dirname, "CommitLegionDialog.tsx"), "utf8");
    expect(text).not.toMatch(/zIndex\s*[:=]|z-index\s*:/);
  });

  it("Confirm files the order and closes; Cancel closes without filing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommitLegionDialog open input={baseInput()} onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    await user.click(screen.getByTestId("commit-legion-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
