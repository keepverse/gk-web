import type { Magnitude, UnitClass } from "@/contract/types";
import { formatMagnitude } from "@/i18n/magnitude";
import type { MagnitudeDisplay } from "../types";

/** Cook catalog UnitClass (Pascal / wire) → contract UnitClass. */
const COOK_TO_UNIT: Record<string, UnitClass | "unitInterval"> = {
  GameUnits: "gameUnits",
  PerMilleRatio: "perMilleRatio",
  SigmoidPoints: "sigmoidPoints",
  SigmoidMultiplierPoints: "sigmoidMultiplierPoints",
  StatusPotencyPoints: "statusPotencyPoints",
  UnitInterval: "unitInterval",
  Flag: "flag",
  LadderIndex: "ladderIndex",
  AptitudePoints: "aptitudePoints",
  ReciprocalPoints: "reciprocalPoints",
  GameUnitsPerSecond: "gameUnitsPerSecond",
  Milliseconds: "milliseconds",
  Count: "count",
  LoamUnits: "loamUnits",
  gameUnits: "gameUnits",
  perMilleRatio: "perMilleRatio",
  sigmoidPoints: "sigmoidPoints",
  unitInterval: "unitInterval",
  flag: "flag",
  ladderIndex: "ladderIndex",
  aptitudePoints: "aptitudePoints",
  reciprocalPoints: "reciprocalPoints"
};

/** Units where formatMagnitude adds a signed prefix — strip for composed channel totals. */
const SIGNED_TOTAL_UNITS = new Set<UnitClass | "unitInterval">([
  "gameUnits",
  "gameUnitsPerSecond",
  "sigmoidPoints",
  "sigmoidMultiplierPoints",
  "statusPotencyPoints",
  "reciprocalPoints"
]);

export type DerivedMagnitudeRole = "total" | "delta";

export type FormatDerivedMagnitudeOptions = {
  locale?: string;
  /** `total` = channel/hero (unsigned gameUnits-shaped). `delta` = contrib lines (keep sign). */
  role?: DerivedMagnitudeRole;
};

function stripLeadingSign(text: string): string {
  // formatMagnitude uses U+2212 − for negatives; also strip ASCII +/-
  return text.replace(/^[+\u2212\-]/, "");
}

/**
 * GG-46 adapter for Derived fold — always goes through formatMagnitude when a
 * UnitClass exists; UnitInterval stays a fixed two-decimal display (no Magnitude unit).
 */
export function formatDerivedMagnitude(
  value: number,
  unitClass: string,
  localeOrOpts: string | FormatDerivedMagnitudeOptions = "en"
): MagnitudeDisplay {
  const opts: FormatDerivedMagnitudeOptions =
    typeof localeOrOpts === "string" ? { locale: localeOrOpts } : localeOrOpts;
  const locale = opts.locale ?? "en";
  const role = opts.role ?? "total";

  const mapped = COOK_TO_UNIT[unitClass] ?? "gameUnits";
  if (mapped === "unitInterval") {
    const text = value.toFixed(2);
    return {
      valueRaw: value,
      valueText: role === "delta" && value > 0 ? `+${text}` : text,
      unitLabel: null,
      formatterId: "UnitInterval"
    };
  }
  const m: Magnitude = {
    unit: mapped,
    value,
    ...(mapped === "perMilleRatio" ? { op: "flat" as const } : {})
  };
  let valueText = formatMagnitude(m, locale);
  if (role === "total" && SIGNED_TOTAL_UNITS.has(mapped)) {
    valueText = stripLeadingSign(valueText);
  }
  return {
    valueRaw: value,
    valueText,
    unitLabel: null,
    formatterId: mapped
  };
}
