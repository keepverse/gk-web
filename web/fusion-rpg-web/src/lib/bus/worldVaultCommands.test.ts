import { describe, expect, it } from "vitest";
import {
  buildDepositCargoCommand,
  buildWithdrawCargoCommand,
  type WorldCommandRequest
} from "./world";

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault
 * action-row files 4A.1's real kinds through the EXISTING `POST /api/world/{worldId}/commands`
 * filer. Pure builders, no fetch mocking: the server half (admission + resolve + report) is
 * proved over HTTP by 4A.1's `CargoCommands` suite — this file proves the FE files the exact
 * `EntityId` + `SectorId` + `Seq` shape admission owns, and nothing else.
 */
describe("vault cargo builders — real kinds, admission shapes, no weight on the wire", () => {
  it("put-in files deposit-cargo with EntityId + SectorId + Seq", () => {
    const cmd = buildDepositCargoCommand({
      commandId: "cmd-1",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      seq: 2
    });
    expect(cmd).toMatchObject({
      commandId: "cmd-1",
      kind: "deposit-cargo",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      seq: 2
    });
  });

  it("take-out files withdraw-cargo with the same admission shape", () => {
    const cmd = buildWithdrawCargoCommand({
      commandId: "cmd-2",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      seq: 0
    });
    expect(cmd).toMatchObject({
      commandId: "cmd-2",
      kind: "withdraw-cargo",
      entityId: "e-dave-legion-1",
      sectorId: "homeworld",
      seq: 0
    });
  });

  it("neither builder carries a weight member — mass resolves server-side at commit", () => {
    const deposit = buildDepositCargoCommand({
      commandId: "cmd-1",
      entityId: "e",
      sectorId: "s",
      seq: 0
    }) as unknown as Record<string, unknown>;
    const withdraw = buildWithdrawCargoCommand({
      commandId: "cmd-2",
      entityId: "e",
      sectorId: "s",
      seq: 0
    }) as unknown as Record<string, unknown>;
    for (const cmd of [deposit, withdraw]) {
      expect(cmd).not.toHaveProperty("weightEach");
      expect(cmd).not.toHaveProperty("weight");
    }
  });

  it("the mirror type carries seq for the /commands filer (compile-level round trip)", () => {
    const cmd: WorldCommandRequest = {
      commandId: "cmd-3",
      kind: "deposit-cargo",
      entityId: "e",
      sectorId: "s",
      seq: 1
    };
    expect(JSON.parse(JSON.stringify(cmd)) as WorldCommandRequest).toMatchObject({ seq: 1 });
  });
});
