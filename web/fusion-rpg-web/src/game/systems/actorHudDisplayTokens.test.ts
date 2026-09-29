import { describe, expect, it, afterEach } from "vitest";
import {
  STATUS_STRIP_MAX,
  resolveStatusHudToken,
  tierBadgeLetter
} from "./actorHudDisplayTokens";

describe("actorHudDisplayTokens", () => {
  afterEach(() => {
    delete window.__fusionRpgActorSurface;
  });

  it("STATUS_STRIP_MAX mirrors tuning statusStripMax", () => {
    expect(STATUS_STRIP_MAX).toBe(3);
  });

  it("resolveStatusHudToken uses catalog when injected", () => {
    window.__fusionRpgActorSurface = {
      statuses: [{ id: "expose", hudToken: "EX", color: "#ff0000", displayName: "Expose" }]
    };
    expect(resolveStatusHudToken("expose")).toEqual({
      hudToken: "EX",
      color: "#ff0000",
      displayName: "Expose"
    });
  });

  it("resolveStatusHudToken uses placeholder when catalog missing (not id-slice SSOT)", () => {
    expect(resolveStatusHudToken("expose").hudToken).toBe("·");
  });

  it("tierBadgeLetter maps tier to canvas badge letter", () => {
    expect(tierBadgeLetter("normal")).toBe("");
    expect(tierBadgeLetter("elite")).toBe("E");
    expect(tierBadgeLetter("boss")).toBe("B");
    expect(tierBadgeLetter("unique")).toBe("U");
  });
});
