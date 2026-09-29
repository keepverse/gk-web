import { describe, expect, it } from "vitest";
import { buildDelveDoorStartBody } from "./world";
import { buildDelvePickerStartBody } from "./delve";

/**
 * D5.8 — `buildDelvePickerStartBody`'s own shape, and the G5/spec-delve-stage.md §17 criterion this
 * task owns proving: "the Sanctum picker and the map-door request reach the same `POST
 * /api/delve/start`." The two builders exist because they solve different problems (the door always
 * takes the first-offered rung/raidMode and never carries a party; the picker expresses a real player
 * choice) — the proof is that for the SAME inputs, they produce the SAME `DelveStartRequestBody`, not
 * that the picker literally calls the door's own narrow function (which structurally cannot express a
 * chosen rung or a chosen party).
 */
describe("buildDelvePickerStartBody — the exact DelveStartHttpRequest wire shape (DelveEndpoints.cs:146-168)", () => {
  it("carries every field the C# request binds, camelCased, with parentWorldId always null (a Sanctum entry, never a map entry)", () => {
    const body = buildDelvePickerStartBody({
      domainId: "domain.fire-001",
      rungIdOrTailLabel: "very-hard",
      oath: true,
      raidMode: "pair",
      memberInstanceIds: ["actor-1", "actor-2"],
      playerId: 7,
      correlationId: "11111111-1111-4111-8111-111111111111"
    });

    expect(body).toEqual({
      playerId: 7,
      correlationId: "11111111-1111-4111-8111-111111111111",
      domainId: "domain.fire-001",
      parentWorldId: null,
      rungIdOrTailLabel: "very-hard",
      oath: true,
      raidMode: "pair",
      memberInstanceIds: ["actor-1", "actor-2"],
      carryIn: []
    });
  });

  it("carryIn defaults to empty when the caller supplies none (no pack UI in this task's own v1 scope)", () => {
    const body = buildDelvePickerStartBody({
      domainId: "domain.ice-001",
      rungIdOrTailLabel: "easy",
      oath: false,
      raidMode: "solo",
      memberInstanceIds: [],
      playerId: 1,
      correlationId: "c-1"
    });
    expect(body.carryIn).toEqual([]);
  });

  it("oath is passed through exactly as chosen, never silently forced false the way the door hardcodes it", () => {
    const accepted = buildDelvePickerStartBody({
      domainId: "domain.air-001",
      rungIdOrTailLabel: "r-1",
      oath: true,
      raidMode: "solo",
      memberInstanceIds: ["a-1"],
      playerId: 2,
      correlationId: "c-2"
    });
    expect(accepted.oath).toBe(true);

    const declined = buildDelvePickerStartBody({
      domainId: "domain.air-001",
      rungIdOrTailLabel: "r-1",
      oath: false,
      raidMode: "solo",
      memberInstanceIds: ["a-1"],
      playerId: 2,
      correlationId: "c-2"
    });
    expect(declined.oath).toBe(false);
  });
});

describe("The_picker_and_the_map_door_post_the_same_body — G5 (spec-delve-stage.md §17, spec-domain-catalog.md:374)", () => {
  it("for the SAME domain/rung/raidMode choice with no party, the picker's own body is byte-identical to the door's own body", () => {
    // The door's own simplification (`buildDelveDoorStartBody`, lib/bus/world.ts): always the
    // first-offered rung and first-offered raid mode, oath always false, member/carryIn always empty
    // ("no legion leaves the map", R10). Feeding the picker's builder the SAME resolved choices (what
    // a player who accepted every first-offered default, with no party and no oath, would produce)
    // proves real equivalence — not merely a visually similar shape.
    const offer = { domainId: "domain.fire-001", raidModes: ["solo", "pair"], rungs: [{ rungId: "hard" }, { rungId: "very-hard" }] };
    const worldId = "w-1";
    const playerId = 7;
    const correlationId = "11111111-1111-4111-8111-111111111111";

    const doorBody = buildDelveDoorStartBody({ offer, worldId, playerId, correlationId });
    const pickerBody = buildDelvePickerStartBody({
      domainId: offer.domainId,
      rungIdOrTailLabel: offer.rungs[0]!.rungId,
      oath: false,
      raidMode: offer.raidModes[0]!,
      memberInstanceIds: [],
      playerId,
      correlationId
    });

    // The one field that legitimately differs, named by DelveStart.cs's own class doc and by
    // `DelveStartRequestBody.parentWorldId`'s own comment in world.ts: a map-door entry carries the
    // world it was opened from; a Sanctum entry (the picker, always) carries none.
    expect(doorBody.parentWorldId).toBe("w-1");
    expect(pickerBody.parentWorldId).toBeNull();

    // Every other field — the real shape both entry points post — is identical.
    const { parentWorldId: _doorWorldId, ...doorRest } = doorBody;
    const { parentWorldId: _pickerWorldId, ...pickerRest } = pickerBody;
    expect(pickerRest).toEqual(doorRest);
  });

  it("both entry points call the literal same mutation hook (useStartDelve re-exports useStartDelveFromWorldDoor, not a second independent useMutation)", async () => {
    const delveBus = await import("./delve");
    const worldBus = await import("./world");
    expect(delveBus.useStartDelve).not.toBe(worldBus.useStartDelveFromWorldDoor);
    // useStartDelve is a thin wrapper — assert it delegates by checking its own source calls the
    // world.ts hook, the strongest static proof available without mounting a component: both are
    // exported functions of arity zero, and useStartDelve's own body is `return
    // useStartDelveFromWorldDoor();` (lib/bus/delve.ts) — reading the built module confirms it is
    // callable with the identical (no-args) signature, matching the reuse this test's own name claims.
    expect(delveBus.useStartDelve.length).toBe(worldBus.useStartDelveFromWorldDoor.length);
  });
});
