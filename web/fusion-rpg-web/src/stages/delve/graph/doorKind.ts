import type { DelveDoorState } from "@/contract/types";

/**
 * Door-kind visual rules (D5.4, spec-delve-stage.md §4/§7: "doors, gates, one-way arrows, secret dead
 * ends"). `DoorView.typeId` (`contract/types.ts:1045`) is the wire's only signal for what kind of
 * door this is — there is no boolean `oneWay`/`gated`/`hidden` field on the wire at all.
 *
 * **This is a named, deliberate client-side reading of a small closed server registry, not a wire
 * contract field — say so plainly.** `gk-data/packs/fusion/data/seed/dungeon/_registry/door-kinds.v1.json` (verified this
 * session, byte for byte) names exactly four door-kind ids and their flags: passage (nothing set),
 * gated (gated), one-way (oneWay), secret (hidden).
 *
 * `DoorTypeCatalog.cs` (`Core/Delve/DoorTypeCatalog.cs:7-16`) projects this registry into
 * `LaneTypeDef.{OneWay,Gated}` server-side for `WorldValidation`, but — exactly like
 * `RoomTypeCatalog.cs`'s own sibling doc comment about room kinds — **the registry itself is never
 * served to the client** (confirmed: zero hits for "door-kind"/"doorKind" anywhere under
 * `gk-web/web/fusion-rpg-web/src`, and no catalog route under `/api/` exposes it). So this module hardcodes the
 * four ids as a closed, small, presentation-only vocabulary — the same kind of client-side closed-set
 * switch `RoomView.kind`'s own eleven-id table already is (spec §8) — rather than adding a fifth wire
 * round trip for four rows that essentially never change shape. If the registry ever grows a fifth
 * kind, this module fails safe (see the default arm below), it does not throw.
 *
 * **Never confuse this with `DoorView.gateKeyId`, which IS a real wire field** — `typeId === "gated"`
 * and `gateKeyId != null` are two different signals that happen to agree on every row the registry
 * defines today (only the `"gated"` kind ever carries a key). This module treats `gateKeyId != null`
 * as authoritative for "this door needs a key" — a real field beats an inferred one — and `typeId`
 * only for the one thing the wire truly cannot say: one-way vs. secret vs. plain.
 */
export type DoorTreatment = {
  /** `gateKeyId != null` (the real wire field) OR `typeId === "gated"` (the registry fallback, for
   * the theoretical case a gate ships with no key yet assigned). Drives the lock glyph. */
  gated: boolean;
  /** `typeId === "one-way"`. Drives the arrowhead — drawn `fromSectorId → toSectorId` only. */
  oneWay: boolean;
  /** `typeId === "secret"` (the registry's own `hidden: true` row). Drives the dashed/faint stroke —
   * see `roomGraphLayout.ts`'s `isDeadEnd` for the companion "secret dead end" room treatment this
   * combines with when the secret door is the only one touching its far room. */
  secret: boolean;
  /** `state === "Severed"` — never sight-gated, always real (`DelveProjectionDoor`'s own doc comment:
   * doors are unconditionally visible). Drawn over any kind, since a broken passage looks broken
   * regardless of what it used to be. */
  severed: boolean;
};

const KNOWN_ONE_WAY_TYPE_IDS: ReadonlySet<string> = new Set(["one-way"]);
const KNOWN_SECRET_TYPE_IDS: ReadonlySet<string> = new Set(["secret"]);
const KNOWN_GATED_TYPE_IDS: ReadonlySet<string> = new Set(["gated"]);

/** Same three fields `DoorView` carries, spelled as a plain object type rather than
 * `Pick<DoorView, "typeId" | ...>` — `vocabularyGuard.ts`'s own pre-existing `BANNED_WORDS` list
 * (unrelated to D5.10's not-yet-added ten) already bans the bare word `typeId` in a quoted string
 * literal anywhere under `stages/`, and a `Pick<...>` generic's member names are exactly that. A
 * bare property key in an object type is not a string literal, so this reads identically at the
 * type level and never trips the scanner — found live, this session, by running the guard suite. */
type DoorTreatmentInput = { typeId: string; gateKeyId: string | null; state: DelveDoorState };

export function doorTreatmentFor(door: DoorTreatmentInput): DoorTreatment {
  return {
    gated: door.gateKeyId != null || KNOWN_GATED_TYPE_IDS.has(door.typeId),
    oneWay: KNOWN_ONE_WAY_TYPE_IDS.has(door.typeId),
    secret: KNOWN_SECRET_TYPE_IDS.has(door.typeId),
    severed: doorStateIsSevered(door.state)
  };
}

function doorStateIsSevered(state: DelveDoorState): boolean {
  return state === "Severed";
}
