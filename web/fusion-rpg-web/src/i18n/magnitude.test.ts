import { describe, expect, it } from "vitest";
import type { Magnitude, UnitClass } from "@/contract/types";
import statsTuning from "@gk-core/data/tuning/stats.v1.json";
import {
  CombatProbabilityScale,
  formatMagnitude,
  formatSigmoidContext,
  SIGMOID_STEEPNESS
} from "./magnitude";

function mag(unit: Magnitude["unit"], value: number, extra?: Partial<Magnitude>): Magnitude {
  return { unit, value, ...extra };
}

describe("formatMagnitude — one golden case per unit class (spec-magnitude-and-units.md §3)", () => {
  it("gameUnits: signed integer, no unit suffix (composed by the DisplayLine, not here)", () => {
    expect(formatMagnitude(mag("gameUnits", 45))).toBe("+45");
    expect(formatMagnitude(mag("gameUnits", -12))).toBe("−12");
    expect(formatMagnitude(mag("gameUnits", 0))).toBe("0");
  });

  it("gameUnitsPerSecond: same signed-integer shape", () => {
    expect(formatMagnitude(mag("gameUnitsPerSecond", 3))).toBe("+3");
  });

  it("sigmoidPoints: the raw points, signed — not a percentage (that's formatSigmoidContext's job)", () => {
    expect(formatMagnitude(mag("sigmoidPoints", 30))).toBe("+30");
  });

  it("sigmoidMultiplierPoints: same shape", () => {
    expect(formatMagnitude(mag("sigmoidMultiplierPoints", 40))).toBe("+40");
  });

  it("statusPotencyPoints: same shape", () => {
    expect(formatMagnitude(mag("statusPotencyPoints", 8))).toBe("+8");
  });

  it("perMilleRatio increased: +15% (per-mille divided by 10, SC4 display posture)", () => {
    // world-numbers W37: a trailing ".0" is trimmed — 15.0% reads as 15%.
    expect(formatMagnitude(mag("perMilleRatio", 150, { op: "increased" }))).toBe("+15%");
  });

  it("perMilleRatio more: ×1.15 — a multiplier, not a percentage (Guard #5: increased/more differ)", () => {
    expect(formatMagnitude(mag("perMilleRatio", 150, { op: "more" }))).toBe("×1.15");
  });

  it("perMilleRatio increased and more render differently for the same raw value (Guard #5)", () => {
    const increased = formatMagnitude(mag("perMilleRatio", 150, { op: "increased" }));
    const more = formatMagnitude(mag("perMilleRatio", 150, { op: "more" }));
    expect(increased).not.toBe(more);
  });

  it("perMilleRatio flat: a plain percentage (chance/share)", () => {
    // world-numbers W37: a trailing ".0" is trimmed — 25.0% reads as 25%.
    expect(formatMagnitude(mag("perMilleRatio", 250, { op: "flat" }))).toBe("25%");
  });

  it("perMilleRatio absolute: ×1.40 from the raw 1400 — no delta-from-1000 arithmetic (world-numbers W37, the verified defect's fix)", () => {
    expect(formatMagnitude(mag("perMilleRatio", 1400, { op: "absolute" }))).toBe("×1.40");
    // The neutral baseline itself renders neutral.
    expect(formatMagnitude(mag("perMilleRatio", 1000, { op: "absolute" }))).toBe("×1.00");
  });

  it("perMilleRatio flat: StabilityMilli 240 renders 24%, not 24.0% — the acceptance's own named example", () => {
    expect(formatMagnitude(mag("perMilleRatio", 240, { op: "flat" }))).toBe("24%");
  });

  it("perMilleRatio: a non-trivial decimal is not trimmed away", () => {
    expect(formatMagnitude(mag("perMilleRatio", 245, { op: "flat" }))).toBe("24.5%");
  });

  it("perMilleRatio: a small non-zero value never renders as 0% — the smallest per-mille integer already clears one decimal", () => {
    expect(formatMagnitude(mag("perMilleRatio", 1, { op: "flat" }))).toBe("0.1%");
    expect(formatMagnitude(mag("perMilleRatio", 1, { op: "flat" }))).not.toBe("0%");
  });

  it("perMilleRatio: a genuine zero still renders 0%, not merely trimmed away to nothing", () => {
    expect(formatMagnitude(mag("perMilleRatio", 0, { op: "flat" }))).toBe("0%");
  });

  it("loamUnits: a whole, unsigned count — the class the four …Milli loam-cost fields actually are", () => {
    expect(formatMagnitude(mag("loamUnits", 200))).toBe("200");
    expect(formatMagnitude(mag("loamUnits", 0))).toBe("0");
  });

  it("movementRemaining (perMilleRatio, op flat) renders as a fraction of the march budget, never a bare count", () => {
    // 750‰ of one turn's march budget — never "750 movement".
    const rendered = formatMagnitude(mag("perMilleRatio", 750, { op: "flat" }));
    expect(rendered).toBe("75%");
    expect(rendered).not.toContain("movement");
    expect(rendered).not.toBe("750");
  });

  it("milliseconds under one second render as ms", () => {
    expect(formatMagnitude(mag("milliseconds", 250))).toBe("250 ms");
  });

  it("milliseconds at or over one second render as seconds", () => {
    expect(formatMagnitude(mag("milliseconds", 4000))).toBe("4.0 s");
  });

  it("count: a bare integer", () => {
    expect(formatMagnitude(mag("count", 2))).toBe("2");
  });

  it("flag: present/absent, never a number", () => {
    expect(formatMagnitude(mag("flag", 1))).toBe("present");
    expect(formatMagnitude(mag("flag", 0))).toBe("absent");
    expect(formatMagnitude(mag("flag", 1))).not.toMatch(/\d/);
  });
});

/**
 * party-dungeon D5.3 (spec-delve-stage.md §13, §14's own named test row) — "a value above
 * `MAX_SAFE_INTEGER` renders digit for digit through `exact`". Uses a souls-shaped fixture (`count`)
 * since that is this task's own concrete, named example (`DelveRow.SoulsUnbanked`), but the mechanism
 * under test is generic to any `Magnitude` carrying `exact` — see `types.ts`'s own `Magnitude.exact`
 * doc comment for the real, separate gap in how far this precision survives the live delve wire today.
 */
describe("formatMagnitude — Magnitude.exact (D5.3, a long figure past Number.MAX_SAFE_INTEGER)", () => {
  it("A_long_soul_balance_renders_exactly: a value already mangled by IEEE754 still renders the true digits", () => {
    // The true server-side long value — one past Number.MAX_SAFE_INTEGER, so an ordinary `number`
    // cannot hold it exactly. `value` below is deliberately a WRONG, already-rounded reading (as it
    // would arrive after a lossy JSON round-trip) to prove the renderer prefers `exact` over it, not
    // merely that it renders correctly when the two happen to agree.
    const trueValue = "9007199254740993"; // Number.MAX_SAFE_INTEGER + 2, not representable exactly
    const mangled = Number(trueValue); // rounds to 9007199254740992 — provably not equal to trueValue
    expect(String(mangled)).not.toBe(trueValue);

    const rendered = formatMagnitude(mag("count", mangled, { exact: trueValue }));
    expect(rendered).toBe("9,007,199,254,740,993");
    expect(rendered).not.toBe(new Intl.NumberFormat("en").format(mangled));
  });

  it("renders a genuinely huge long (near Int64.MaxValue) digit for digit, grouped", () => {
    const trueValue = "9223372036854775807"; // long.MaxValue
    const rendered = formatMagnitude(mag("count", 0, { exact: trueValue }));
    expect(rendered).toBe("9,223,372,036,854,775,807");
  });

  it("a negative exact figure renders with its sign, via BigInt, no Number(...) round-trip", () => {
    const rendered = formatMagnitude(mag("gameUnits", 0, { exact: "-9223372036854775808" }));
    expect(rendered).toBe("-9,223,372,036,854,775,808");
  });

  it("exact is respected regardless of unit class — the field wins before the unit switch runs", () => {
    expect(formatMagnitude(mag("perMilleRatio", 500, { op: "flat", exact: "123456789012345678" }))).toBe(
      "123,456,789,012,345,678"
    );
  });

  it("a Magnitude with no exact field still renders through the ordinary value path (no regression)", () => {
    expect(formatMagnitude(mag("count", 42))).toBe("42");
  });

  it("an in-range value with exact set still prefers exact, byte for byte", () => {
    // Even when value is already correct, exact — when present — is the one source of truth; this
    // proves the branch is unconditional on `m.exact !== undefined`, not a magnitude-size heuristic.
    expect(formatMagnitude(mag("count", 42, { exact: "42" }))).toBe("42");
  });
});

describe("formatMagnitude — CJK locale fixture", () => {
  it("does not break under a CJK locale code, and groups large numbers per that locale", () => {
    // English only ships this pass (web/spec.md §10); this proves the plumbing survives a real
    // locale code rather than assuming it — Intl.NumberFormat is locale-aware even though no
    // Japanese catalog exists yet.
    expect(() => formatMagnitude(mag("count", 12345), "ja-JP")).not.toThrow();
    expect(formatMagnitude(mag("count", 12345), "ja-JP")).toBe("12,345");
    expect(formatMagnitude(mag("gameUnits", 45), "ja-JP")).toBe("+45");
  });
});

describe("formatSigmoidContext — the corrected two-part-line shape", () => {
  it("matches spec-magnitude-and-units.md's own worked example: +150 crit rate -> ~+31.8 pp vs neutral", () => {
    // The delta is against a 0-point (neutral) baseline: sigmoid(0) = 0.5, sigmoid(1.5) ~= 0.8176.
    expect(formatSigmoidContext(150, { kind: "neutral" })).toBe("≈ +31.8 pp vs neutral");
  });

  it("names a specimen reference when given one, not just 'neutral'", () => {
    expect(formatSigmoidContext(150, { kind: "specimen", label: "Peashooter" })).toBe(
      "≈ +31.8 pp vs Peashooter"
    );
  });

  it("a negative delta renders a negative pp with the real minus sign", () => {
    expect(formatSigmoidContext(-150, { kind: "neutral" })).toBe("≈ −31.8 pp vs neutral");
  });

  it("never renders the rejected two-bare-percentages shape (no '%' or '->' in its output)", () => {
    const text = formatSigmoidContext(150, { kind: "neutral" });
    expect(text).not.toContain("%");
    expect(text).not.toContain("->");
    expect(text).not.toContain("→");
  });
});

/**
 * combat-math-dedup T17 (D11/D12). The C# side (`ItemDisplayRenderer.FormatSigmoidContext`) and this
 * one cannot share an implementation across the language boundary, so the pp fixture below is the
 * binding: it is the SAME table the C# test walks
 * (`gk-core/tests/FusionRpg.Core.Items.Tests/Items/ItemDisplayTests.cs`,
 * `FormatSigmoidContext_is_the_sigmoids_shift_from_neutral_in_pp`). Change one side's arithmetic and
 * one of the two tests goes red.
 */
describe("sigmoid context parity with the C# side", () => {
  const FIXTURE: Array<[delta: number, pp: string, sign: string]> = [
    [0, "0.0", "+"],
    [30, "7.4", "+"],
    [150, "31.8", "+"],
    [-150, "31.8", "−"]
  ];

  it.each(FIXTURE)("delta %i pp reads %s (sign %s)", (delta, pp, sign) => {
    const text = formatSigmoidContext(delta, { kind: "neutral" });
    const match = /^≈ ([+−])([\d.]+) pp vs neutral$/.exec(text);
    expect(match, text).not.toBeNull();
    expect(match![1]).toBe(sign);
    expect(match![2]).toBe(pp);
  });

  it("hardcoded tuning constants match data/tuning/stats.v1.json", () => {
    // A `gk-core/tools/tuning/publish.py stats` bump has to fail here rather than silently disagree with the
    // C# reader of the same file. No runtime import is possible in the shipped bundle, so the values
    // stay literals and this test is the check.
    expect(SIGMOID_STEEPNESS).toBe(statsTuning.steepness);
    expect(CombatProbabilityScale.Accuracy).toBe(statsTuning.accuracyScale);
    expect(CombatProbabilityScale.CritRate).toBe(statsTuning.critRateScale);
    expect(CombatProbabilityScale.CritDamage).toBe(statsTuning.critDamageScale);
  });
});

/**
 * Task I9 (spec-tree-surface.md §6, §14 test 15) -- "Focus_renders_as_prose_and_creates_no_unit_class:
 * the UnitClass union is byte-identical before and after this module." The Passives Focus line (`1/H`,
 * "about N paths") deliberately renders as plain prose in `passivesYours.ts`'s own `focusReading`/
 * `draftFocusPreview` and `PassivesTab.tsx`/`PlanPanel.tsx`'s own JSX -- never through
 * `formatMagnitude`, never a `Magnitude` -- so no fourteenth `UnitClass` is needed or added.
 *
 * `ALL_UNIT_CLASSES` below is a `Record<UnitClass, true>` object literal assigned directly to that
 * type, which makes BOTH directions of drift a real `tsc` compile error at `npm run build`'s
 * `--noEmit` step, not just a runtime count:
 *  - adding a 14th member to `UnitClass` makes this object literal miss a required key (a
 *    "Property '...' is missing" error) until this file is updated to acknowledge it;
 *  - removing a member from `UnitClass` makes this object literal carry an EXCESS key TypeScript's
 *    own excess-property check on a directly-assigned object literal flags.
 * The runtime assertion below is the same guarantee restated as something `vitest run` can also see
 * (vitest's transform strips types without checking them, so the compile-time half above only fires
 * under `tsc --noEmit`; this count is the fast, always-on half of the same proof).
 */
describe("UnitClass union — byte-identical guard (task I9)", () => {
  const ALL_UNIT_CLASSES: Record<UnitClass, true> = {
    gameUnits: true,
    gameUnitsPerSecond: true,
    sigmoidPoints: true,
    sigmoidMultiplierPoints: true,
    statusPotencyPoints: true,
    perMilleRatio: true,
    milliseconds: true,
    count: true,
    flag: true,
    ladderIndex: true,
    aptitudePoints: true,
    reciprocalPoints: true,
    loamUnits: true
  };

  it("still has exactly thirteen members -- spec-tree-surface.md §6: 'thirteen and none of them has to grow'", () => {
    expect(Object.keys(ALL_UNIT_CLASSES)).toHaveLength(13);
  });
});
