import { describe, expect, it } from "vitest";
import fixture from "./fixtures/first-light.json";
import type { WorldStateDto } from "@/lib/bus/world";
import {
  anchorStateOf,
  GRID_X,
  GRID_Y,
  ownershipOf,
  summarizeLoam,
  toGraph,
  type SectorNodeData
} from "./worldViewModel";

const world = fixture as WorldStateDto;

describe("worldViewModel", () => {
  it("turns every sector into a node and every lane into an edge", () => {
    const { nodes, edges } = toGraph(world);

    expect(nodes).toHaveLength(world.sectors.length);
    expect(edges).toHaveLength(world.lanes.length);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
  });

  it("places sectors on the authored grid rather than laying them out", () => {
    const { nodes } = toGraph(world);
    const home = nodes.find((n) => n.id === "homeworld")!;
    const ember = nodes.find((n) => n.id === "ember-hollow")!;

    expect(home.position).toEqual({ x: 0, y: 0 });
    expect(ember.position).toEqual({ x: 2 * GRID_X, y: -1 * GRID_Y });
  });

  it("reads the player faction from the payload instead of assuming a name", () => {
    const { nodes } = toGraph(world);
    expect(nodes.find((n) => n.id === "homeworld")!.data.ownership).toBe("mine");
    expect(nodes.find((n) => n.id === "ash-waste")!.data.ownership).toBe("neutral");

    const renamed: WorldStateDto = {
      ...world,
      factions: world.factions.map((f) => (f.kind === "Player" ? { ...f, factionId: "someone-else" } : f))
    };
    expect(toGraph(renamed).nodes.find((n) => n.id === "homeworld")!.data.ownership).toBe("enemy");
  });

  it("marks a slot guard as intact, cleared, or never guarded at all", () => {
    const ember = toGraph(world).nodes.find((n) => n.id === "ember-hollow")!;

    expect(ember.data.slots.find((s) => s.slotIndex === 0)!.guard).toBe("none");
    expect(ember.data.slots.find((s) => s.slotIndex === 2)!.guard).toBe("intact");
  });

  it("calls a sector claimable only when every guard is down and nothing hostile is in it", () => {
    const before = toGraph(world).nodes.find((n) => n.id === "ember-hollow")!;
    expect(before.data.claimable).toBe(false);

    const cleared: WorldStateDto = {
      ...world,
      sectors: world.sectors.map((s) =>
        s.sectorId === "ember-hollow"
          ? { ...s, slots: s.slots.map((sl) => ({ ...sl, guardState: "Cleared" })) }
          : s
      )
    };
    expect(toGraph(cleared).nodes.find((n) => n.id === "ember-hollow")!.data.claimable).toBe(true);

    // ...and an enemy you can see standing in it takes it straight back off the table. Forces come
    // from belief now, not from the entity list — that only ever carries your own.
    const occupied: WorldStateDto = {
      ...cleared,
      sectors: cleared.sectors.map((s) =>
        s.sectorId === "ember-hollow"
          ? {
              ...s,
              forces: [
                {
                  entityId: "e-wild-pack-1",
                  ownerFactionId: "wild",
                  kind: "Warband",
                  exact: false,
                  strength: 0,
                  bandName: "warband",
                  bandCeiling: 1499
                }
              ]
            }
          : s
      )
    };
    expect(toGraph(occupied).nodes.find((n) => n.id === "ember-hollow")!.data.claimable).toBe(false);
  });

  it("never calls a sector you already hold claimable", () => {
    expect(toGraph(world).nodes.find((n) => n.id === "homeworld")!.data.claimable).toBe(false);
  });

  it("puts each force on the sector it stands in", () => {
    const { nodes } = toGraph(world);

    expect(nodes.find((n) => n.id === "homeworld")!.data.forces.map((f) => f.entityId))
      .toEqual(["e-dave-legion-1"]);
    expect(nodes.find((n) => n.id === "ash-waste")!.data.forces[0].ownership).toBe("enemy");
    expect(nodes.find((n) => n.id === "verdant-shelf")!.data.forces).toHaveLength(0);
  });

  it("puts a marching force on its lane, with how far along it is", () => {
    const marching: WorldStateDto = {
      ...world,
      entities: world.entities.map((e) =>
        e.entityId === "e-dave-legion-1"
          ? {
              ...e,
              atSectorId: null,
              onLaneId: "l-home-ember",
              onLaneTowardSectorId: "ember-hollow",
              laneProgressMilli: 420
            }
          : e
      )
    };

    const onTheRoad: WorldStateDto = {
      ...marching,
      // Belief follows the force off the ground it left.
      sectors: marching.sectors.map((s) => (s.sectorId === "homeworld" ? { ...s, forces: [] } : s))
    };

    const lane = toGraph(onTheRoad).edges.find((e) => e.id === "l-home-ember")!;
    expect(lane.data.forces).toHaveLength(1);
    expect(lane.data.forces[0]).toMatchObject({
      entityId: "e-dave-legion-1",
      progressMilli: 420,
      towardSectorId: "ember-hollow"
    });

    // ...and it is no longer drawn in the sector it left.
    expect(toGraph(onTheRoad).nodes.find((n) => n.id === "homeworld")!.data.forces).toHaveLength(0);
  });

  it("shows a surveyed force's exact strength and a glimpsed one's band", () => {
    const surveyed = toGraph(world).nodes.find((n) => n.id === "homeworld")!.data.forces[0];
    expect(surveyed.exact).toBe(true);
    expect(surveyed.strength).toBeGreaterThan(0);

    // ash-waste is only rumoured, so its occupant is banded rather than counted — showing a number
    // there would imply a head count nobody made.
    const glimpsed = toGraph(world).nodes.find((n) => n.id === "ash-waste")!.data.forces[0];
    expect(glimpsed.exact).toBe(false);
    expect(glimpsed.strength).toBe(0);
    expect(glimpsed.bandName).not.toBe("");
  });

  it("marks a severed lane", () => {
    const cut: WorldStateDto = {
      ...world,
      lanes: world.lanes.map((l) => (l.laneId === "l-home-ember" ? { ...l, state: "Severed" } : l))
    };

    expect(toGraph(cut).edges.find((e) => e.id === "l-home-ember")!.data.severed).toBe(true);
    expect(toGraph(world).edges.find((e) => e.id === "l-home-ember")!.data.severed).toBe(false);
  });

  it("shrouds a sector nobody has looked at", () => {
    const { nodes } = toGraph(world);
    expect(nodes.find((n) => n.id === "black-gate")!.data.unknown).toBe(true);
    expect(nodes.find((n) => n.id === "homeworld")!.data.unknown).toBe(false);
  });

  it("remembers where a force was on the lane, so the marker slides instead of snapping", () => {
    const onLane = (progress: number): WorldStateDto => ({
      ...world,
      entities: world.entities.map((e) =>
        e.entityId === "e-dave-legion-1"
          ? {
              ...e,
              atSectorId: null,
              onLaneId: "l-home-ember",
              onLaneTowardSectorId: "ember-hollow",
              laneProgressMilli: progress
            }
          : e
      )
    });

    const moved = toGraph(onLane(700), onLane(200));
    expect(moved.edges.find((e) => e.id === "l-home-ember")!.data.forces[0]).toMatchObject({
      fromMilli: 200,
      alongMilli: 700
    });

    // No history means it simply appears where it is — a force that just stepped onto the lane.
    const fresh = toGraph(onLane(700));
    expect(fresh.edges.find((e) => e.id === "l-home-ember")!.data.forces[0].fromMilli).toBeUndefined();
  });

  it("mirrors the remembered position too, for a march against the lane's direction", () => {
    const against = (progress: number): WorldStateDto => ({
      ...world,
      entities: world.entities.map((e) =>
        e.entityId === "e-dave-legion-1"
          ? {
              ...e,
              atSectorId: null,
              onLaneId: "l-ember-ash",
              onLaneTowardSectorId: "ember-hollow",
              laneProgressMilli: progress
            }
          : e
      )
    });

    // l-ember-ash runs ember-hollow → ash-waste, so travelling toward ember-hollow is backwards.
    const force = toGraph(against(600), against(100)).edges
      .find((e) => e.id === "l-ember-ash")!.data.forces[0];

    expect(force).toMatchObject({ fromMilli: 900, alongMilli: 400 });
  });

  it("is a pure fold — the same payload gives an equal graph every time", () => {
    expect(toGraph(world)).toEqual(toGraph(world));
  });
});

describe("helpers", () => {
  it("treats an unowned thing as neutral, not as the enemy's", () => {
    expect(ownershipOf(null, "dave")).toBe("neutral");
    expect(ownershipOf("dave", "dave")).toBe("mine");
    expect(ownershipOf("wild", "dave")).toBe("enemy");
    expect(ownershipOf("dave", null)).toBe("enemy");
  });
});

describe("anchorStateOf (spec-loam-fe.md: territory is light in the dark)", () => {
  it("is not-yours before anything else — loam has nothing to add to the fog treatment", () => {
    expect(anchorStateOf("enemy", true, 1000)).toBe("not-yours");
    expect(anchorStateOf("neutral", false, 0)).toBe("not-yours");
  });

  it("is barren for your own ground that holds no source, regardless of its stability number", () => {
    expect(anchorStateOf("mine", false, 1000)).toBe("barren");
    expect(anchorStateOf("mine", false, 0)).toBe("barren");
  });

  it("is anchored when yours, holding a source, and near full stability", () => {
    expect(anchorStateOf("mine", true, 1000)).toBe("anchored");
    expect(anchorStateOf("mine", true, 900)).toBe("anchored");
  });

  it("is fading when yours, holding a source, but stability has started to slip", () => {
    expect(anchorStateOf("mine", true, 899)).toBe("fading");
    expect(anchorStateOf("mine", true, 0)).toBe("fading");
  });

  it("wires stabilityMilli and habitable from the DTO through to the node's data", () => {
    const home = toGraph(world).nodes.find((n) => n.id === "homeworld")!.data;
    expect(home.habitable).toBe(true);
    expect(home.stabilityMilli).toBe(1000);
    expect(home.anchorState).toBe("anchored");
  });

  it("wires the loam economy fields from the DTO through to the node's data", () => {
    const home = toGraph(world).nodes.find((n) => n.id === "homeworld")!.data;
    expect(home.componentId).toBe("homeworld");
    expect(home.componentProduction).toBeGreaterThan(0);
    expect(home.componentStock).toBeGreaterThan(0);
    expect(home.willReleaseNextTurn).toBe(false);
  });
});

describe("summarizeLoam (spec-loam-fe.md: the gauge)", () => {
  const base: SectorNodeData = {
    sectorId: "s",
    label: "S",
    typeId: "stable",
    climate: null,
    phase: "Held",
    intel: "Watched",
    dangerBand: 0,
    ownerFactionId: "dave",
    ownership: "mine",
    unknown: false,
    remembered: false,
    age: 0,
    claimable: false,
    lifelineCost: 0,
    lifeline: false,
    slots: [],
    forces: [],
    habitable: true,
    stabilityMilli: 1000,
    anchorState: "anchored",
    loamProduction: 0,
    loamUpkeep: 0,
    loamNet: 0,
    componentId: null,
    componentProduction: 0,
    componentUpkeep: 0,
    componentNet: 0,
    loamStock: 0,
    componentStock: 0,
    willReleaseNextTurn: false
  };

  it("sums one component's totals once, not once per member sector", () => {
    const nodes = [
      { ...base, sectorId: "a", componentId: "a", componentProduction: 60, componentUpkeep: 20, componentNet: 40, componentStock: 200 },
      { ...base, sectorId: "b", componentId: "a", componentProduction: 60, componentUpkeep: 20, componentNet: 40, componentStock: 200 }
    ];

    const summary = summarizeLoam(nodes);
    expect(summary.production).toBe(60);
    expect(summary.upkeep).toBe(20);
    expect(summary.net).toBe(40);
    expect(summary.stock).toBe(200);
    expect(summary.components).toHaveLength(1);
    expect(summary.components[0].sectorCount).toBe(2);
  });

  it("keeps a split territory as separate components and totals them for the empire figure", () => {
    const nodes = [
      { ...base, sectorId: "a", componentId: "a", componentProduction: 60, componentUpkeep: 20, componentNet: 40, componentStock: 200 },
      { ...base, sectorId: "b", componentId: "b", componentProduction: 5, componentUpkeep: 30, componentNet: -25, componentStock: 10 }
    ];

    const summary = summarizeLoam(nodes);
    expect(summary.components).toHaveLength(2);
    expect(summary.net).toBe(15); // 40 + (-25)

    const starving = summary.components.find((c) => c.net < 0)!;
    expect(starving.componentId).toBe("b");
  });

  it("never counts ground you do not own, or ground with no component at all", () => {
    const nodes = [
      { ...base, sectorId: "enemy", ownership: "enemy" as const, componentId: "e", componentProduction: 999 },
      { ...base, sectorId: "unscouted", componentId: null, componentProduction: 999 }
    ];

    const summary = summarizeLoam(nodes);
    expect(summary.components).toHaveLength(0);
    expect(summary.production).toBe(0);
  });

  it("names which sector a starving component is about to release", () => {
    const nodes = [
      { ...base, sectorId: "weak", componentId: "a", componentNet: -25, willReleaseNextTurn: true },
      { ...base, sectorId: "strong", componentId: "a", componentNet: -25, willReleaseNextTurn: false }
    ];

    const summary = summarizeLoam(nodes);
    expect(summary.components[0].releaseCandidateSectorId).toBe("weak");
  });

  it("names nothing when no component is about to release anything", () => {
    const summary = summarizeLoam([{ ...base, componentId: "a" }]);
    expect(summary.components[0].releaseCandidateSectorId).toBeNull();
  });
});
