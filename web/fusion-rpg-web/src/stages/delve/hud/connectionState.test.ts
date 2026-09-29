import { describe, expect, it } from "vitest";
import { connectionStatusLabel, type DelveConnectionStatus } from "./connectionState";

describe("connectionStatusLabel (D5.6, spec-delve-stage.md §7/§9)", () => {
  it("maps the four states to real player copy, never an id", () => {
    expect(connectionStatusLabel("live")).toBe("Live");
    expect(connectionStatusLabel("reconnecting")).toBe("Reconnecting…");
    expect(connectionStatusLabel("offline")).toBe("Not connected");
  });

  it("'frozen' reuses spec-delve-stage.md §9's own quoted sentence verbatim, not a paraphrase", () => {
    expect(connectionStatusLabel("frozen")).toBe("Your band is waiting.");
  });

  it("is exhaustive over the closed union — an unrecognised value throws rather than guessing", () => {
    expect(() => connectionStatusLabel("bogus" as DelveConnectionStatus)).toThrow(
      /connectionStatusLabel: unhandled status/
    );
  });
});
