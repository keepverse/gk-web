import { describe, expect, it } from "vitest";
import { applyLawnSession, membershipFingerprint } from "./lawnSessionFold";
import { emptyLawnViewModel, findOccupant } from "./lawnViewModel";
import type { EventEnvelope } from "@/lib/bus/types";

function evt(kind: string, payload?: unknown, id?: number, matchKey?: string): EventEnvelope {
  return { id, t: "2026-01-01T00:00:00Z", game: "test", kind, matchKey, payload };
}

describe("applyLawnSession", () => {
  it("keeps mowers when mower.place ages out of a hit-only window", () => {
    const start = applyLawnSession(emptyLawnViewModel(), [
      evt("mower.place", { ptr: "M1", type: 0, row: 2 }, 1),
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }, 2)
    ], 0);
    expect(start.model.mowers.size).toBe(1);
    expect(start.lastEventId).toBe(2);

    const hits = applyLawnSession(start.model, [
      evt("combat.hit", { damage: 20, targetPtr: "P" }, 5),
      evt("combat.hit", { damage: 21, targetPtr: "P" }, 4),
      evt("combat.hit", { damage: 19, targetPtr: "P" }, 3)
    ], start.lastEventId);
    expect(hits.model).toBe(start.model);
    expect(hits.model.mowers.size).toBe(1);
    expect(hits.model.lastHit).toBeUndefined();
    expect(hits.model.revision).toBe(start.model.revision);
    expect(hits.lastEventId).toBe(5);
  });

  it("does not drop revision across hit-only window", () => {
    const a = applyLawnSession(emptyLawnViewModel(), [
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1, col: 6 }, 1)
    ], 0);
    const b = applyLawnSession(a.model, [
      evt("combat.hit", { damage: 1 }, 2)
    ], a.lastEventId);
    expect(b.model).toBe(a.model);
    expect(b.model.revision).toBe(a.model.revision);
    expect(findOccupant(b.model, "Z")).toBeDefined();
  });

  it("double-apply of the same ring does not bump revision twice", () => {
    const ring = [evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }, 1)];
    const a = applyLawnSession(emptyLawnViewModel(), ring, 0);
    const b = applyLawnSession(a.model, ring, a.lastEventId);
    expect(b.model).toBe(a.model);
    expect(b.model.revision).toBe(a.model.revision);
    expect(b.lastEventId).toBe(a.lastEventId);
  });

  it("resets from empty when maxId falls below watermark", () => {
    const a = applyLawnSession(emptyLawnViewModel(), [
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }, 5)
    ], 0);
    expect(findOccupant(a.model, "P")).toBeDefined();
    const b = applyLawnSession(a.model, [
      evt("zombie.spawn", { ptr: "Z", type: 0, row: 1, col: 3 }, 2)
    ], a.lastEventId);
    expect(findOccupant(b.model, "P")).toBeUndefined();
    expect(findOccupant(b.model, "Z")).toBeDefined();
  });

  it("applies an authoritative empty binding snapshot over the session", () => {
    const first = applyLawnSession(emptyLawnViewModel(), [
      evt("board.start", {}, 1, "m1"),
      evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, 2, "m1"),
      evt(
        "debug.snapshot",
        { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } },
        3,
        "m1"
      )
    ], 0);
    expect(findOccupant(first.model, "P1")?.instanceId).toBe("u-1");

    const recovered = applyLawnSession(
      first.model,
      [evt("debug.snapshot", { match: { phase: "InMatch", matchKey: "m1", bindings: [] } }, 4, "m1")],
      first.lastEventId
    );
    expect(findOccupant(recovered.model, "P1")?.instanceId).toBeUndefined();
  });

  it("keeps a binding observed before a later spawn in the incremental session", () => {
    const bound = applyLawnSession(
      emptyLawnViewModel(),
      [
        evt("board.start", {}, 1, "m1"),
        evt(
          "debug.snapshot",
          { match: { phase: "InMatch", matchKey: "m1", bindings: [{ instanceId: "u-1", ptr: "P1", phase: "Bound" }] } },
          2,
          "m1"
        )
      ],
      0
    );
    const spawned = applyLawnSession(
      bound.model,
      [evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, 3, "m1")],
      bound.lastEventId
    );
    expect(findOccupant(spawned.model, "P1")?.instanceId).toBe("u-1");
  });

  it("does not let a foreign match event mutate an active session", () => {
    const active = applyLawnSession(
      emptyLawnViewModel(),
      [
        evt("board.start", {}, 1, "m1"),
        evt("plant.spawn", { ptr: "P1", type: 1, row: 0, col: 0 }, 2, "m1")
      ],
      0
    );
    const isolated = applyLawnSession(
      active.model,
      [evt("plant.spawn", { ptr: "FOREIGN", type: 9, row: 1, col: 1 }, 3, "m2")],
      active.lastEventId
    );
    expect(findOccupant(isolated.model, "FOREIGN")).toBeUndefined();
    expect(findOccupant(isolated.model, "P1")?.typeId).toBe(1);
    expect(isolated.model.matchKey).toBe("m1");
  });

  it("fingerprint ignores lastHit", () => {
    const a = applyLawnSession(emptyLawnViewModel(), [
      evt("plant.spawn", { ptr: "P", type: 1, row: 0, col: 0 }, 1)
    ], 0);
    const withHit = {
      ...a.model,
      lastHit: { damage: 9, targetPtr: "P", source: "combat.hit" }
    };
    expect(membershipFingerprint(withHit)).toBe(membershipFingerprint(a.model));
  });
});
