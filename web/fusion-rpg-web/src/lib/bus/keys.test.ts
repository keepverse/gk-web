import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";

describe("queryKeys", () => {
  it("uniqueActor key is stable per instanceId", () => {
    expect(queryKeys.uniqueActor("abc")).toEqual(["uniqueActor", "abc"]);
  });

  it("uniqueActors key is stable per playerId", () => {
    expect(queryKeys.uniqueActors(3)).toEqual(["uniqueActors", 3]);
  });

  it("uniqueEquipment key is stable per instanceId", () => {
    expect(queryKeys.uniqueEquipment("a1")).toEqual(["uniqueEquipment", "a1"]);
  });
});
