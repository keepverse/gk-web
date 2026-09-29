import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveRailEntries, STAGE_IDS, type RailUnlockInputs } from "./railState";

describe("STAGE_IDS — spec-delve-stage.md §4: the count assertion becomes a pair, six declared", () => {
  it("is exactly six stages, delve included", () => {
    expect(STAGE_IDS).toEqual(["sanctum", "world", "lawn", "battle", "siege", "delve"]);
    expect(STAGE_IDS.length).toBe(6);
  });

  /**
   * spec-delve-stage.md §4 / spec-board-render.md:203: "since neither siege nor delve exists at
   * railState.ts:31 … the honest assertion is a pair — 6 declared, plus a test naming which are
   * built." "Built" here is read as **routed** — a real `<Route>` in `app/routes.tsx`, so the id is
   * not dead/empty — checked directly against that file's own source rather than a second
   * hand-maintained list, so this can never silently drift from the real route table.
   *
   * This is a narrower claim than "has real playable content": information-architecture.md:188
   * separately and correctly still calls siege and delve "declared and unbuilt" in THAT sense (no
   * room graph, no siege board yet) — the two statements describe different things and are both true
   * at once. `battle` is the one id with neither: no route in app/routes.tsx at all
   * (spec-board-render.md's own decision 40 either lands `#/battle` on the shared board layer or
   * retires the id — this file does not anticipate which).
   */
  it("names the routed subset separately from the declared six — battle is the one id with no route", () => {
    const routesSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/routes.tsx"), "utf8");
    const routed = STAGE_IDS.filter((id) => new RegExp(`path=["']${id}(/[^"']*)?["']`).test(routesSrc));
    expect(routed).toEqual(["sanctum", "world", "lawn", "siege", "delve"]);
    expect(STAGE_IDS.filter((id) => !routed.includes(id))).toEqual(["battle"]);
  });
});

const allLocked: RailUnlockInputs = {
  currentStageId: "sanctum",
  hasCompletedARun: false,
  hasAnyCreature: false,
  hasAnyContract: false,
  hasAnyRelic: false,
  hasAnyBoundCreature: false,
  returnedExpeditionCount: 0,
  unreadResultCount: 0
};

describe("deriveRailEntries — GG-44, renders from state", () => {
  it("returns Sanctum first, then the eight layers, in the fixed order", () => {
    const entries = deriveRailEntries(allLocked);
    expect(entries.map((e) => e.id)).toEqual([
      "sanctum",
      "creatures",
      "commanders",
      "relics",
      "fusion",
      "pacts",
      "expeditions",
      "almanac",
      "chronicle"
    ]);
  });

  it("Sanctum is active on the sanctum stage and available elsewhere", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "sanctum")!.state).toBe("active");
    expect(
      deriveRailEntries({ ...allLocked, currentStageId: "lawn" }).find((e) => e.id === "sanctum")!.state
    ).toBe("available");
  });

  it("Creatures is unlocked from session start regardless of any other state", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "creatures")!.state).toBe("available");
  });

  it("Commanders is unlocked from session start regardless of any other state", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "commanders")!.state).toBe("available");
  });

  it("every locked entry carries a non-empty reason (GG-17)", () => {
    const locked = deriveRailEntries(allLocked).filter((e) => e.state === "locked");
    expect(locked.length).toBeGreaterThan(0);
    for (const entry of locked) {
      expect(entry.lockedReason).toBeTruthy();
    }
  });

  it("Relics unlocks once the player holds at least one relic (T14)", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "relics")!.state).toBe("locked");
    expect(deriveRailEntries({ ...allLocked, hasAnyRelic: true }).find((e) => e.id === "relics")!.state).toBe(
      "available"
    );
  });

  it("Fusion unlocks once the player has a creature to fuse (T15)", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "fusion")!.state).toBe("locked");
    const entries = deriveRailEntries({ ...allLocked, hasAnyCreature: true });
    expect(entries.find((e) => e.id === "fusion")!.state).toBe("available");
  });

  it("Pacts unlocks on any contract existing", () => {
    const entries = deriveRailEntries({ ...allLocked, hasAnyContract: true });
    expect(entries.find((e) => e.id === "pacts")!.state).toBe("available");
  });

  it("Expeditions unlocks once the player has a bound creature to field (T17)", () => {
    expect(deriveRailEntries(allLocked).find((e) => e.id === "expeditions")!.state).toBe("locked");
    const entries = deriveRailEntries({ ...allLocked, hasAnyBoundCreature: true });
    expect(entries.find((e) => e.id === "expeditions")!.state).toBe("available");
  });

  it("Expeditions badges with the returned-but-uncollected count once unlocked", () => {
    const entries = deriveRailEntries({ ...allLocked, hasAnyBoundCreature: true, returnedExpeditionCount: 2 });
    const expeditions = entries.find((e) => e.id === "expeditions")!;
    expect(expeditions.state).toBe("badged");
    expect(expeditions.badgeCount).toBe(2);
  });

  it("a returned-expedition count does not badge a still-locked Expeditions", () => {
    const entries = deriveRailEntries({ ...allLocked, returnedExpeditionCount: 2 });
    expect(entries.find((e) => e.id === "expeditions")!.state).toBe("locked");
  });

  it("Almanac and Chronicle unlock together on the first completed run", () => {
    const entries = deriveRailEntries({ ...allLocked, hasCompletedARun: true });
    expect(entries.find((e) => e.id === "almanac")!.state).toBe("available");
    expect(entries.find((e) => e.id === "chronicle")!.state).toBe("available");
  });

  it("Chronicle badges with the unread result count once unlocked", () => {
    const entries = deriveRailEntries({ ...allLocked, hasCompletedARun: true, unreadResultCount: 3 });
    const chronicle = entries.find((e) => e.id === "chronicle")!;
    expect(chronicle.state).toBe("badged");
    expect(chronicle.badgeCount).toBe(3);
  });

  it("an unread count does not badge a still-locked Chronicle", () => {
    const entries = deriveRailEntries({ ...allLocked, unreadResultCount: 3 });
    expect(entries.find((e) => e.id === "chronicle")!.state).toBe("locked");
  });
});
