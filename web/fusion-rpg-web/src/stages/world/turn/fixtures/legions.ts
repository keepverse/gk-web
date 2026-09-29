import type { LegionMemberView, LegionView } from "@/contract/types";
import { pendingWithReason } from "@/contract/pending";

const R = (name: string) => pendingWithReason<never>(`this fixture does not track ${name}`);

const member: LegionMemberView = {
  instanceId: null,
  speciesId: "sunflower",
  level: { unit: "count", value: 1 },
  hp: { unit: "gameUnits", value: 100 },
  wounds: { unit: "gameUnits", value: 0 },
  role: R("member role")
};

function legion(entityId: string, stance: string, movementRemaining: number): LegionView {
  return {
    entityId,
    kind: "Legion",
    ownerFactionId: "dave",
    position: { kind: "sector", sectorId: "s-1" },
    stance,
    movementRemaining: { unit: "perMilleRatio", op: "flat", value: movementRemaining },
    routed: false,
    members: [member],
    carriedLoam: R("carried loam"),
    capacity: R("capacity"),
    burn: R("burn"),
    runway: R("runway")
  };
}

/**
 * world-stage W77/W79/W82 fixture (spec-world-turn.md's own "every fixture runs at the §8e.3
 * target — 6 and 10 legions, not at 1"). The first six (`e-1`..`e-6`) all carry positive
 * `movementRemaining` on purpose, so a test can slice `TEN_LEGIONS.slice(0, 6)` and read the
 * unresolved count as "6 minus however many got an order" without a zero-movement legion muddying
 * the arithmetic; `e-7`..`e-9` are the `hold`/0 legions that prove "0 never counts," and `e-10`
 * exercises a fourth `march`/1000 case past the first six.
 */
export const TEN_LEGIONS: readonly LegionView[] = [
  legion("e-1", "march", 1000),
  legion("e-2", "march", 1000),
  legion("e-3", "scout", 500),
  legion("e-4", "scout", 500),
  legion("e-5", "march", 1000),
  legion("e-6", "scout", 500),
  legion("e-7", "hold", 0),
  legion("e-8", "hold", 0),
  legion("e-9", "hold", 0),
  legion("e-10", "march", 1000)
];
