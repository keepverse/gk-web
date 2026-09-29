import { describe, expect, it, vi } from "vitest";
import { APTITUDE_IDS, applyAutoAssignShares, ruleLabel, type AutoAssignRule } from "./autoAssign";
import autoAssignCatalogJson from "../../../../../data/tuning/aptitude-auto-assign-catalog.v1.json";

// spec-assign-ladder.md (EP1.5, W1) -- the fill-logic tests that used to live here (even/posture/
// species-favour scaling, Mode C refusal) moved with the mirror they tested: the ladder is now the
// server's own AssignLadder, exercised in tests/FusionRpg.Core.Tests/ClassSystem/AssignLadderTests.cs
// and the /suggest endpoint tests. This file keeps only what stayed on the FE side.
describe("aptitude autoAssign (FE remainder after EP1.5)", () => {
  it("APTITUDE_IDS names all twelve", () => {
    expect(APTITUDE_IDS).toHaveLength(12);
  });

  it("applyAutoAssignShares writes via setValue only", () => {
    const setValue = vi.fn();
    applyAutoAssignShares(setValue, { Might: 7, Fortitude: 3 });
    expect(setValue).toHaveBeenCalledWith("Might", 7);
    expect(setValue).toHaveBeenCalledWith("Fortitude", 3);
    expect(setValue).toHaveBeenCalledWith("Agility", 0);
    expect(setValue.mock.calls).toHaveLength(12);
  });

  // spec-auto-assign-control.md (EP1.20) — the display text is catalog-sourced, never a literal
  // baked into this file. Reads BOTH sides dynamically so a copy pass changing the catalog can
  // never desync this test from the real content (never pin the catalog's own string here).
  it("ruleLabel reads the catalog, not a hardcoded string", () => {
    for (const entry of autoAssignCatalogJson.entries) {
      expect(ruleLabel(entry.id)).toBe(entry.displayName);
    }
  });

  it("every closed rule id has exactly one catalog entry", () => {
    const closedIds: AutoAssignRule[] = [
      "even",
      "posture-force",
      "posture-finesse",
      "posture-bastion",
      "active-preset",
      "species-favour"
    ];
    const catalogIds = autoAssignCatalogJson.entries.map((e) => e.id);
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    for (const id of closedIds) {
      expect(catalogIds.filter((c) => c === id)).toHaveLength(1);
    }
  });

  it("ruleLabel falls back to the raw id outside the closed vocabulary (defensive only)", () => {
    expect(ruleLabel("not-a-real-rule")).toBe("not-a-real-rule");
  });
});
