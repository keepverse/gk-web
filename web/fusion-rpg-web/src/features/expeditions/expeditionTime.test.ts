import { describe, expect, it } from "vitest";
import { expeditionProgress, formatRemaining } from "./expeditionTime";

const dispatched = "2026-08-21T10:00:00.0000000Z";
const due30m = "2026-08-21T10:30:00.0000000Z"; // scout-30m: 6 ticks × 5m

const at = (iso: string) => Date.parse(iso);

describe("expedition tick pro-rating (mirrors the server boundary math)", () => {
  it("counts only whole tick boundaries", () => {
    expect(expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:00:00Z")).elapsedTicks).toBe(0);
    expect(expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:04:59Z")).elapsedTicks).toBe(0);
    expect(expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:05:00Z")).elapsedTicks).toBe(1);
    expect(expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:17:30Z")).elapsedTicks).toBe(3);
  });

  it("clamps at the tier tick count and flips due at the deadline", () => {
    const past = expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T11:30:00Z"));
    expect(past.elapsedTicks).toBe(6);
    expect(past.due).toBe(true);
    expect(past.remainingMs).toBe(0);
    expect(past.progress).toBe(1);

    const before = expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:29:59Z"));
    expect(before.due).toBe(false);
    expect(before.remainingMs).toBe(1000);
  });

  it("progress is a clamped fraction of the full duration", () => {
    expect(expeditionProgress(dispatched, due30m, 5, 6, at("2026-08-21T10:15:00Z")).progress).toBeCloseTo(0.5);
  });
});

describe("formatRemaining", () => {
  it("renders the right unit band", () => {
    expect(formatRemaining(0)).toBe("due");
    expect(formatRemaining(45_000)).toBe("45s");
    expect(formatRemaining(3 * 60_000 + 20_000)).toBe("3m 20s");
    expect(formatRemaining(2 * 3_600_000 + 5 * 60_000)).toBe("2h 05m");
  });
});
