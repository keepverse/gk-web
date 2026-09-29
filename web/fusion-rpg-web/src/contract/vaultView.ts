import type { VaultView } from "./types";

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 1 (plan Task 4D.2a) — the vault-block
 * fold leg that `adaptSectorStorage` (plan Task 4A.3, `adapt.ts`) does not own: the lifecycle
 * binding plus the capture-header input. Rows, room, fractions, and refusal-copy keys stay
 * where 4A.3 put them — this file adds no second fold of any of those.
 *
 * - `vaultPhase`: `SlotCapacity == 0` → locked-with-unlock-line naming `relic-vault` (GG-17,
 *   the one new lifecycle binding); empty vault with capacity → `empty` with next action;
 *   otherwise `ready`. The two are never confused. Structural bounds only (`int` slot counts,
 *   commented as such in the spec's §Numeric types) — never a magnitude cap, never `f(Θ)`.
 * - `vaultHeaderOwner`: the live `OwnerFactionId` passthrough — the capture-header input
 *   (claim-endpoints §Design 4–5: the header always shows "held by X"). Untouched, never
 *   prettified (ideal §2.7): `null` stays `null` so the block renders absence honestly.
 *
 * Fog prohibition (spec §Boundaries Never): zero position compares, zero void/empty filtering,
 * zero `visible: false` handling — `VaultView` carries no position and no visibility member,
 * so there is nothing here to compare or filter even by accident. No toast is fired here
 * either: the winner's header already says "held by" them — toast is loser-directed only
 * (4D.2b owns the loser toast off the report entry; this block never imports the notify rail).
 */
export type VaultPhase = "locked" | "empty" | "ready";

export function vaultPhase(view: VaultView): VaultPhase {
  if (view.slotCapacity.value <= 0) return "locked";
  if (view.slotsUsed.value <= 0) return "empty";
  return "ready";
}

export function vaultHeaderOwner(view: VaultView): string | null {
  return view.ownerFactionId;
}
