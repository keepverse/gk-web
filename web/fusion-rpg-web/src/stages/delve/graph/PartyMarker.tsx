import type { PartyView } from "@/contract/types";
import { partyBannerLabel } from "@/stages/delve/labels";
import type { Point } from "./roomGraphLayout";

export type PartyMarkerProps = {
  party: PartyView;
  /** A room's centre when `atSectorId` is set, or the midpoint of the lane it is marching when only
   * `onLaneId` is set — `DelveGraph.tsx` resolves which and passes the plain point, so this component
   * never needs the room/door list itself. */
  position: Point;
};

/**
 * One party's position marker (D5.4, spec-delve-stage.md §4: "party markers"). Never renders
 * `partyIndex` raw — spec §8: *"`PartyIndex` (never rendered)... four fixed names"* — always through
 * `partyBannerLabel`.
 */
export function PartyMarker({ party, position }: PartyMarkerProps) {
  const label = partyBannerLabel(party.partyIndex);

  return (
    <div
      data-testid={`delve-party-${party.entityId}`}
      data-party-index={party.partyIndex}
      role="img"
      aria-label={`${label} — ${party.members.length} member${party.members.length === 1 ? "" : "s"}`}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border-strong bg-panel-raised px-2 py-0.5 text-[10px] text-text"
      style={{ left: position.x, top: position.y }}
    >
      <span aria-hidden="true">⚑</span>
      <span data-testid="delve-party-label">{label}</span>
    </div>
  );
}
