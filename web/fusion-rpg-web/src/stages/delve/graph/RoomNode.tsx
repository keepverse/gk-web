import type { RoomView } from "@/contract/types";
import { cn } from "@/lib/cn";
import { roomKindLabel } from "@/stages/delve/labels";
import { FightInPlace, type RoomFightState } from "./FightInPlace";
import { roomCentre } from "./roomGraphLayout";
import { sightRevealFor } from "./sightTreatment";

export type RoomNodeProps = {
  room: RoomView;
  selected: boolean;
  /** Precomputed by the caller from `roomGraphLayout.isDeadEnd` + `doorKind.doorTreatmentFor(...).secret`
   * on this room's one door — kept out of this component so it stays a pure function of one room's
   * own fields plus one boolean, not a second place that re-derives graph structure. */
  secretDeadEnd: boolean;
  /**
   * When set, this room is the site of an active fight (D5.5, spec §7: "the room node expands in
   * place; enemies, ranks and the strike feed animate there"). Precomputed by the caller — same
   * posture as `secretDeadEnd` — and gated here on `sight === "Full"` (see `expanded` below): a room
   * only glimpsed or unlit never reveals fight detail, extending the existing sight-gating rule
   * (`sightTreatment.ts`) to this new content the same way every other Full-only field already works.
   * That extension is not separately spec'd — it is the direct, honest consequence of applying an
   * existing rule to a new field, named here rather than silently assumed.
   */
  fight?: RoomFightState | null;
  onSelect: () => void;
};

/**
 * One room card (D5.4, spec-delve-stage.md §4/§7). Three sight treatments plus the secret-dead-end
 * overlay, composing `sightTreatment.ts` (what content shows) and `labels.ts`'s own `roomKindLabel`
 * (what the kind reads as) — the same split `SectorNode.tsx` already establishes on the world map
 * (`sectorChannels` decides, the component only composes), applied here to a genuinely different data
 * shape (a delve room is sight-gated per-field by the server, not classified into an FE-owned channel
 * set). Consolidated onto the real `stages/delve/labels.ts` (D5.10, built concurrently this same
 * session) rather than this module's own earlier narrow pull-forward — see that file's own header
 * comment, which names this exact consolidation and reasons through the two fallback differences.
 *
 * A real `<button>`, not a clickable `<div>` — GG-19/GG-21 and `spec-board-render.md`'s own "keyboard
 * cell navigation... not mouse-only" rule apply to every board/graph surface in this program, and a
 * native button gets Tab order plus Enter/Space activation for free rather than needing a second,
 * hand-rolled keyboard handler.
 */
export function RoomNode({ room, selected, secretDeadEnd, fight, onSelect }: RoomNodeProps) {
  const reveal = sightRevealFor(room.sight);
  const label = reveal.showsKind ? roomKindLabel(room.resolvedKind ?? room.kind) : null;
  const centre = roomCentre(room);
  // A room only glimpsed or unlit never reveals fight detail — see this prop's own doc comment above.
  const expanded = fight != null && reveal.showsDetail;

  return (
    <button
      type="button"
      data-testid={`delve-room-${room.sectorId}`}
      data-sight={room.sight}
      data-selected={selected}
      data-visited={room.visited}
      data-cleared={room.cleared}
      data-secret-dead-end={secretDeadEnd}
      data-fight-expanded={expanded}
      aria-pressed={selected}
      aria-label={expanded ? `${label ?? "Undiscovered room"} — fight in progress` : (label ?? "Undiscovered room")}
      onClick={onSelect}
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col",
        "rounded border text-[11px] leading-tight text-text",
        // The room's own box growing in place, not a separate layer mounting — reuses M1's duration
        // and easing (`information-architecture.md` §10, "Layer in", 180ms `ease-out`) for the same
        // "reveal" semantics, even though the geometry differs (this grows the node itself rather than
        // opening a second element) — a documented reuse, not a new, uncounted motion value.
        "transition-[width,height] duration-[180ms] ease-out",
        // No z-index here (bandGuard/GG-5: only the seven `.band-*` tiers may set one, and this
        // stays inside `.band-stage`) — an expanded room paints above its siblings because
        // `DelveGraph.tsx`'s own `orderedRooms` renders any actively-fighting room last, not
        // because of a stacking-tier override.
        expanded
          ? "h-64 w-80 items-start justify-start overflow-auto p-2 text-left"
          : "h-16 w-16 items-center justify-center",
        reveal.showsKind ? "bg-panel" : "bg-soil",
        // `border-ink` — a real, pre-existing bug, found live while verifying D5.5's own expand
        // animation (see `FightInPlace.tsx`'s identical finding): `ink` (without `-dark`) has never
        // been a registered theme color — `docs/design/_kit/tokens.css` only ever defines `--ink-dark`
        // ("ink for use on bright fills"), confirmed by reading the generated `tokens.css` and its own
        // source kit directly, not guessed. The selected ring was rendering fully invisible. `border-
        // border-strong` is the real, already-registered "stronger version of the base `border-border`"
        // token — the pair this file's own unselected branch already half-implies.
        selected ? "border-2 border-border-strong" : "border-border",
        secretDeadEnd ? "border-dashed" : "border-solid",
        room.cleared ? "opacity-100" : reveal.showsKind ? "opacity-90" : "opacity-60"
      )}
      style={{ left: centre.x, top: centre.y }}
    >
      {label ? <span data-testid="delve-room-kind">{label}</span> : <span aria-hidden="true">?</span>}
      {reveal.showsDetail && room.cleared ? (
        <span data-testid="delve-room-cleared-mark" aria-hidden="true">
          ✓
        </span>
      ) : null}
      {room.keyForLaneId != null ? (
        <span data-testid="delve-room-key-mark" aria-hidden="true">
          🔑
        </span>
      ) : null}
      {expanded ? <FightInPlace fight={fight.fight} steered={fight.steered} /> : null}
    </button>
  );
}
