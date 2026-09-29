import type { SlotView } from "@/contract/types";

/**
 * The world-map door's own "which slot kind opens a delve" rule (party-dungeon D1.28, acceptance:
 * "reuses the four existing slot kinds Lair · Tear · Vault · Anomaly (`SlotTypeCatalog.cs:14-20`)
 * mapped to domain themes — no new SlotKind", decision 14). The four ids below are
 * `SlotTypeCatalog.cs`'s own `SlotTypeId` literals for `SlotKind.Lair`/`.Tear`/`.Vault`/`.Anomaly`
 * (`World/SlotTypeCatalog.cs:70-76`) — reused verbatim, never re-derived, and never a fifth kind.
 *
 * **What "mapped to domain themes" means here, precisely, after reading the real wire (2026-09-07):**
 * `DomainRow.Theme` (`Delve/Domains/DomainRow.cs:23`) is Core-only content — `DomainOffers.For`
 * (`Delve/Domains/DomainOffers.cs:95-103`) builds `DomainOfferDto` field-by-field and never copies
 * `Theme` onto it, so no domain "theme" value ever reaches this file; there is nothing on the wire to
 * read. And the six real domain seed files that do exist (`gk-data/packs/fusion/data/seed/dungeon/domains/*.json`) carry a
 * `theme` shaped like a creature-species reference (e.g. `domain.fire-001.json`'s own
 * `"theme": "creature.scaredyshroom"`), not an English word a slot kind could sensibly match against —
 * there is no live or content-authored link from a world-map slot kind to a specific domain anywhere
 * in the system today (a real, separate gap, named here rather than papered over with an invented
 * link). So the only mapping actually buildable today is the one this module owns: the map slot's
 * OWN kind name (`SlotTypeCatalog.cs`'s own `Name` field) doubles as the door's display "theme" — a
 * labelling reuse, not a content filter. *Which* real domain the door then offers comes from the live
 * catalog instead (`useDelveDomainOffers`, `lib/bus/world.ts`), never from this table.
 */
const DELVE_DOOR_SLOT_THEME: Record<string, string> = {
  lair: "Lair",
  tear: "Rift Tear",
  vault: "Vault",
  anomaly: "Anomaly"
};

/**
 * The first slot in a sector eligible to open a delve, or `null` if this sector has none of the four
 * reused kinds — the door's own structural gate (present only where it could ever apply, the same
 * way `SlotRow`/`ForceRow` only render for rows that exist, rather than a permanently-irrelevant row
 * on every sector in the game). First-match, not "the only match": a sector with two eligible slots
 * still shows exactly one door row (D1.28's own "one action row"), named here explicitly as a
 * simplification rather than a silent one.
 */
export function delveDoorSlot(slots: readonly SlotView[]): SlotView | null {
  return slots.find((slot) => slot.slotTypeId in DELVE_DOOR_SLOT_THEME) ?? null;
}

/** The door row's own label — "Open a Lair delve," etc. Never a raw `slotTypeId` (GG-23). */
export function delveDoorLabel(slot: SlotView): string {
  const theme = DELVE_DOOR_SLOT_THEME[slot.slotTypeId] ?? slot.slotTypeId;
  return `Open a ${theme} delve`;
}

/**
 * `ActionCluster`'s own reason token for "the door is present but there is nothing to send yet."
 * True for every sector today: `GET /api/delve/domains/{playerId}` always returns `[]` in production
 * (`dungeon_domain` has no write arm — D4.16, confirmed still unbuilt 2026-09-07,
 * `DelveEndpoints.cs`'s own class doc) — the SAME reason the picker itself (D5.8, `DelvePickerLayer`,
 * Phase 5, unbuilt) will have nothing to offer either; this is an upstream content gap shared by both
 * entry points, not specific to the door. `reasonFor.ts` degrades an unrecognised token honestly
 * (its own test: "renders real text through reasonFor's own fallback, never the raw string"), so this
 * needs no entry in `playbackTable.ts` to render safely.
 */
export const DELVE_DOOR_NONE_DISCOVERED_REASON = "delve.none-discovered";
