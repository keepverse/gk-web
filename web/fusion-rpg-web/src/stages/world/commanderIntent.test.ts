import { describe, expect, it } from "vitest";
import { toCommanderIntents } from "./commanderIntent";
import type { WorldTurnReportDto } from "@/lib/bus/world";

const report = (commands: WorldTurnReportDto["commands"]): WorldTurnReportDto => ({
  turn: 3,
  stateHash: "abc",
  phases: [],
  entries: [],
  commands
});

describe("what the other commanders were thinking", () => {
  it("keeps the orders that came with a reason", () => {
    const intents = toCommanderIntents(
      report([
        {
          commanderId: "zomboss",
          commandId: "ai-3-e-zomboss-band-1",
          kind: "move",
          entityId: "e-zomboss-band-1",
          sectorId: "ash-waste",
          reason: "expand, value 640"
        }
      ])
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].action).toBe("e-zomboss-band-1 → ash-waste");
    expect(intents[0].reason).toBe("expand, value 640");
  });

  it("leaves out your own orders, because you know why you gave them", () => {
    const intents = toCommanderIntents(
      report([
        { commanderId: "dave", commandId: "mine", kind: "move", entityId: "e-dave-legion-1", reason: null },
        { commanderId: "wild", commandId: "ai-3-stand", kind: "stand-fast", reason: "stand fast" }
      ])
    );

    expect(intents.map((i) => i.commanderId)).toEqual(["wild"]);
  });

  it("survives a report that has been trimmed down to nothing", () => {
    // Reports outside the hot tail are re-derived and can come back empty. Commands never are —
    // they are the save — so the panel must not assume the two arrive together.
    expect(toCommanderIntents(undefined)).toEqual([]);
    expect(toCommanderIntents(report([]))).toEqual([]);
  });

  it("describes an order it has never heard of rather than dropping it", () => {
    // A new command kind must show up as *something*. Silence would read as "the AI did nothing",
    // which is the one thing the panel exists to disprove.
    const intents = toCommanderIntents(
      report([{ commanderId: "zomboss", commandId: "x", kind: "besiege", entityId: "e-1", reason: "why not" }])
    );

    expect(intents[0].action).toContain("besiege");
  });
});
