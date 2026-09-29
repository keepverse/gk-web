import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useToastStack } from "@/shell/toastStack";
import { useLayerStack } from "@/shell/layerStack";
import { known, pendingWithReason } from "@/contract/pending";
import { CommitLegionDialog } from "./CommitLegionDialog";
import { BindWardenDialog } from "./BindWardenDialog";
import { ReleaseGroundDialog } from "./ReleaseGroundDialog";
import type { Magnitude } from "@/contract/types";

function loam(value: number): Magnitude {
  return { unit: "loamUnits", value };
}

afterEach(() => {
  useToastStack.getState().clear();
  useLayerStack.getState().popAll();
});

/**
 * world-stage W105 (spec-world-confirms.md §5) — GG-53 gives exactly one class of event the right
 * to take a blocking layer unprompted (run-ending results only, D6); a world notification is never
 * one, and the fade warning is the tempting exception that still must not become it. None of these
 * three dialogs owns any subscription to the toast stack or the turn report at all — each is a pure
 * function of its own `open` prop, controlled entirely by whichever real call site the player
 * actually acted on (still unwired today, per W101/W102/W104's own flagged gaps) — so there is no
 * code path here that *could* open one from a notification even before this test runs it.
 */
describe("No confirms dialog opens itself (world-stage W105)", () => {
  it("static: none of the three dialogs imports the layer stack directly — only DialogShell does, and only while its own open prop is true", () => {
    const violations: string[] = [];
    for (const entry of readdirSync(__dirname)) {
      if (!/Dialog\.tsx$/.test(entry)) continue;
      const text = readFileSync(join(__dirname, entry), "utf8");
      if (/useLayerStack|layerStack/.test(text)) violations.push(entry);
    }
    expect(violations).toEqual([]);
  });

  it("a fade-warning toast pushed through the real toast stack leaves the layer stack empty — nothing here subscribes to it", () => {
    useToastStack.getState().push({
      tone: "warn",
      title: "Frost Mire will release next turn",
      category: "loam.release",
      action: { label: "Show me", run: () => {} }
    });

    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("rendering all three dialogs with open=false leaves the layer stack empty", () => {
    render(
      <>
        <CommitLegionDialog
          open={false}
          onOpenChange={() => {}}
          onConfirm={() => {}}
          input={{
            legion: {
              entityId: "e-1",
              kind: "Legion",
              ownerFactionId: "player",
              position: { kind: "sector", sectorId: "frost-mire" },
              stance: "march",
              movementRemaining: { unit: "perMilleRatio", value: 1000, op: "flat" },
              routed: false,
              members: [],
              carriedLoam: known(loam(0)),
              capacity: known(loam(0)),
              burn: known(loam(0)),
              runway: known(null)
            },
            currentTurn: 0,
            originNet: loam(0),
            originNetAfterDeparture: pendingWithReason("not projected"),
            destinationSectorName: "Ashfall",
            destinationForce: null
          }}
        />
        <BindWardenDialog
          open={false}
          onOpenChange={() => {}}
          onConfirm={() => {}}
          creatureName="Ashkell"
          sectorName="Frost Mire"
          slotsUsedAfterBind={1}
          slotsCapacity={8}
          fee={100}
          upkeepPerDay={100}
          balance={1000}
          refusal={null}
        />
        <ReleaseGroundDialog
          open={false}
          onOpenChange={() => {}}
          sectorName="Frost Mire"
          componentProduction={loam(10)}
          componentUpkeep={loam(20)}
          componentStock={loam(0)}
          splitsTerritory={false}
          slots={[]}
          pourOptions={[]}
          onPourLoam={() => {}}
        />
      </>
    );

    expect(useLayerStack.getState().layers).toEqual([]);
  });
});
