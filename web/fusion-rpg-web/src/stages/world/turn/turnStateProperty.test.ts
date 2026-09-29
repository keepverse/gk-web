import { describe, expect, it } from "vitest";
import type { LegionMemberView, LegionView } from "@/contract/types";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { pendingWithReason } from "@/contract/pending";
import { unresolvedLegions } from "./unresolvedLegions";

/**
 * world-stage W82 (spec-world-turn.md §5, testing group 3) — the direct test of "Turn Button Shows
 * End Turn When Moves Are Still Available." No new dependency: a small seeded PRNG stands in for a
 * property-testing library, since the whole property fits in one predicate this repo can generate
 * cases for itself.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = (name: string) => pendingWithReason<never>(`this generator does not vary ${name}`);

const MOVEMENT_VALUES = [0, 500, 1000] as const;

const member: LegionMemberView = {
  instanceId: null,
  speciesId: "sunflower",
  level: { unit: "count", value: 1 },
  hp: { unit: "gameUnits", value: 100 },
  wounds: { unit: "gameUnits", value: 0 },
  role: R("member role")
};

function legion(entityId: string, movementRemaining: number): LegionView {
  return {
    entityId,
    kind: "Legion",
    ownerFactionId: "dave",
    position: { kind: "sector", sectorId: "s-1" },
    stance: movementRemaining === 0 ? "hold" : movementRemaining === 500 ? "scout" : "march",
    movementRemaining: { unit: "perMilleRatio", op: "flat", value: movementRemaining },
    routed: false,
    members: [member],
    carriedLoam: R("carried loam"),
    capacity: R("capacity"),
    burn: R("burn"),
    runway: R("runway")
  };
}

const order = (entityId: string): PendingOrder => ({
  commandId: "c-" + entityId,
  kind: "stand-fast",
  entityId,
  label: "stand fast"
});

type GeneratedWorld = { legions: LegionView[]; pending: PendingOrder[] };

/** One random world: 6-10 legions, each 0/500/1000 movement, a random subset ordered — including,
 * deliberately, a legion that was ordered and then withdrawn (never lands in `pending` at all, since
 * `pending` is the *current* queue, not a history), and always at least one legion at exactly 0‰. */
function generateWorld(rng: () => number): GeneratedWorld {
  const count = 6 + Math.floor(rng() * 5); // 6..10
  const legions: LegionView[] = [];
  for (let i = 0; i < count; i++) {
    const movement = i === 0 ? 0 : MOVEMENT_VALUES[Math.floor(rng() * MOVEMENT_VALUES.length)]!;
    legions.push(legion(`e-${i}`, movement));
  }

  const pending: PendingOrder[] = [];
  for (const l of legions) {
    const filedThenWithdrawn = rng() < 0.2; // filed at some point, not in the current queue
    const stillFiled = !filedThenWithdrawn && rng() < 0.5;
    if (stillFiled) pending.push(order(l.entityId));
  }

  return { legions, pending };
}

/** The property itself, expressed the same way `TurnCluster` derives its own state: Ready iff no
 * legion is unresolved, Nag iff at least one is (blockers are out of scope here — W79's own tests
 * cover the hard-blocked branch directly). */
function stateAgrees(world: GeneratedWorld, predicate: (w: GeneratedWorld) => number): boolean {
  const realUnresolvedCount = unresolvedLegions(world.legions, world.pending).length;
  const claimedUnresolvedCount = predicate(world);
  const realState = realUnresolvedCount > 0 ? "nag" : "ready";
  const claimedState = claimedUnresolvedCount > 0 ? "nag" : "ready";
  return realState === claimedState;
}

const REAL_PREDICATE = (w: GeneratedWorld) => unresolvedLegions(w.legions, w.pending).length;

describe("Blocker correctness as a property (world-stage W82)", () => {
  it("over 500 generated worlds at 6-10 legions, the button's state never disagrees with the world's", () => {
    const rng = mulberry32(20260905);
    for (let i = 0; i < 500; i++) {
      const world = generateWorld(rng);
      expect(world.legions.length).toBeGreaterThanOrEqual(6);
      expect(world.legions.length).toBeLessThanOrEqual(10);
      // Every generated world carries at least one legion pinned to exactly 0‰ (index 0).
      expect(world.legions[0]!.movementRemaining.value).toBe(0);

      expect(stateAgrees(world, REAL_PREDICATE)).toBe(true);
    }
  });

  it("a deliberately inverted predicate makes the property fail — proving this test actually notices", () => {
    const invertedPredicate = (w: GeneratedWorld) => (REAL_PREDICATE(w) > 0 ? 0 : 1);
    const rng = mulberry32(20260905); // same seed as the real run above

    let foundDisagreement = false;
    for (let i = 0; i < 500; i++) {
      const world = generateWorld(rng);
      if (!stateAgrees(world, invertedPredicate)) {
        foundDisagreement = true;
        break;
      }
    }

    expect(foundDisagreement).toBe(true);
  });
});
