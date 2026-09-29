import { describe, expect, it } from "vitest";
import type { ContractRowDto } from "@/lib/bus/contracts";
import type { CreatureProfileDto } from "@/lib/bus/creatures";
import type { RunItem, UniqueActorDto } from "@/lib/bus/types";
import type { RelicDto } from "@/lib/bus/types";
import { mockUniqueActor } from "@/test/mocks";
import { adaptActor, adaptCommanderList, adaptCommanderSheet, adaptContract, adaptRelic, adaptRun } from "./adapt";
import { assertNoEmptyPendingReasons } from "./contractGuard";

describe("adaptActor against the shared server fixture (T5)", () => {
  it("adapts the real server-shaped DTO from e2e/fixtures/unique-actor.json without throwing", () => {
    const view = adaptActor(mockUniqueActor);
    expect(view.instanceId).toBe(mockUniqueActor.instanceId);
    expect(view.side).toBe(mockUniqueActor.side);
    expect(view.level).toBe(mockUniqueActor.level);
    expect(() => assertNoEmptyPendingReasons(view)).not.toThrow();
  });
});

const actorDto: UniqueActorDto = {
  instanceId: "a1",
  playerId: 1,
  side: "plant",
  typeId: 3,
  phase: "ActiveBound",
  level: 5,
  xp: 120,
  revision: 2
};

describe("adaptActor", () => {
  it("carries known identity fields straight through", () => {
    const view = adaptActor(actorDto);
    expect(view.instanceId).toBe("a1");
    expect(view.side).toBe("plant");
    expect(view.level).toBe(5);
    expect(view.phase).toBe("ActiveBound");
  });

  it("wraps not-yet-servable fields as pending with a non-empty reason", () => {
    const view = adaptActor(actorDto);
    expect(view.channelSummary.state).toBe("pending");
    expect(view.elementTyping.state).toBe("pending");
    expect(() => assertNoEmptyPendingReasons(view)).not.toThrow();
  });

  it("falls back to Idle for an unrecognized phase string rather than crashing", () => {
    const view = adaptActor({ ...actorDto, phase: "SomeFuturePhase" });
    expect(view.phase).toBe("Idle");
  });
});

describe("adaptRun", () => {
  const base: RunItem = {
    id: 7,
    startedUtc: "2026-08-23T00:00:00Z"
  };

  it("marks a missing levelName as absent, not pending — the server answered 'none'", () => {
    const view = adaptRun(base);
    expect(view.levelName).toEqual({ state: "absent" });
  });

  it("carries a present levelName as known", () => {
    const view = adaptRun({ ...base, levelName: "Backyard" });
    expect(view.levelName).toEqual({ state: "known", value: "Backyard" });
  });

  it("normalizes an unrecognized result string to 'unknown' rather than inventing one", () => {
    const view = adaptRun({ ...base, result: "weird-value" });
    expect(view.result).toBe("unknown");
  });

  it("every pending field carries a non-empty reason", () => {
    const view = adaptRun({ ...base, summary: { some: "payload" } });
    expect(() => assertNoEmptyPendingReasons(view)).not.toThrow();
  });
});

describe("adaptContract", () => {
  const row: ContractRowDto = {
    instanceId: "d1",
    bound: true,
    loyalty: 800,
    rank: "veteran",
    rankBonusMilli: 50,
    personality: "stoic",
    upkeepPerDay: 3,
    deployable: true
  };
  const profile: CreatureProfileDto = {
    instanceId: "d1",
    speciesId: "sp-imp",
    rarity: "rare",
    variant: "default",
    elementPrimary: "fire",
    traitIds: [],
    origin: "captured",
    locked: false,
    star: 1,
    promoted: false,
    createdUtc: "2026-08-23T00:00:00Z",
    revision: 1
  };

  it("joins the contract row and the creature profile by instanceId", () => {
    const view = adaptContract(row, profile);
    expect(view.instanceId).toBe("d1");
    expect(view.speciesId).toBe("sp-imp");
    expect(view.rarity).toBe("rare");
    expect(view.loyalty).toBe(800);
    expect(view.personality).toBe("stoic");
  });

  it("every pending field carries a non-empty reason", () => {
    expect(() => assertNoEmptyPendingReasons(adaptContract(row, profile))).not.toThrow();
  });
});

describe("adaptRelic (T14)", () => {
  const relic: RelicDto = {
    id: "relic.ashen_reliquary",
    name: "Ashen Reliquary",
    rarity: 4,
    slot: "weapon",
    description: "A reliquary warm to the touch. Channels raw offense.",
    effectId: "fx.passive_atk_flat"
  };

  it("maps into the Container entity's item kind — not a separate rung", () => {
    const view = adaptRelic(relic);
    expect(view.kind).toBe("item");
    expect(view.instanceId).toBe("relic.ashen_reliquary");
    expect(view.header.name).toBe("Ashen Reliquary");
    expect(view.header.baseTypeAndClassNoun).toBe("Relic · Weapon");
    expect(view.flavour).toBe(relic.description);
  });

  it("maps the four seed rarities onto the real ten-rung ladder's first four rungs", () => {
    expect(adaptRelic({ ...relic, rarity: 1 }).header.rarity.id).toBe("chaff");
    expect(adaptRelic({ ...relic, rarity: 2 }).header.rarity.id).toBe("sprout");
    expect(adaptRelic({ ...relic, rarity: 3 }).header.rarity.id).toBe("grafted");
    expect(adaptRelic({ ...relic, rarity: 4 }).header.rarity.id).toBe("cultivated");
  });

  it("honestly declares an unformatted implicit rather than faking a magnitude, and no other field is silently missing a reason", () => {
    const view = adaptRelic(relic);
    expect(view.implicit.state).toBe("pending");
    expect(() => assertNoEmptyPendingReasons(view)).not.toThrow();
  });

  it("leaves affixes, sockets, sets and enhancement honestly absent — this catalog has none of those systems", () => {
    const view = adaptRelic(relic);
    expect(view.affixes).toEqual({ state: "absent" });
    expect(view.sockets).toEqual({ state: "absent" });
    expect(view.set).toEqual({ state: "absent" });
    expect(view.enhancement).toEqual({ state: "absent" });
  });
});

describe("adaptCommanderSheet", () => {
  it("maps commander list row fields into ActorView for the sheet role", () => {
    const view = adaptCommanderSheet(
      {
        id: "commander:dave",
        displayName: "Crazy Dave",
        isDefault: true,
        activeAuraId: "Might",
        activeAuraName: "Might",
        locationStub: "Sanctum",
        legionStub: null
      },
      1
    );
    expect(view.instanceId).toBe("commander:dave");
    expect(view.playerId).toBe(1);
    expect(view.displayName).toEqual({ state: "known", value: "Crazy Dave" });
    expect(view.level).toBe(1);
    expect(view.channelSummary.state).toBe("pending");
  });
});

describe("adaptCommanderList", () => {
  it("maps the list envelope and rows through unchanged", () => {
    const view = adaptCommanderList({
      defaultLawnCommanderId: "commander:dave",
      commanders: [
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: null,
          activeAuraName: null,
          locationStub: null,
          legionStub: null
        }
      ]
    });
    expect(view.defaultLawnCommanderId).toBe("commander:dave");
    expect(view.commanders).toHaveLength(1);
    expect(view.commanders[0]).toEqual({
      id: "commander:dave",
      displayName: "Crazy Dave",
      isDefault: true,
      activeAuraId: null,
      activeAuraName: null,
      locationStub: null,
      legionStub: null
    });
  });

  it("carries active aura fields when present", () => {
    const view = adaptCommanderList({
      defaultLawnCommanderId: "commander:dave",
      commanders: [
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: "Might",
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        }
      ]
    });
    expect(view.commanders[0]?.activeAuraId).toBe("Might");
    expect(view.commanders[0]?.activeAuraName).toBe("Might");
  });
});
