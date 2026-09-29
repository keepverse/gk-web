import { describe, expect, it } from "vitest";
import { defaultChannelOf } from "./catalog";

describe("catalog — defaultChannelOf (notify-vocabulary spec §3, R-N2)", () => {
  it("an unregistered id defaults to the rail", () => {
    expect(defaultChannelOf("nothing.registered")).toBe("rail");
  });

  it("a registered-but-unpromoted category still defaults to the rail (world-notify-source's own supply.change)", () => {
    // Registered means the loader accepted the row, not that it earns Toast. This test pins the
    // CONTRACT (no self-promotion, R-N2), never a count.
    expect(defaultChannelOf("supply.change")).toBe("rail");
  });

  it("world-notify-source v2 promotes loam.shortfall to toast (categories.ts's own TOAST_TIER, migrated)", () => {
    expect(defaultChannelOf("loam.shortfall")).toBe("toast");
  });
});
