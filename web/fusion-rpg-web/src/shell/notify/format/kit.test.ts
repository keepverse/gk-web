import { describe, expect, it } from "vitest";
import { defaultFormatKit, NOTIFY_ARG_KIND_PRIMITIVE } from "./kit";
import type { NotifyArg } from "../catalog";

describe("kit - the shared formatting primitives (notify-format spec §2, Testing 1-2)", () => {
  it("every closed arg kind except domainToken has a primitive", () => {
    // Compile-time enforced by kit.ts's `satisfies` (npm run build fails if NotifyArgKind gains a
    // member with no mapped primitive); this proves the four that DO exist resolve to real methods.
    for (const method of Object.values(NOTIFY_ARG_KIND_PRIMITIVE)) {
      expect(typeof defaultFormatKit[method]).toBe("function");
    }
    expect(Object.keys(NOTIFY_ARG_KIND_PRIMITIVE)).not.toContain("domainToken");
  });

  it("magnitude formats through formatMagnitude", () => {
    const arg: NotifyArg = { name: "amount", kind: "magnitude", value: { unit: "count", value: 42 } };
    expect(defaultFormatKit.magnitude(arg)).toBe("42");
  });

  it("count formats as a plain number", () => {
    const arg: NotifyArg = { name: "n", kind: "count", value: 3 };
    expect(defaultFormatKit.count(arg)).toBe("3");
  });

  it("turn and turnsFrom render the shared wording", () => {
    const arg: NotifyArg = { name: "t", kind: "worldTurn", value: 12 };
    expect(defaultFormatKit.turn(arg)).toBe("turn 12");
    expect(defaultFormatKit.turnsFrom(arg, 10)).toBe("in 2 turns");
    expect(defaultFormatKit.turnsFrom(arg, 12)).toBe("this turn");
  });

  it("a mismatched kind throws rather than silently misreading the value", () => {
    const arg: NotifyArg = { name: "n", kind: "count", value: 3 };
    expect(() => defaultFormatKit.magnitude(arg)).toThrow();
  });

  it("an unresolvable ref renders Pending, never the raw id (GG-23/GG-62)", () => {
    const arg: NotifyArg = { name: "sector", kind: "ref", value: { refKind: "sector", id: "s-secret-42" } };
    const rendered = defaultFormatKit.ref(arg, () => undefined);
    expect(rendered).toBe("Pending");
    expect(rendered).not.toContain("s-secret-42");
  });

  it("a resolved ref renders the resolver's own label", () => {
    const arg: NotifyArg = { name: "sector", kind: "ref", value: { refKind: "sector", id: "s-1" } };
    expect(defaultFormatKit.ref(arg, (ref) => `Sector ${ref.id}`)).toBe("Sector s-1");
  });
});
