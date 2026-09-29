import { describe, expect, it } from "vitest";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { foldAptitudesSurfaceVm } from "./foldAptitudesSurfaceVm";

describe("foldAptitudesSurfaceVm", () => {
  const surface = actorSurfaceFixture();

  it("Mode A unique emits leftover + decision + Force displayName bands", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = row.id === "Might" ? 10 : 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "unique",
      surface,
      draftShares: draft,
      budget: 100,
      spent: 10,
      leftover: 90,
      dirty: true,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: "Might",
      theta: 14,
      commanderAddOn: "Commander add-on",
      fedFamiliesByAptitudeId: {
        Might: [{ displayName: "Power" }, { displayName: "Crit" }]
      },
      availability: "ready",
      revision: 2
    });
    expect(vm.mode).toBe("unique");
    expect(vm.leftover.leftover).toBe(90);
    expect(vm.decision.dirty).toBe(true);
    expect(vm.scopeChip.title).toBe("Unique specimen");
    expect(vm.scopeChip.subtitle).toBe("Lv 14");
    expect(vm.scopeChip.commanderAddOn).toBe("Commander add-on");
    expect(vm.bands[0]?.displayName).toBe("Force");
    expect(vm.inspect.fedFamilies).toEqual([{ displayName: "Power" }, { displayName: "Crit" }]);
    const tile = (vm.bands[0]?.tiles as { icon?: string }[])?.[0];
    expect(tile?.icon).toBeTruthy();
  });

  it("Mode C commander scope fiction differs", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "commander",
      surface,
      draftShares: draft,
      budget: 300,
      spent: 0,
      leftover: 300,
      dirty: false,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: null,
      theta: 100,
      availability: "ready"
    });
    expect(vm.scopeChip.title).toBe("Commander");
    expect(vm.scopeChip.subtitle).toBe("Ladder 100");
    expect(vm.speciesChrome).toBeUndefined();
  });

  it("chip-honesty (T10): scope subtitle never labels level/ladder as power, for any mode", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    for (const mode of ["unique", "species", "commander"] as const) {
      const vm = foldAptitudesSurfaceVm({
        mode,
        surface,
        draftShares: draft,
        budget: 100,
        spent: 0,
        leftover: 100,
        dirty: false,
        withinBudget: true,
        saving: false,
        selectedAptitudeId: null,
        theta: 42,
        availability: "ready"
      });
      expect(vm.scopeChip.subtitle as string).not.toMatch(/power/i);
      expect(vm.scopeChip.subtitle as string).not.toMatch(/Θ/);
    }
  });

  it("chip-honesty (T10): missing theta renders an honest placeholder, never a fabricated number", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "unique",
      surface,
      draftShares: draft,
      budget: 100,
      spent: 0,
      leftover: 100,
      dirty: false,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: null,
      theta: undefined,
      availability: "ready"
    });
    expect(vm.scopeChip.subtitle).toBe("Lv —");
  });

  it("unique-theta-wire (T17): Mode A shows the wire ladder index beside the level, never in place of it", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const base = {
      mode: "unique" as const,
      surface,
      draftShares: draft,
      budget: 100,
      spent: 0,
      leftover: 100,
      dirty: false,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: null,
      theta: 37,
      availability: "ready" as const
    };
    const withWire = foldAptitudesSurfaceVm({ ...base, ladderIndex: 8 });
    expect(withWire.scopeChip.subtitle).toBe("Lv 37 · Ladder 8");
    expect(withWire.scopeChip.subtitle as string).not.toMatch(/power|Θ/i);
    expect(foldAptitudesSurfaceVm({ ...base, ladderIndex: null }).scopeChip.subtitle).toBe("Lv 37");
    expect(foldAptitudesSurfaceVm({ ...base, mode: "species", ladderIndex: 8 }).scopeChip.subtitle).toBe("Lv 37");
  });

  it("Mode B includes species chrome + price on decision when everRespecced", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "species",
      surface,
      draftShares: draft,
      budget: 200,
      spent: 0,
      leftover: 200,
      dirty: true,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: "Agility",
      theta: 20,
      speciesChrome: {
        hasOverride: true,
        priceAmount: 50,
        priceResource: "soul",
        everRespecced: true
      },
      availability: "ready"
    });
    expect(vm.speciesChrome?.hasOverride).toBe(true);
    expect(vm.decision.priceAmount).toBe(50);
    expect(vm.bands.find((b) => b.postureId === "finesse")?.displayName).toBe("Finesse");
    expect(vm.scopeChip.subtitle).toBe("Lv 20");
  });

  // spec-auto-assign-control.md (EP1.20, C1/C5) — the strip payload is the server's answer for the
  // scope, carried verbatim; the fold never invents, extends or filters the list.
  it("EP1.20: autoAssignStrip carries the server's rule list verbatim, in order", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const rules = ["active-preset", "posture-force", "even"];
    const vm = foldAptitudesSurfaceVm({
      mode: "commander",
      surface,
      draftShares: draft,
      budget: 300,
      spent: 0,
      leftover: 300,
      dirty: false,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: null,
      theta: 100,
      availability: "ready",
      autoAssignRules: rules
    });
    expect(vm.autoAssignStrip.piece).toBe("auto-assign-rule-strip");
    expect(vm.autoAssignStrip.rules).toEqual(rules);
  });

  it("EP1.20: no server answer yet means an empty strip, never an FE default list", () => {
    const draft: Record<string, number> = {};
    for (const row of surface.aptitudes) draft[row.id] = 0;
    const vm = foldAptitudesSurfaceVm({
      mode: "unique",
      surface,
      draftShares: draft,
      budget: 100,
      spent: 0,
      leftover: 100,
      dirty: false,
      withinBudget: true,
      saving: false,
      selectedAptitudeId: null,
      theta: 10,
      availability: "ready"
    });
    expect(vm.autoAssignStrip.rules).toEqual([]);
  });
});
