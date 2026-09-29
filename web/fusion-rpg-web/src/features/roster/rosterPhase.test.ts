import { describe, expect, it } from "vitest";
import { canAwardXp, canDeploy, canEquip, canRetire } from "./rosterPhase";

describe("rosterPhase", () => {
  it("canDeploy / canEquip only Roster", () => {
    expect(canDeploy("Roster")).toBe(true);
    expect(canEquip("Roster")).toBe(true);
    expect(canDeploy("ActiveBound")).toBe(false);
    expect(canEquip("Deploying")).toBe(false);
  });

  it("canAwardXp refuses Retired", () => {
    expect(canAwardXp("Roster")).toBe(true);
    expect(canAwardXp("ActiveBound")).toBe(true);
    expect(canAwardXp("Retired")).toBe(false);
  });

  it("canRetire blocks Deploying Recovering Retired", () => {
    expect(canRetire("Roster")).toBe(true);
    expect(canRetire("ActiveBound")).toBe(true);
    expect(canRetire("Deploying")).toBe(false);
    expect(canRetire("Recovering")).toBe(false);
    expect(canRetire("Retired")).toBe(false);
  });
});
