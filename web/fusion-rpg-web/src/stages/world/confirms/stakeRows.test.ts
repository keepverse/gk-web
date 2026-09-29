import { describe, expect, it } from "vitest";
import type { LegionView, Magnitude } from "@/contract/types";
import { known, pendingWithReason } from "@/contract/pending";
import { buildCommitStakeRows, type CommitStakeInput } from "./stakeRows";

function loam(value: number): Magnitude {
  return { unit: "loamUnits", value };
}

function member(id: string): LegionView["members"][number] {
  return {
    instanceId: id,
    speciesId: "s",
    level: { unit: "count", value: 1 },
    hp: { unit: "gameUnits", value: 10 },
    wounds: { unit: "gameUnits", value: 0 },
    role: pendingWithReason("not projected")
  };
}

function legionWith(members: number): LegionView {
  return {
    entityId: "e-1",
    kind: "Legion",
    ownerFactionId: "player",
    position: { kind: "sector", sectorId: "frost-mire" },
    stance: "march",
    movementRemaining: { unit: "perMilleRatio", value: 1000, op: "flat" },
    routed: false,
    members: Array.from({ length: members }, (_, i) => member(`m${i}`)),
    carriedLoam: known(loam(180)),
    capacity: known(loam(240)),
    burn: known(loam(-40)),
    runway: known(11)
  };
}

function input(overrides?: Partial<CommitStakeInput>): CommitStakeInput {
  return {
    legion: legionWith(4),
    currentTurn: 3,
    originNet: loam(-10),
    originNetAfterDeparture: pendingWithReason("world-wire does not project this yet"),
    destinationSectorName: "Ashfall",
    destinationForce: null,
    ...overrides
  };
}

describe("buildCommitStakeRows (world-stage W101)", () => {
  it("always produces exactly six rows, in the spec's own order", () => {
    const rows = buildCommitStakeRows(input());
    expect(rows.map((r) => r.id)).toEqual(["garrison", "supply", "burn", "runway", "fade", "waiting"]);
  });

  it("the garrison row's count is the legion's own member count, not a hardcoded four", () => {
    const rows = buildCommitStakeRows(input({ legion: legionWith(7) }));
    const garrison = rows.find((r) => r.id === "garrison")!;
    expect(garrison.data).toEqual({ kind: "garrison", count: { unit: "count", value: 7 } });
  });

  it("passes carriedLoam/capacity/burn/runway straight through — never resolves a Pending itself", () => {
    const pendingLegion = legionWith(1);
    pendingLegion.carriedLoam = pendingWithReason("no capacity endpoint yet");
    const rows = buildCommitStakeRows(input({ legion: pendingLegion }));
    const supply = rows.find((r) => r.id === "supply")!;
    expect(supply.data).toEqual({
      kind: "supply",
      amount: pendingLegion.carriedLoam,
      capacity: pendingLegion.capacity
    });
  });

  it("the runway row carries the absolute turn arithmetic's own inputs, not a pre-computed night", () => {
    const rows = buildCommitStakeRows(input({ currentTurn: 5 }));
    const runway = rows.find((r) => r.id === "runway")!;
    expect(runway.data).toEqual({ kind: "runway", turnsLeft: known(11), currentTurn: 5 });
  });

  it("the fade row carries the before value known and the after value as given (pending here)", () => {
    const rows = buildCommitStakeRows(input());
    const fade = rows.find((r) => r.id === "fade")!;
    expect(fade.data).toEqual({
      kind: "fade",
      before: loam(-10),
      after: pendingWithReason("world-wire does not project this yet")
    });
  });

  it("the waiting row carries the destination name and force through unchanged, including null", () => {
    const rows = buildCommitStakeRows(input());
    const waiting = rows.find((r) => r.id === "waiting")!;
    expect(waiting.data).toEqual({ kind: "waiting", sectorName: "Ashfall", force: null });
  });

  it("every row states a tone from the closed set — no row is untagged", () => {
    const rows = buildCommitStakeRows(input());
    for (const row of rows) {
      expect(["loss", "cost", "clock", "risk"]).toContain(row.tone);
    }
  });
});
