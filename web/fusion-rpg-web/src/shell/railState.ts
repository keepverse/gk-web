/**
 * The rail is identical on every stage (information-architecture.md §3):
 * Sanctum (the travel-home affordance) then the seven layers. It renders
 * from state — never a constant list (GG-44) — so this module is the one
 * place unlock derivation happens; the component just renders what this
 * returns.
 */
export type RailLayerId =
  | "creatures"
  | "commanders"
  | "relics"
  | "fusion"
  | "pacts"
  | "expeditions"
  | "almanac"
  | "chronicle";

/**
 * The one runtime list of every stage id, so "how many stages exist" is never re-derived or
 * hand-counted elsewhere (base-defense's `spec-siege-stage.md` §2 cost 1: "the count assertion
 * becomes 5"; party-dungeon's `spec-delve-stage.md` §4 pushes it to 6, D5.1). `battle` is declared
 * here but has no route behind it yet (`spec-battle-stage.md`'s own job to fill in, or
 * `spec-board-render.md`'s decision 40, which retires the id instead — whichever lands first);
 * `RailUnlockInputs.currentStageId` below is typed from this array, not a second hand-written union,
 * so the two can never drift apart.
 */
export const STAGE_IDS = ["sanctum", "world", "lawn", "battle", "siege", "delve"] as const;

export type StageId = (typeof STAGE_IDS)[number];

export type RailEntryState = "active" | "available" | "badged" | "locked";

export type RailEntry = {
  id: "sanctum" | RailLayerId;
  label: string;
  key: string;
  state: RailEntryState;
  /** Required when state is "locked" — GG-17: say what unlocks it. */
  lockedReason?: string;
  badgeCount?: number;
};

export type RailUnlockInputs = {
  currentStageId: StageId;
  hasCompletedARun: boolean;
  /** T15: fusion is real creature fusion (spec-creature-fusion.md), not creature fusion — star merge
   * and promotion both need at least one creature in the roster (recipe fusion needs two, but the
   * lab itself is reachable with one so a player can see what it needs). */
  hasAnyCreature: boolean;
  hasAnyContract: boolean;
  /** T14: the relic catalog is real but has no acquisition system yet, so every player holds
   * it in full — this is always true today, but still threaded through real query data rather
   * than hardcoded, so it stays correct once holding a relic becomes an earned event. */
  hasAnyRelic: boolean;
  /** T17: expeditions field creatures, not creatures — real requirement is a bound creature (World's
   * "held sector" never applied; the previous condition was wrong-domain, not just hard to
   * live-demo, and has been replaced). */
  hasAnyBoundCreature: boolean;
  /** T17: dispatched expeditions whose due time has passed but aren't collected yet — GG-53's
   * rail badge. */
  returnedExpeditionCount: number;
  unreadResultCount: number;
};

const UNLOCK_LADDER: Record<RailLayerId, { label: string; key: string; reason: string }> = {
  creatures: { label: "Creatures", key: "C", reason: "Unlocks at session start" },
  commanders: { label: "Commanders", key: "K", reason: "Unlocks at session start" },
  relics: { label: "Relics", key: "R", reason: "Unlocks when you hold your first item" },
  fusion: { label: "Fusion", key: "F", reason: "Unlocks once you have a creature to fuse" },
  pacts: { label: "Pacts", key: "P", reason: "Unlocks when a contract is first offered" },
  expeditions: { label: "Expeditions", key: "E", reason: "Unlocks once you have a bound creature to field" },
  almanac: { label: "Almanac", key: "A", reason: "Unlocks after your first run" },
  chronicle: { label: "Chronicle", key: "H", reason: "Unlocks after your first run" }
};

function isUnlocked(id: RailLayerId, inputs: RailUnlockInputs): boolean {
  switch (id) {
    case "creatures":
    case "commanders":
      return true; // GG-44: unlocks at session start, same as Sanctum
    case "relics":
      return inputs.hasAnyRelic;
    case "fusion":
      return inputs.hasAnyCreature;
    case "pacts":
      return inputs.hasAnyContract;
    case "expeditions":
      return inputs.hasAnyBoundCreature;
    case "almanac":
    case "chronicle":
      return inputs.hasCompletedARun;
  }
}

export function deriveRailEntries(inputs: RailUnlockInputs): RailEntry[] {
  const sanctum: RailEntry = {
    id: "sanctum",
    label: "Sanctum",
    key: "M",
    state: inputs.currentStageId === "sanctum" ? "active" : "available"
  };

  const layers: RailEntry[] = (Object.keys(UNLOCK_LADDER) as RailLayerId[]).map((id) => {
    const { label, key, reason } = UNLOCK_LADDER[id];
    if (!isUnlocked(id, inputs)) {
      return { id, label, key, state: "locked", lockedReason: reason };
    }
    const badgeCount =
      id === "chronicle" ? inputs.unreadResultCount : id === "expeditions" ? inputs.returnedExpeditionCount : 0;
    if (badgeCount > 0) {
      return { id, label, key, state: "badged", badgeCount };
    }
    return { id, label, key, state: "available" };
  });

  return [sanctum, ...layers];
}
