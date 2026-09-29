import type { ForceView, SlotView } from "@/contract/types";
import { translateForceKind } from "@/ui/world/worldEnums";

export type SlotRowState =
  | "empty"
  | "built"
  | "under-construction"
  | "guarded"
  | "cleared"
  | "depleted"
  | "ruined";

/**
 * The seven slot row states (world-stage W62), derived from `SlotState`/`GuardState`/structure
 * presence — **the player never sees either enum** (GG-23). `Ruined`/`Depleted` are terminal and win
 * outright; a live guard (`guardState === "Intact"`) blocks anything else from mattering yet; a
 * structure decides built vs under-construction; `Claimed` is an ownership fact, not a row state of
 * its own (it isn't one of the seven the spec names) — it falls through the same built/empty paths
 * `Intact` does. `"cleared"` is the one three-way read: `guardState` alone cannot distinguish "never
 * had a guard" from "had one, now gone" — only `guardWaveId` being non-null despite `Cleared` proves
 * a guard was ever here at all (the same derivation `worldViewModel.ts`'s old `slotViews()` already
 * used for exactly this reason).
 */
export function slotRowState(slot: SlotView): SlotRowState {
  if (slot.state === "Ruined") return "ruined";
  if (slot.state === "Depleted") return "depleted";
  if (slot.guardState === "Intact") return "guarded";
  if (slot.structureId != null) {
    const underConstruction =
      slot.constructionTurnsRemaining.state === "known" &&
      slot.constructionTurnsRemaining.value != null &&
      slot.constructionTurnsRemaining.value > 0;
    return underConstruction ? "under-construction" : "built";
  }
  if (slot.guardState === "Cleared" && slot.guardWaveId != null) return "cleared";
  return "empty";
}

export type SlotRowProps = {
  slot: SlotView;
  /** Needed only to name a live guard as a force, not an id — the same `forces` block 7 renders. */
  forces: ForceView[];
};

export function SlotRow({ slot, forces }: SlotRowProps) {
  const rowState = slotRowState(slot);
  const guard = rowState === "guarded" ? forces.find((f) => f.entityId === slot.guardWaveId) : undefined;

  const sentence = (() => {
    switch (rowState) {
      case "empty":
        return "Empty.";
      case "built":
        return `${slot.slotTypeId} — ${slot.structureId}.`;
      case "under-construction": {
        const turns =
          slot.constructionTurnsRemaining.state === "known" ? slot.constructionTurnsRemaining.value : null;
        return `${slot.slotTypeId} — ${slot.structureId}, ${turns} turn${turns === 1 ? "" : "s"} to build.`;
      }
      case "guarded":
        return guard
          ? `Guarded by ${translateForceKind(guard.kind)}.`
          : "Guarded.";
      case "cleared":
        return "Guard cleared.";
      case "depleted":
        // Lowercase, mid-sentence — never the exact wire-token casing ("Depleted"), even though
        // the underlying word happens to read naturally in English (GG-23 is about the token, not
        // whether the word is otherwise pleasant to read).
        return "Its source is depleted — cannot be built on again.";
      case "ruined":
        return "This ground is ruined — cannot be built on again.";
      default: {
        const exhaustive: never = rowState;
        throw new Error(`SlotRow: unhandled state ${JSON.stringify(exhaustive)}`);
      }
    }
  })();

  return (
    <li data-testid={`slot-row-${slot.slotIndex}`} data-state={rowState} className="text-sm text-text">
      {sentence}
    </li>
  );
}
