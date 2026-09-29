import { describe, expect, it } from "vitest";
import {
  percentile,
  summarizeTimings,
  trackAPasses,
  trackBPasses,
  TRACK_A_P95_MS,
  TRACK_B_P95_MS
} from "./timingStats";

describe("timingStats (phaser-scene-poc)", () => {
  it("percentile interpolates and summarizeTimings sorts", () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 95)).toBeGreaterThan(40);
    const s = summarizeTimings([50, 10, 30]);
    expect(s.count).toBe(3);
    expect(s.p50).toBe(30);
    expect(s.max).toBe(50);
  });

  it("Pass bars match the research protocol", () => {
    expect(TRACK_A_P95_MS).toBeCloseTo(1000 / 60 * 2, 5);
    expect(TRACK_B_P95_MS).toBe(300);
    expect(trackAPasses(32)).toBe(true);
    expect(trackAPasses(40)).toBe(false);
    expect(trackBPasses(299)).toBe(true);
    expect(trackBPasses(301)).toBe(false);
  });
});
