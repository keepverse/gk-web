import { describe, expect, it } from "vitest";
import { emptyMod, queryKeys } from "./index";

describe("bus types and keys", () => {
  it("emptyMod returns identity multipliers", () => {
    expect(emptyMod()).toEqual({
      hpPercent: 1,
      hpFlat: 0,
      attackPercent: 1,
      attackFlat: 0,
      defensePercent: 1,
      defenseFlat: 0
    });
  });

  it("runSpawns key includes run id", () => {
    expect(queryKeys.runSpawns(42)).toEqual(["runSpawns", 42]);
  });
});
