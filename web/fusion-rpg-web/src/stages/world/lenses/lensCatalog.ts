import { channelsFor, type SectorChannelInput, type HealthState } from "../render/sectorChannels";

/**
 * world-stage W94 (spec-world-lenses.md §1) — the closed set. Adding a seventh is a spec decision,
 * not a convenience: every lens is a thing the player has to learn and a thing every sector has to
 * answer. Placement (the targeting overlay) is deliberately not here — see §2, it has no picker slot
 * and no hotkey, `world-targeting`'s alone.
 */
export const LENSES = [
  { id: "ownership", key: "1", label: "Ownership", cost: "free" },
  { id: "loam", key: "2", label: "Loam flow", cost: "free" },
  { id: "fade", key: "3", label: "Fade risk", cost: "free" },
  { id: "supply", key: "4", label: "Supply & lifelines", cost: "server" },
  { id: "intel", key: "5", label: "Intel age", cost: "free" },
  { id: "danger", key: "6", label: "Danger", cost: "free" }
] as const;

export type LensId = (typeof LENSES)[number]["id"];

/** Ownership is the home lens — pressing the active lens's own key returns here. */
export const HOME_LENS_ID: LensId = "ownership";

export function lensLabel(id: LensId): string {
  return LENSES.find((l) => l.id === id)!.label;
}

// ---------------------------------------------------------------------------------------------
// world-stage W99 (spec-world-lenses.md §7) — one pure, colour-free encoding per lens. A lens is
// by nature a re-colouring, which is exactly where GG-27 (squint test) and GG-30 (contrast) are
// most at risk — the evidence is blunt (§7's own ES2/Endless mod counts). None of the six readings
// below carries a colour field at all: colour is a rendering-layer decision a future component
// makes on top of these, never the only channel a fact is read from. No React import, no store
// access — same discipline as `sectorChannels.ts` (W43), which lens 1 (ownership) reuses directly
// rather than duplicating its four-pattern ownership encoding.
// ---------------------------------------------------------------------------------------------

export type OwnershipLensReading = { crest: string; pattern: string | null; word: string };

/** Lens 1 — reuses `sectorChannels.channelsFor` wholesale: ownership's four patterns (crest +
 * border style + hatch) are already that module's whole job, so this lens never re-derives them. */
export function encodeOwnershipLens(input: SectorChannelInput): OwnershipLensReading {
  const c = channelsFor(input);
  return { crest: c.crest, pattern: c.pattern, word: c.word };
}

export type LoamFlowLensReading = { arrow: "up" | "down" | "flat"; label: string };

/**
 * Lens 2 — an arrow plus a signed number. `loamNet === null` is ground the viewer does not own
 * (`WorldSectorDto.loamNet` is owner-only and zero for anything you do not hold on the wire, but
 * that zero is indistinguishable from a real balanced sector you *do* own — the lens's own input
 * must carry ownership separately and pass `null` rather than `0` for unowned ground). The
 * acceptance criterion this exists to satisfy: the lens renders `—`, never `0`, for ground that is
 * not yours.
 */
export function encodeLoamFlowLens(loamNet: number | null): LoamFlowLensReading {
  if (loamNet === null) return { arrow: "flat", label: "—" };
  const arrow = loamNet > 0 ? "up" : loamNet < 0 ? "down" : "flat";
  const sign = loamNet > 0 ? "+" : "";
  return { arrow, label: `${sign}${loamNet}` };
}

export type FadeRiskLensReading = { word: string };

const FADE_RISK_WORD: Record<HealthState, string> = {
  anchored: "stable",
  fading: "fading",
  barren: "cannot be kept",
  "will-release": "will release next turn",
  warded: "warded — protected from fading",
  neglected: "neglected",
  unmade: "the Unmade"
};

/** Lens 3 — a word. Reuses `sectorChannels.ts`'s own `HealthState` rather than a private copy. */
export function encodeFadeRiskLens(health: HealthState): FadeRiskLensReading {
  return { word: FADE_RISK_WORD[health] };
}

export type SupplyLensReading = { weight: "thin" | "thick"; caption: string };

/** Lens 4 — line weight plus a caption on the hinge sector. `lifeline`/`lifelineCost` are already
 * exactly "which roads, if cut, halve your territory" (`WorldSectorDto`'s own fields) — this lens
 * never re-derives the fact, only how it reads. */
export function encodeSupplyLens(input: { lifeline: boolean; lifelineCost: number }): SupplyLensReading {
  if (!input.lifeline) return { weight: "thin", caption: "" };
  return { weight: "thick", caption: `hinge — losing this costs ${input.lifelineCost} loam upkeep` };
}

export type IntelAgeLensReading = { hatch: "none" | "light" | "heavy"; turnsLabel: string };

/** Lens 5 — a hatch plus a number of turns. Heavy past 5 turns old is a design choice, not a magic
 * number a balance pass would tune — it is a legibility threshold on a UI-only visual, structurally
 * exempt from the tunables-ssot standard the same way a per-frame cap is. */
export function encodeIntelAgeLens(intelAge: number): IntelAgeLensReading {
  if (intelAge <= 0) return { hatch: "none", turnsLabel: "current" };
  const hatch = intelAge >= 5 ? "heavy" : "light";
  return { hatch, turnsLabel: `${intelAge} turn${intelAge === 1 ? "" : "s"} old` };
}

export type DangerLensReading = { diamondCount: number; label: string };

/** Lens 6 — a count of diamonds. `dangerBand` is already a small non-negative index
 * (`WorldSectorDto.dangerBand`), so the count is a direct pass-through, never re-scaled. */
export function encodeDangerLens(dangerBand: number): DangerLensReading {
  const diamondCount = Math.max(0, dangerBand);
  return { diamondCount, label: diamondCount === 0 ? "no danger" : `danger ${diamondCount}` };
}
