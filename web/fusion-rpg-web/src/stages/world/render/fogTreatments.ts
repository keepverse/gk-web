import type { IntelState } from "@/contract/types";

/**
 * The four fog treatments (world-stage W47, spec-world-render.md §Design 4) — the server already
 * answers this in four derived states (`IntelLadder.StateOf`, `FactionIntel.cs:133-140`,
 * `FreshTurns = 5` at `:131`); the client renders one well and the rest as a question mark.
 *
 * **Fog and ownership never share a channel** — the control case (unowned but Watched) gets a
 * dashed ownership border from `sectorChannels.ts`'s own `OWNERSHIP_BORDER_STYLE`, never a wash or
 * a stamp, because those two facts never overlap in the first place: this module never reads or
 * sets border *style*, only the wash/stamp/forces-strip that sit alongside it.
 *
 * `Unknown` never reaches this module in practice — `sectorChannels.ts`'s own `channelsFor` returns
 * a wholly different silhouette before anything here would run — but it is still a legal input,
 * answered the same "nothing" way, so a caller that skips the branch-on-`intel` guard fails safe
 * rather than crashing.
 */
export type FogWash = "none" | "parchment" | "torn";

export type FogTreatment = {
  wash: FogWash;
  /** The wash's own opacity cap — §8.2's legibility check priced these exactly. */
  washCapPercent: number;
  doubledBorder: boolean;
  raggedBorder: boolean;
  /** A dated stamp ("seen 3 turns ago") or a hedge ("hearsay") — `null` only for `Watched`. */
  stamp: string | null;
  /**
   * **Explicit, never a gap.** Static facts (name, type, climate, danger, development, slots,
   * structures, ownership) survive on a stale card; dynamic facts (forces, guard state, marching
   * legions) do not, and this string is what a stale card shows in their place — an empty gap
   * would read as "nobody is there", which is a different, false claim.
   */
  forcesStrip: string | null;
};

const NOTHING_TO_SAY: FogTreatment = {
  wash: "none",
  washCapPercent: 0,
  doubledBorder: false,
  raggedBorder: false,
  stamp: null,
  forcesStrip: null
};

const NOT_KNOWN_STRIP = "who stands here is not known";

export function fogTreatmentFor(intel: IntelState, intelAge: number): FogTreatment {
  switch (intel) {
    case "Watched":
      return NOTHING_TO_SAY;
    case "Scouted":
      return {
        wash: "parchment",
        washCapPercent: 13,
        doubledBorder: true,
        raggedBorder: false,
        stamp: `seen ${intelAge} turn${intelAge === 1 ? "" : "s"} ago`,
        forcesStrip: NOT_KNOWN_STRIP
      };
    case "Rumored":
      return {
        wash: "torn",
        washCapPercent: 18,
        doubledBorder: false,
        raggedBorder: true,
        stamp: "hearsay",
        forcesStrip: NOT_KNOWN_STRIP
      };
    case "Unknown":
      return NOTHING_TO_SAY;
    default: {
      const exhaustive: never = intel;
      throw new Error(`fogTreatments: unhandled intel state ${JSON.stringify(exhaustive)}`);
    }
  }
}
