/**
 * State → visual channels for one sector, as a pure function (world-stage W43,
 * spec-world-render.md §Design 1). A sector carries four independent facts at once — ownership,
 * whether it can be kept, what is on it, what it earns — and each gets its own channels. This
 * module owns **ownership** and **health**; content (slot silhouettes) is `slotSilhouettes.ts`
 * (W44) and yield is `world-numbers`' own figures — composing them is `SectorNode.tsx`'s job, not
 * this one's.
 *
 * **There is no `opacity` field anywhere in this module, on purpose.** `SectorNode.tsx:49-52`'s
 * `opacity = 0.35 + 0.65 × stability/1000` is unreadable *as a value* — 38% and 9% must both stay
 * legible — and indistinguishable from a card sitting behind a scrim. Every fact here reads on at
 * least two non-colour channels (GG-27): `token` is the only colour-bearing field, and it is never
 * returned alone.
 */

export type Ownership = "yours" | "enemy" | "open" | "contested";

/**
 * `anchored` is the healthy state and is silent by design (nothing to say); every other value adds
 * its own pattern/glyph/word so it never reads as "a shade of anchored". **`barren` is a flat,
 * distinct look, not a deeper fade** — `SectorNode.tsx:43-48`'s own comment already has the
 * reasoning right; this is the encoding fix.
 */
export type HealthState = "anchored" | "fading" | "barren" | "will-release" | "warded" | "neglected" | "unmade";

export type BorderTreatment = {
  style: "solid" | "dashed";
  /** `heavy-left` is `will-release`'s own treatment — a rule players learn to scan the left edge for. */
  weight: "normal" | "heavy-left";
};

export type Pattern = "hatch-fine" | "hatch-heavy" | "flat-desaturated";

export type ColorToken = "ownership-mine" | "ownership-enemy" | "ownership-neutral" | "ownership-contested";

/**
 * Every fact reads on at least two channels (GG-27). `token` is the only colour-bearing field and
 * is never returned alone — `crest` and `word` are unconditional, so ownership is always legible on
 * two non-colour channels even in the silent `anchored` case, and every other health state adds a
 * `pattern` and/or `glyph` of its own on top.
 */
export type Channels = {
  shape: "card" | "unknown";
  border: BorderTreatment;
  /** Ownership's own icon — present on every card, never null, so ownership never depends on `token` alone. */
  crest: string;
  /** Health's hatch. `null` only for `anchored` (nothing to say) and `barren`/`unmade` (a flat look, not a hatch). */
  pattern: Pattern | null;
  /** Health's urgency marker. `null` when the health state has none of its own. */
  glyph: string | null;
  /** The numeric root-hold meter — `null` exactly where a number would misstate the fact
   * (`barren`/`unmade`: there is no "how much", only whether). */
  meterMilli: number | null;
  /** Always present, always player vocabulary (GG-23) — the one channel every state adds to. */
  word: string;
  token: ColorToken;
};

export type SectorChannelInput = {
  intel: "Watched" | "Scouted" | "Rumored" | "Unknown";
  ownership: Ownership;
  health: HealthState;
  stabilityMilli: number;
};

const OWNERSHIP_TOKEN: Record<Ownership, ColorToken> = {
  yours: "ownership-mine",
  enemy: "ownership-enemy",
  open: "ownership-neutral",
  contested: "ownership-contested"
};

/** Three shapes before three colours (spec §Design 3's rule for legion markers, applied here too). */
const OWNERSHIP_CREST: Record<Ownership, string> = {
  yours: "⌂",
  enemy: "⚔",
  open: "·",
  contested: "⚡"
};

const OWNERSHIP_WORD: Record<Ownership, string> = {
  yours: "yours",
  enemy: "enemy",
  open: "open",
  contested: "contested"
};

/** Ground nobody holds reads as a real gap in ownership, not merely an unmarked one. */
const OWNERSHIP_BORDER_STYLE: Record<Ownership, BorderTreatment["style"]> = {
  yours: "solid",
  enemy: "solid",
  open: "dashed",
  contested: "dashed"
};

/**
 * Fog is read first, and from `intel` — never from emptiness. An unknown sector serialises every
 * field at its record default (`WorldEndpoints.cs:271-277`), so it is byte-identical on the wire to
 * a zeroed known one; branching on "is this empty?" would draw a real, poor sector as unexplored.
 */
const UNKNOWN_SILHOUETTE: Channels = {
  shape: "unknown",
  border: { style: "solid", weight: "normal" },
  crest: "?",
  pattern: null,
  glyph: null,
  meterMilli: null,
  word: "",
  token: "ownership-neutral"
};

export function channelsFor(input: SectorChannelInput): Channels {
  if (input.intel === "Unknown") return UNKNOWN_SILHOUETTE;

  const words = [OWNERSHIP_WORD[input.ownership]];
  let pattern: Pattern | null = null;
  let glyph: string | null = null;
  let weight: BorderTreatment["weight"] = "normal";
  let meterMilli: number | null = input.stabilityMilli;

  switch (input.health) {
    case "anchored":
      break; // silence is the healthy state — nothing to say
    case "fading":
      pattern = "hatch-fine";
      words.push("fading");
      break;
    case "barren":
      pattern = "flat-desaturated";
      words.push("cannot be kept");
      meterMilli = null; // barren is a fact, not a number that happens to be low
      break;
    case "will-release":
      weight = "heavy-left";
      glyph = "⚠";
      words.push("will release next turn");
      break;
    case "warded":
      pattern = "hatch-heavy";
      glyph = "🛡";
      words.push("warded");
      break;
    case "neglected":
      glyph = "☠";
      words.push("neglected");
      break;
    case "unmade":
      glyph = "※";
      words.push("the Unmade");
      meterMilli = null; // barren ground taken by the Unmade — the same "no number" fact
      break;
  }

  return {
    shape: "card",
    border: { style: OWNERSHIP_BORDER_STYLE[input.ownership], weight },
    crest: OWNERSHIP_CREST[input.ownership],
    pattern,
    glyph,
    meterMilli,
    word: words.join(" — "),
    token: OWNERSHIP_TOKEN[input.ownership]
  };
}

export const OWNERSHIP_VALUES: readonly Ownership[] = ["yours", "enemy", "open", "contested"];
export const HEALTH_VALUES: readonly HealthState[] = [
  "anchored",
  "fading",
  "barren",
  "will-release",
  "warded",
  "neglected",
  "unmade"
];
