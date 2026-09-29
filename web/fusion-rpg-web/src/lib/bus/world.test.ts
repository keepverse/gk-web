import { describe, expect, it } from "vitest";
import { buildDelveDoorStartBody } from "./world";

describe("buildDelveDoorStartBody — the exact DelveStartHttpRequest wire shape (DelveEndpoints.cs:146-168, party-dungeon D1.28)", () => {
  it("carries every field the C# request binds, camelCased, with parentWorldId set from the map", () => {
    const body = buildDelveDoorStartBody({
      offer: {
        domainId: "domain.fire-001",
        raidModes: ["solo", "duo"],
        rungs: [{ rungId: "hard" }, { rungId: "very-hard" }]
      },
      worldId: "w-1",
      playerId: 7,
      correlationId: "11111111-1111-4111-8111-111111111111"
    });

    expect(body).toEqual({
      playerId: 7,
      correlationId: "11111111-1111-4111-8111-111111111111",
      domainId: "domain.fire-001",
      parentWorldId: "w-1",
      rungIdOrTailLabel: "hard",
      oath: false,
      raidMode: "solo",
      memberInstanceIds: [],
      carryIn: []
    });
  });

  it("no legion leaves the map — memberInstanceIds and carryIn are always empty (R10)", () => {
    const body = buildDelveDoorStartBody({
      offer: { domainId: "domain.ice-001", raidModes: ["solo"], rungs: [{ rungId: "easy" }] },
      worldId: "w-2",
      playerId: 1,
      correlationId: "c-1"
    });
    expect(body.memberInstanceIds).toEqual([]);
    expect(body.carryIn).toEqual([]);
    expect(body.oath).toBe(false);
  });

  it("degrades to an empty rung/raid-mode string rather than throwing when an offer carries none", () => {
    const body = buildDelveDoorStartBody({
      offer: { domainId: "domain.air-001", raidModes: [], rungs: [] },
      worldId: "w-3",
      playerId: 2,
      correlationId: "c-2"
    });
    expect(body.rungIdOrTailLabel).toBe("");
    expect(body.raidMode).toBe("");
  });
});
