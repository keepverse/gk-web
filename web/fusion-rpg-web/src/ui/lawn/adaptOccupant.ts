import type { Occupant } from "@/features/lawn/lawnViewModel";

/**
 * Session-scoped observe handle for Wave (general) occupants.
 * Dies with the occupant — never enters `?sel=` / address bar.
 */
export type LawnObserveHandle = `observe:${string}`;

export type LawnOccupantChip = "Fielded" | "Wave";

export type LawnCollectionRow = {
  /** Stable list key — instanceId or observe handle. */
  key: string;
  chip: LawnOccupantChip;
  displayName: string;
  side: "plant" | "zombie";
  rarity?: string;
  hpFraction?: number;
  /** Bound unique only — never for Wave. */
  instanceId?: string;
  /** Wave only — opaque; never URL-encoded. */
  observeHandle?: LawnObserveHandle;
  /** Engine ptr — never player-facing; kept for dock targeting only. */
  _ptr: string;
};

export function makeObserveHandle(ptr: string, generation = 0): LawnObserveHandle {
  return `observe:${ptr}:${generation}`;
}

/** URL helper — refuses general / Wave selection. */
export function encodeLawnSel(row: Pick<LawnCollectionRow, "instanceId" | "chip">): string | null {
  if (row.chip !== "Fielded" || !row.instanceId) return null;
  return row.instanceId;
}

/**
 * Map living lawn occupants → collection rows (adapt before ActorRow).
 * Never copies ptr into player-visible fields.
 */
export function adaptOccupants(
  occupants: Occupant[],
  opts?: { generation?: number }
): LawnCollectionRow[] {
  const generation = opts?.generation ?? 0;
  const rows = occupants.map((o) => adaptOccupant(o, generation));
  return sortCollectionRows(rows);
}

export function adaptOccupant(o: Occupant, generation = 0): LawnCollectionRow {
  const fielded = Boolean(o.instanceId);
  const chip: LawnOccupantChip = fielded ? "Fielded" : "Wave";
  const displayName =
    o.typeName?.trim() ||
    (fielded ? `Specimen` : o.side === "plant" ? "Wave plant" : "Wave zombie");
  const hpFraction =
    o.hp != null && o.maxHp != null && o.maxHp > 0 ? Math.max(0, Math.min(1, o.hp / o.maxHp)) : undefined;

  if (fielded && o.instanceId) {
    return {
      key: o.instanceId,
      chip,
      displayName,
      side: o.side,
      hpFraction,
      instanceId: o.instanceId,
      _ptr: o.ptr
    };
  }

  const observeHandle = makeObserveHandle(o.ptr, generation);
  return {
    key: observeHandle,
    chip: "Wave",
    displayName,
    side: o.side,
    hpFraction,
    observeHandle,
    _ptr: o.ptr
  };
}

/** Default sort: Fielded first, then plants, then zombies. */
export function sortCollectionRows(rows: LawnCollectionRow[]): LawnCollectionRow[] {
  const sideRank = (s: string) => (s === "plant" ? 0 : 1);
  const chipRank = (c: LawnOccupantChip) => (c === "Fielded" ? 0 : 1);
  return [...rows].sort((a, b) => {
    const c = chipRank(a.chip) - chipRank(b.chip);
    if (c !== 0) return c;
    return sideRank(a.side) - sideRank(b.side);
  });
}
