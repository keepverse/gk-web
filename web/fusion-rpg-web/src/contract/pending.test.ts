import { describe, expect, it } from "vitest";
import { absent, isKnown, isPending, known, pendingWithReason } from "./pending";

describe("Pending<T>", () => {
  it("known() carries a value and is distinguishable from absent/pending", () => {
    const p = known(42);
    expect(p).toEqual({ state: "known", value: 42 });
    expect(isKnown(p)).toBe(true);
    expect(isPending(p)).toBe(false);
  });

  it("absent() and pending() are structurally different — 'you have none' vs 'not built yet'", () => {
    const a = absent<number>();
    const p = pendingWithReason<number>("no endpoint yet");
    expect(a).toEqual({ state: "absent" });
    expect(p).toEqual({ state: "pending", reason: "no endpoint yet" });
    expect(a).not.toEqual(p);
  });

  it("isPending narrows to the reason field", () => {
    const p = pendingWithReason<string>("not wired");
    if (isPending(p)) {
      expect(p.reason).toBe("not wired");
    } else {
      throw new Error("expected pending");
    }
  });
});
