import type { ForceView, LegionView, Magnitude } from "@/contract/types";
import type { Pending } from "@/contract/pending";

/**
 * world-stage W101 (spec-world-confirms.md §1, plate 11 §K.1) — the stake list is data, so a
 * missing row is a visible diff rather than a forgotten paragraph. Six kinds, one per row this
 * dialog draws; `CommitLegionDialog.tsx` switches on `data.kind` to pick the right figure
 * component (`LoamFigure`/`BandFigure`/`PerMilleFigure`) rather than this module ever importing
 * React — a `Pending` field renders its own reason, never a zero, exactly where the projection is
 * genuinely `world-wire`'s and not yet on the mirror.
 */
export type StakeRowKind =
  | {
      kind: "garrison";
      count: Magnitude;
    }
  | {
      kind: "supply";
      amount: Pending<Magnitude>;
      capacity: Pending<Magnitude>;
    }
  | {
      kind: "burn";
      amount: Pending<Magnitude>;
    }
  | {
      kind: "runway";
      turnsLeft: Pending<number | null>;
      currentTurn: number;
    }
  | {
      kind: "fade";
      before: Magnitude;
      after: Pending<Magnitude>;
    }
  | {
      kind: "waiting";
      sectorName: string;
      force: ForceView | null;
    };

export type StakeRow = {
  id: string;
  glyph: string;
  says: string;
  tone: "loss" | "cost" | "clock" | "risk";
  data: StakeRowKind;
};

export type CommitStakeInput = {
  legion: LegionView;
  currentTurn: number;
  /** The origin sector's current loam net — always known, since a legion can only march off ground
   * it actually holds. */
  originNet: Magnitude;
  /**
   * What the origin sector's net becomes once this garrison leaves. **Not on the wire mirror
   * today** — `WorldSectorDto` carries the sector's current `loamNet`, never a "what if this
   * legion left" projection — so a real caller passes a `pendingWithReason` here until
   * `world-wire` adds one; this module never invents the number itself.
   */
  originNetAfterDeparture: Pending<Magnitude>;
  destinationSectorName: string;
  /** `null` means nothing is known to be waiting there — a real, different fact from "a force is
   * waiting but its strength is a band", which is `ForceView`'s own `exact: false` case. */
  destinationForce: ForceView | null;
};

/**
 * Plate 11 §K.1's four stakes plus the two facts a player needs to judge them (the runway and what
 * is waiting) — six rows total, always in this order. A `Pending` field on `LegionView` (carried
 * loam, capacity, burn, runway) passes straight through; this function never resolves one itself.
 */
export function buildCommitStakeRows(input: CommitStakeInput): StakeRow[] {
  const memberCount = input.legion.members.length;

  return [
    {
      id: "garrison",
      glyph: "⌂",
      says: `${memberCount} bound creature${memberCount === 1 ? "" : "s"} leave your ground`,
      tone: "loss",
      data: { kind: "garrison", count: { unit: "count", value: memberCount } }
    },
    {
      id: "supply",
      glyph: "◇",
      says: "They carry their supply with them",
      tone: "cost",
      data: { kind: "supply", amount: input.legion.carriedLoam, capacity: input.legion.capacity }
    },
    {
      id: "burn",
      glyph: "▼",
      says: "They burn on the march, every night",
      tone: "clock",
      data: { kind: "burn", amount: input.legion.burn }
    },
    {
      id: "runway",
      glyph: "⏳",
      says: "What they carry runs out on",
      tone: "clock",
      data: { kind: "runway", turnsLeft: input.legion.runway, currentTurn: input.currentTurn }
    },
    {
      id: "fade",
      glyph: "☠",
      says: "Losing this garrison changes the ground's fade",
      tone: "risk",
      data: { kind: "fade", before: input.originNet, after: input.originNetAfterDeparture }
    },
    {
      id: "waiting",
      glyph: "⚔",
      says: `Waiting at ${input.destinationSectorName}`,
      tone: "risk",
      data: { kind: "waiting", sectorName: input.destinationSectorName, force: input.destinationForce }
    }
  ];
}
