import { describe, expect, it } from "vitest";
import {
  entityMeetsActorHudPollCriteria,
  findActorHudEntity,
  normalizePtr,
  parseBoardStatsPayload
} from "./live-debug-api-core";

describe("normalizePtr", () => {
  it("trims and uppercases", () => {
    expect(normalizePtr(" z1 ")).toBe("Z1");
    expect(normalizePtr("0xabc")).toBe("0XABC");
  });
});

describe("parseBoardStatsPayload", () => {
  it("parses JSON string payloads", () => {
    const payload = parseBoardStatsPayload(
      JSON.stringify({ zombies: [{ ptr: "Z1", actorHud: { statuses: [] } }] })
    );
    expect(payload?.zombies).toHaveLength(1);
  });

  it("returns null for invalid JSON", () => {
    expect(parseBoardStatsPayload("{bad")).toBeNull();
  });
});

describe("findActorHudEntity", () => {
  const board = {
    plants: [{ ptr: "P1", actorHud: { statuses: [{ id: "x" }] } }],
    zombies: [
      { ptr: "z2", actorHud: { statuses: [] } },
      {
        ptr: "Z3",
        row: 2,
        col: 4,
        actorHud: {
          resources: { shield: { hp: 50, max: 80 } },
          statuses: [{ id: "command" }, { id: "expose" }]
        }
      }
    ]
  };

  it("matches ptr case-insensitively", () => {
    const ent = findActorHudEntity(board, " z3 ");
    expect(ent?.row).toBe(2);
    expect(ent?.actorHud?.resources?.shield?.hp).toBe(50);
  });

  it("returns null when ptr missing", () => {
    expect(findActorHudEntity(board, "GHOST")).toBeNull();
  });

  it("returns null when actorHud absent", () => {
    const ent = findActorHudEntity({ zombies: [{ ptr: "Z9" }] }, "Z9");
    expect(ent?.actorHud).toBeUndefined();
  });
});

describe("entityMeetsActorHudPollCriteria", () => {
  it("requires shield hp and min statuses", () => {
    const ent = {
      actorHud: {
        resources: { shield: { hp: 10, max: 80 } },
        statuses: [{ id: "a" }]
      }
    };
    expect(entityMeetsActorHudPollCriteria(ent, 2)).toBe(false);
    expect(entityMeetsActorHudPollCriteria(ent, 1)).toBe(true);
  });

  it("rejects zero shield hp", () => {
    const ent = {
      actorHud: {
        resources: { shield: { hp: 0, max: 80 } },
        statuses: [{ id: "a" }, { id: "b" }]
      }
    };
    expect(entityMeetsActorHudPollCriteria(ent, 2)).toBe(false);
  });
});
