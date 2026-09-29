import type { Magnitude } from "@/contract/types";

/**
 * Renders one `Magnitude`'s numeric portion. **No overload accepts a bare
 * `number`** — that omission is the GG-46 guard (spec-magnitude-and-units.md
 * §7): an unlabelled magnitude cannot be passed, so it cannot be rendered.
 * The surrounding sentence (the noun — "hp", "crit rate", "shield hp/s") is
 * composed by the `DisplayLine`'s own `key`/`args` template, not here — a
 * single `Magnitude` doesn't carry that label, only its class does.
 *
 * `locale` is accepted for the eventual per-locale number grouping
 * (`Intl.NumberFormat`) a second locale will need; unused while English is
 * the only shipped locale (web/spec.md §10).
 */
export function formatMagnitude(m: Magnitude, locale = "en"): string {
  // party-dungeon D5.3 (spec-delve-stage.md §13, §18 ask 8) — a `long` figure whose true value may
  // sit past `Number.MAX_SAFE_INTEGER` renders through its exact decimal string, via `BigInt`, never
  // through `m.value` (which may already have lost precision crossing the wire as a JSON number).
  // `Intl.NumberFormat.prototype.format` accepts a `BigInt` natively — no `Number(...)` round-trip,
  // per §16's own "never parse a long into a number and back."
  if (m.exact !== undefined) {
    return new Intl.NumberFormat(locale).format(BigInt(m.exact));
  }
  switch (m.unit) {
    case "gameUnits":
    case "gameUnitsPerSecond":
    case "sigmoidPoints":
    case "sigmoidMultiplierPoints":
    case "statusPotencyPoints":
    // reciprocalPoints (class-system, spec-unit-class-close.md §3.5): same raw-delta shape as
    // gameUnits — a debuff can push penetration/absorption/amplification/reduction negative, so the
    // signed-int format applies, not the unsigned one ladderIndex/aptitudePoints use below.
    case "reciprocalPoints":
      return signedInt(m.value, locale);
    case "perMilleRatio":
      return formatPerMille(m.value, m.op);
    case "milliseconds":
      return formatMilliseconds(m.value);
    case "count":
      return new Intl.NumberFormat(locale).format(m.value);
    // loamUnits (world-numbers W38): a whole count, unsigned — the point of the class is that
    // whether it reads as a cost, a stock or a flow is `LoamFigure`'s own composition on top of
    // this number, never a name this renderer special-cases (the four `…Milli`-named fields it
    // exists to stop misreading are never consulted here either).
    case "loamUnits":
      return new Intl.NumberFormat(locale).format(m.value);
    // ladderIndex (Theta, spec-magnitude-and-units.md §3.2) and aptitudePoints (an allocation's own
    // point count, spec-primary-stats.md §3.2) are both non-negative by construction — Theta never
    // goes below 0 and AptitudeAllocation rejects negative points (P1.2) — so neither needs the
    // signed +/− prefix gameUnits-shaped classes carry.
    case "ladderIndex":
    case "aptitudePoints":
      return new Intl.NumberFormat(locale).format(m.value);
    case "flag":
      // Never a number — present/absent per spec-magnitude-and-units.md's unit ledger.
      return m.value !== 0 ? "present" : "absent";
    default: {
      const exhaustive: never = m.unit;
      throw new Error(`formatMagnitude: unhandled UnitClass ${String(exhaustive)}`);
    }
  }
}

function signedInt(value: number, locale: string): string {
  const formatted = new Intl.NumberFormat(locale).format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`; // real minus sign, not a hyphen
  return formatted;
}

/**
 * `PerMilleRatio` carries `op` (spec-magnitude-and-units.md §7's `Magnitude.op`).
 * Guard #5 (§8): `increased` and `more` must render differently — rendering
 * both the same way is the exact defect that guard exists to catch.
 * The renderer divides the raw per-mille integer by 10 per SC4's display
 * posture (§9.1), independent of the engine-side latent defect the same
 * section documents (the FE renders correctly regardless of whether the
 * engine currently composes `increased` right).
 *
 * `absolute` (world-numbers W37, owner-authorised 2026-09-04) is for a field whose own neutral
 * baseline is 1000, not zero — `FractureIntensityMilli` is the shipped example. It renders the raw
 * value as a multiplier with **no delta convention**: `1400` → `×1.40`, matching `1000` → `×1.00`
 * (neutral) rather than `more`'s `×(1 + value/1000)`, which would double-count the baseline
 * (`1400` → `×2.40`, the verified defect this op exists to fix).
 */
function formatPerMille(value: number, op: Magnitude["op"]): string {
  const pct = value / 10;
  switch (op) {
    case "more":
      return `×${(1 + value / 1000).toFixed(2)}`;
    case "absolute":
      return `×${(value / 1000).toFixed(2)}`;
    case "increased":
      return formatPercent(pct, { alwaysSigned: true });
    case "flat":
    default:
      return formatPercent(pct, { alwaysSigned: false });
  }
}

/**
 * One decimal, then the trailing `.0` trimmed — `24.0%` reads as `24%`, and `24.5%` is untouched.
 * Every per-mille value on the wire is a whole integer, so the smallest possible non-zero result
 * (0.1%) can never round away to `0.0` — rounding happens once, here, away from zero, the same
 * direction the engine itself rounds, and a genuinely non-zero fact never renders as `0%`.
 */
function formatPercent(pct: number, { alwaysSigned }: { alwaysSigned: boolean }): string {
  let digits = Math.abs(pct).toFixed(1);
  if (digits.endsWith(".0")) digits = digits.slice(0, -2);
  if (pct < 0) return `−${digits}%`;
  return alwaysSigned ? `+${digits}%` : `${digits}%`;
}

/** "4.0 s · 250 ms under one second" — spec-magnitude-and-units.md's unit ledger. */
function formatMilliseconds(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs < 1000) return `${sign}${abs} ms`;
  return `${sign}${(abs / 1000).toFixed(1)} s`;
}

/** The steepness `CombatProbabilityPolicy.Steepness` declares — read from
 * `gk-core/data/tuning/stats.v1.json` on the C# side and pinned against it by `magnitude.test.ts`, since this
 * file cannot import the tuning at runtime (combat-math-dedup T17, D12). */
export const SIGMOID_STEEPNESS = 1.0;

/** `1/(1+e^(-x*steepness))` — ResistanceEvaluator.cs:111-112, the one legal sigmoid. */
function sigmoid(x: number, steepness = SIGMOID_STEEPNESS): number {
  return 1 / (1 + Math.exp(-x * steepness));
}

export type SigmoidReference = { kind: "neutral" } | { kind: "specimen"; label: string };

/** The three scales `CombatProbabilityPolicy` declares (CombatPolicies.cs:8-13). */
export const CombatProbabilityScale = {
  Accuracy: 100.0,
  CritRate: 100.0,
  CritDamage: 100.0
} as const;

/**
 * The `ContextRead.text` a `SigmoidPoints`/`SigmoidMultiplierPoints` line
 * carries — `≈ +31.8 pp vs neutral` (spec-magnitude-and-units.md §5, D.1's
 * corrected worked example). **Not** the two-bare-percentages pairing
 * ("7.6% → 26.9%") an earlier plate draft used — that shape was found and
 * rejected in the same document (§14 D.1 row) for showing two numbers with
 * no stated reference; a signed percentage-point delta against a named
 * reference is what replaced it, and this is that replacement, not the
 * pattern it replaced.
 */
export function formatSigmoidContext(
  deltaPoints: number,
  reference: SigmoidReference,
  scale = CombatProbabilityScale.CritRate
): string {
  const deltaPp = (sigmoid(deltaPoints / scale) - sigmoid(0)) * 100;
  const sign = deltaPp >= 0 ? "+" : "−";
  const referenceLabel = reference.kind === "neutral" ? "neutral" : reference.label;
  return `≈ ${sign}${Math.abs(deltaPp).toFixed(1)} pp vs ${referenceLabel}`;
}
