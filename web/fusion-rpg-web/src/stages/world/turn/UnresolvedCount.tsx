import { useRef, useState } from "react";
import { legionLabel } from "@/stages/world/labels";
import type { PendingOrder } from "@/stages/world/worldSelection";
import type { LegionView } from "@/contract/types";
import { PerMilleFigure } from "@/ui/world/PerMilleFigure";
import { unresolvedLegions } from "./unresolvedLegions";
import { useWorldVerbs } from "./worldVerbs";
import { isWorldMapChromeMuted } from "@/stages/world/mapChromeMute";

export type UnresolvedCountProps = {
  legions: readonly LegionView[];
  pending: readonly PendingOrder[];
  /** `WorldEntityDto.DisplayName` per entity — this component never touches a `*Dto` type itself, so
   * the caller (the one place already sanctioned to) looks these up and hands them over. */
  displayNames: Readonly<Record<string, string | null>>;
  /** Fires when cycling lands on a legion, so the caller can select/focus it on the map. Never fires
   * on its own — cycling is player-initiated, always. */
  onFocus: (entityId: string) => void;
};

/**
 * world-stage W80 (spec-world-turn.md §3) — the live unresolved count, with the cycle control on the
 * count itself so reading the problem and acting on it are one gesture. Cycling is tracked by the
 * legion's own id, never by index: a legion that drops out of the unresolved set (an order was filed
 * for it, by whatever means) makes the count fall back to showing the bare set again rather than
 * silently jumping to a different legion — this component never takes a selection from the player
 * between their own actions (the Civ VI failure the spec names).
 */
export function UnresolvedCount({ legions, pending, displayNames, onFocus }: UnresolvedCountProps) {
  const unresolved = unresolvedLegions(legions, pending);
  const [cycledId, setCycledId] = useState<string | null>(null);
  const current = cycledId != null ? (unresolved.find((l) => l.entityId === cycledId) ?? null) : null;

  function cycleNext() {
    if (unresolved.length === 0) return;
    const currentIndex = current ? unresolved.findIndex((l) => l.entityId === current.entityId) : -1;
    const next = unresolved[(currentIndex + 1) % unresolved.length]!;
    setCycledId(next.entityId);
    onFocus(next.entityId);
  }

  // `worldVerbs.ts` registers once per mount and never re-registers on every render (its own effect
  // only reruns when the key/id list changes), so the handler it holds would otherwise close over a
  // stale `unresolved`/`current` from whichever render happened to be live at mount. The ref keeps the
  // registered callback thin and stable while always reading this render's real values.
  const cycleNextRef = useRef(cycleNext);
  cycleNextRef.current = cycleNext;
  useWorldVerbs([
    {
      key: "w",
      id: "world-turn-cycle",
      handler: () => {
        if (isWorldMapChromeMuted()) return;
        cycleNextRef.current();
      }
    }
  ]);

  if (current) {
    const label = legionLabel(current.entityId, displayNames[current.entityId] ?? null);
    return (
      <button type="button" data-testid="unresolved-count" onClick={cycleNext}>
        <span data-testid="unresolved-count-subject">
          {label.state === "known" ? label.value : current.entityId}
        </span>
        {" — "}
        <PerMilleFigure reading="march-remaining" value={current.movementRemaining} />
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="unresolved-count"
      onClick={cycleNext}
      disabled={unresolved.length === 0}
      title={unresolved.length === 0 ? "Nothing left to cycle to — every legion has orders" : undefined}
    >
      {unresolved.length} legion{unresolved.length === 1 ? "" : "s"} with moves left and no orders
    </button>
  );
}
