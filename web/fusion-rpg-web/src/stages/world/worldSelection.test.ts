import { describe, expect, it } from "vitest";
import fixture from "./fixtures/first-light.json";
import type { WorldStateDto, WorldEntityDto } from "@/lib/bus/world";
import { toGraph } from "./worldViewModel";
import {
  initialWorldUi,
  orderId,
  reachableFromLegion,
  routeBetween,
  routeForLegion,
  toRequests,
  worldUiReducer,
  type PendingOrder
} from "./worldSelection";

const graph = toGraph(fixture as WorldStateDto);

const move = (entityId: string, lanePath: string[]): PendingOrder => ({
  commandId: orderId(0, "move", entityId),
  kind: "move",
  entityId,
  lanePath,
  label: `march ${entityId}`
});

describe("worldUiReducer", () => {
  it("tracks what is selected without touching the queue", () => {
    let state = worldUiReducer(initialWorldUi, { type: "select-sector", sectorId: "ash-waste" });
    state = worldUiReducer(state, { type: "select-entity", entityId: "e-dave-legion-1" });

    expect(state.selectedSectorId).toBe("ash-waste");
    expect(state.selectedEntityId).toBe("e-dave-legion-1");
    expect(state.pending).toHaveLength(0);
  });

  it("clicking the already-selected sector again deselects it (world-stage W65)", () => {
    let state = worldUiReducer(initialWorldUi, { type: "select-sector", sectorId: "ash-waste" });
    expect(state.selectedSectorId).toBe("ash-waste");

    state = worldUiReducer(state, { type: "select-sector", sectorId: "ash-waste" });
    expect(state.selectedSectorId).toBeNull();
  });

  it("selecting a different sector while one is already selected simply switches, no toggling", () => {
    let state = worldUiReducer(initialWorldUi, { type: "select-sector", sectorId: "ash-waste" });
    state = worldUiReducer(state, { type: "select-sector", sectorId: "ember-hollow" });
    expect(state.selectedSectorId).toBe("ember-hollow");
  });

  it("an explicit null (Esc/right-click/✕) always deselects outright, same as before", () => {
    let state = worldUiReducer(initialWorldUi, { type: "select-sector", sectorId: "ash-waste" });
    state = worldUiReducer(state, { type: "select-sector", sectorId: null });
    expect(state.selectedSectorId).toBeNull();
  });

  it("queues an order", () => {
    const state = worldUiReducer(initialWorldUi, {
      type: "queue",
      order: move("e-dave-legion-1", ["l-home-ember"])
    });

    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].lanePath).toEqual(["l-home-ember"]);
  });

  it("replaces a legion's standing order rather than stacking a second one behind it", () => {
    let state = worldUiReducer(initialWorldUi, {
      type: "queue",
      order: move("e-dave-legion-1", ["l-home-ember"])
    });
    state = worldUiReducer(state, {
      type: "queue",
      order: move("e-dave-legion-1", ["l-home-frost"])
    });

    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].lanePath).toEqual(["l-home-frost"]);
  });

  it("lets one legion march while another clears, in the same turn", () => {
    let state = worldUiReducer(initialWorldUi, {
      type: "queue",
      order: move("e-dave-legion-1", ["l-home-ember"])
    });
    state = worldUiReducer(state, {
      type: "queue",
      order: {
        commandId: orderId(0, "clear", "e-dave-legion-1"),
        kind: "clear",
        entityId: "e-dave-legion-1",
        sectorId: "ember-hollow",
        slotIndex: 2,
        label: "clear slot 2"
      }
    });

    expect(state.pending.map((p) => p.kind)).toEqual(["move", "clear"]);
  });

  it("drops one order without disturbing the rest", () => {
    let state = worldUiReducer(initialWorldUi, { type: "queue", order: move("a", ["l-home-ember"]) });
    state = worldUiReducer(state, { type: "queue", order: move("b", ["l-home-frost"]) });
    state = worldUiReducer(state, { type: "unqueue", commandId: orderId(0, "move", "a") });

    expect(state.pending.map((p) => p.entityId)).toEqual(["b"]);
  });

  it("empties the queue once it has been sent", () => {
    let state = worldUiReducer(initialWorldUi, { type: "queue", order: move("a", ["l-home-ember"]) });
    state = worldUiReducer(state, { type: "clear-queue" });
    expect(state.pending).toHaveLength(0);
  });

  it("never mutates the state it was handed", () => {
    const before = worldUiReducer(initialWorldUi, { type: "queue", order: move("a", ["l-home-ember"]) });
    const snapshot = JSON.stringify(before);
    worldUiReducer(before, { type: "queue", order: move("b", ["l-home-frost"]) });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("toRequests", () => {
  it("produces exactly the payload the commands endpoint expects", () => {
    expect(toRequests([move("e-dave-legion-1", ["l-home-ember"])])).toEqual([
      {
        commandId: "t0-move-e-dave-legion-1",
        kind: "move",
        entityId: "e-dave-legion-1",
        sectorId: null,
        slotIndex: null,
        lanePath: ["l-home-ember"],
        stance: null,
        amount: null,
        structureId: null,
        relicInstanceIds: null
      }
    ]);
  });

  // world-stage W66: each of the five newly-widened kinds carries the one field the engine reads
  // for it, and toRequests must not drop it — the exact failure mode that lost `stance` once already.
  it("stance survives the wire shape", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "stance", "e-dave-legion-1"),
      kind: "stance",
      entityId: "e-dave-legion-1",
      stance: "scout",
      label: "scout"
    };
    expect(toRequests([order])[0]?.stance).toBe("scout");
  });

  it("sustain's amount survives the wire shape as a whole-loam number, not a fraction of one", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "sustain", "e-dave-legion-1"),
      kind: "sustain",
      entityId: "e-dave-legion-1",
      amount: 120,
      label: "sustain 120"
    };
    expect(toRequests([order])[0]?.amount).toBe(120);
  });

  it("build's structureId and slotIndex both survive the wire shape", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "build", "e-dave-legion-1"),
      kind: "build",
      entityId: "e-dave-legion-1",
      structureId: "well",
      slotIndex: 2,
      label: "build well"
    };
    const req = toRequests([order])[0];
    expect(req?.structureId).toBe("well");
    expect(req?.slotIndex).toBe(2);
  });

  it("stand-fast needs no extra field and still round-trips cleanly", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "stand-fast", "e-dave-legion-1"),
      kind: "stand-fast",
      entityId: "e-dave-legion-1",
      label: "stand fast"
    };
    expect(toRequests([order])[0]).toMatchObject({ kind: "stand-fast", entityId: "e-dave-legion-1" });
  });

  it("ward's laneId has nowhere to go on the wire yet — it never gets smuggled onto sectorId", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "ward", "e-dave-legion-1"),
      kind: "ward",
      entityId: "e-dave-legion-1",
      laneId: "l-home-ember",
      label: "ward the road"
    };
    const req = toRequests([order])[0];
    expect(req?.kind).toBe("ward");
    expect(req?.sectorId).toBeNull();
  });

  // wonder-rest §Design 3 + Testing strategy: the picked list survives queue → wire untouched,
  // and a no-relic order emits null (never []-vs-null drift).
  it("build's relicInstanceIds survive the wire shape order-preserved", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "build", "e-dave-legion-1"),
      kind: "build",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      slotIndex: 1,
      structureId: "test-wonder",
      relicInstanceIds: ["relic-b", "relic-a"],
      label: "build test-wonder"
    };
    expect(toRequests([order])[0]?.relicInstanceIds).toEqual(["relic-b", "relic-a"]);
  });

  it("a build order with no picked relics emits null, not an empty list", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "build", "e-dave-legion-1"),
      kind: "build",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      slotIndex: 1,
      structureId: "well",
      label: "build well"
    };
    const req = toRequests([order])[0];
    expect(req?.relicInstanceIds).toBeNull();
    expect(req?.relicInstanceIds).not.toEqual([]);
  });

  it("an explicitly empty relic list stays an empty list — the queue never invents null", () => {
    const order: PendingOrder = {
      commandId: orderId(0, "build", "e-dave-legion-1"),
      kind: "build",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      slotIndex: 1,
      structureId: "test-wonder",
      relicInstanceIds: [],
      label: "build test-wonder"
    };
    // ?? null keeps [] as []: absent (undefined) → null, present-but-empty → []. The C# endpoint
    // then reads both as "spends no relic" (null-tolerant mapping + store read-back).
    expect(toRequests([order])[0]?.relicInstanceIds).toEqual([]);
  });
});

describe("routeBetween", () => {
  it("finds the one-lane hop", () => {
    expect(routeBetween(graph, "homeworld", "ember-hollow")).toEqual(["l-home-ember"]);
  });

  it("walks a multi-lane route", () => {
    const path = routeBetween(graph, "homeworld", "ash-waste");
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
    expect(path![0]).toMatch(/^l-home-/);
  });

  it("gives the same route every time — the walk is stable, not incidental", () => {
    expect(routeBetween(graph, "homeworld", "black-gate")).toEqual(
      routeBetween(graph, "homeworld", "black-gate")
    );
  });

  it("refuses to route to where you already are", () => {
    expect(routeBetween(graph, "homeworld", "homeworld")).toBeNull();
  });

  it("will not route across a severed lane", () => {
    const cut = {
      ...graph,
      edges: graph.edges.map((e) =>
        e.id === "l-home-ember" ? { ...e, data: { ...e.data, severed: true } } : e
      )
    };

    // ember-hollow's only other way in is via ash-waste, so the route gets longer, not impossible.
    const path = routeBetween(cut, "homeworld", "ember-hollow");
    expect(path).not.toContain("l-home-ember");
    expect(path!.length).toBeGreaterThan(1);
  });

  it("returns null when there is genuinely no way through", () => {
    const isolated = { ...graph, edges: [] };
    expect(routeBetween(isolated, "homeworld", "ember-hollow")).toBeNull();
  });
});

describe("routeForLegion", () => {
  const world = fixture as WorldStateDto;
  const standing = world.entities.find((e) => e.entityId === "e-dave-legion-1")!;

  const marching = (toward: string, laneId: string): WorldEntityDto => ({
    ...standing,
    atSectorId: null,
    onLaneId: laneId,
    onLaneTowardSectorId: toward,
    laneProgressMilli: 400
  });

  it("routes a legion standing in a sector exactly as a plain walk would", () => {
    expect(routeForLegion(graph, standing, "ash-waste")).toEqual(
      routeBetween(graph, "homeworld", "ash-waste")
    );
  });

  /**
   * The engine resumes a march from the lane the legion is already on, and refuses a path that does
   * not contain it — `path.not-contiguous`. So a re-route filed for a legion in mid-stride has to
   * carry that lane at its head, or the order is silently dropped when the turn resolves.
   */
  it("keeps a mid-march legion's current lane at the head of the route", () => {
    const path = routeForLegion(graph, marching("ember-hollow", "l-home-ember"), "ash-waste");

    expect(path).not.toBeNull();
    expect(path![0]).toBe("l-home-ember");
    expect(path!.length).toBeGreaterThan(1);
  });

  it("is just the current lane when the destination is where it was already heading", () => {
    expect(routeForLegion(graph, marching("ember-hollow", "l-home-ember"), "ember-hollow")).toEqual([
      "l-home-ember"
    ]);
  });

  it("routes onward from the end it is walking toward, not the one it left", () => {
    // Heading for ember-hollow, told to carry on to frost-mire: the route continues from
    // ember-hollow, so it must not double back through homeworld's other lane by itself.
    const path = routeForLegion(graph, marching("ember-hollow", "l-home-ember"), "frost-mire");

    expect(path![0]).toBe("l-home-ember");
    expect(path).not.toContain("l-home-frost");
  });

  it("gives up rather than inventing a route to nowhere", () => {
    const isolated = { ...graph, edges: [] };
    expect(routeForLegion(isolated, standing, "ash-waste")).toBeNull();
  });
});

describe("reachableFromLegion", () => {
  const standing = (fixture as WorldStateDto).entities.find((e) => e.entityId === "e-dave-legion-1")!;

  it("maps every other sector to its real hop count, and never lists the legion's own sector", () => {
    const distances = reachableFromLegion(graph, standing);

    expect(distances.has("homeworld")).toBe(false);
    expect(distances.get("ember-hollow")).toBe(1);
    expect(distances.get("frost-mire")).toBe(1);
    expect(distances.get("ash-waste")).toBe(2);
    expect(distances.get("black-gate")).toBe(3);
    expect(distances.get("verdant-shelf")).toBe(4);
    expect(distances.size).toBe(5);
  });

  it("a mid-march legion resumes distance-counting from its current lane, matching routeForLegion exactly", () => {
    const marching: WorldEntityDto = {
      ...standing,
      atSectorId: null,
      onLaneId: "l-home-ember",
      onLaneTowardSectorId: "ember-hollow",
      laneProgressMilli: 400
    };
    const distances = reachableFromLegion(graph, marching);

    // Just the current lane — the same "is just the current lane when the destination is where it
    // was already heading" fact `routeForLegion`'s own tests already prove.
    expect(distances.get("ember-hollow")).toBe(1);
    // One more lane onward from the end it is walking toward.
    expect(distances.get("ash-waste")).toBe(2);
  });

  it("an isolated legion (no edges at all) reaches nothing — an empty map, not a thrown error", () => {
    const isolated = { ...graph, edges: [] };
    expect(reachableFromLegion(isolated, standing).size).toBe(0);
  });
});
