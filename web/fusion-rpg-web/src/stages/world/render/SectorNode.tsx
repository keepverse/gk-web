import type { Magnitude } from "@/contract/types";
import { LoamFigure } from "@/ui/world/LoamFigure";
import type { Channels } from "./sectorChannels";
import { ALL_SLOT_KINDS, glyphFor, markerGlyph, silhouetteFor, type SlotMarker } from "./slotSilhouettes";

export type SectorSlotView = {
  slotIndex: number;
  slotTypeId: string;
  marker: SlotMarker;
};

export type SectorNodeProps = {
  sectorId: string;
  channels: Channels;
  slots: SectorSlotView[];
  /** `null` for a sector this faction does not own — the yield row is owner-only and never renders otherwise. */
  netLoam: Magnitude | null;
  /** §4.2's zoom rule: at map zoom the slot row and flags row drop first; ownership, health and net never do. */
  zoom: "map" | "detail";
};

/**
 * One sector card (world-stage W44) — four independent state slots (ownership, health, content,
 * yield), composing `sectorChannels.ts` (W43) and `LoamFigure` (`world-numbers` W39). Density
 * ceiling is the fully-populated node; each zoom tier is a strict superset of the legibility below.
 *
 * No hex literal anywhere — every colour is `channels.token`, a named class, never a raw value —
 * and a greyscale render still reads: shape, border, pattern and glyph all carry the same facts
 * colour does, per `sectorChannels.ts`'s own GG-27 guarantee.
 */
export function SectorNode({ sectorId, channels, slots, netLoam, zoom }: SectorNodeProps) {
  if (channels.shape === "unknown") {
    return (
      <div data-testid={`sector-node-${sectorId}`} data-shape="unknown" className="text-sm text-muted">
        <span aria-hidden="true">?</span> unexplored
      </div>
    );
  }

  return (
    <div
      data-testid={`sector-node-${sectorId}`}
      data-shape={channels.shape}
      data-token={channels.token}
      data-border-style={channels.border.style}
      data-border-weight={channels.border.weight}
      className="text-sm text-text"
    >
      {/* Ownership: crest + word, never dropped at any zoom tier. */}
      <div data-testid="sector-ownership">
        <span aria-hidden="true">{channels.crest}</span> {channels.word}
      </div>

      {/* Health: pattern (rendered as a data attribute a stylesheet keys off — no hex) + glyph + word
          folded into the same sentence above; never dropped either. */}
      {channels.pattern ? <div data-testid="sector-health-pattern" data-pattern={channels.pattern} /> : null}
      {channels.glyph ? (
        <div data-testid="sector-health-glyph">
          <span aria-hidden="true">{channels.glyph}</span>
        </div>
      ) : null}
      {channels.meterMilli !== null ? (
        <div data-testid="sector-health-meter">{channels.meterMilli}</div>
      ) : null}

      {/* Content: all 14 slot kinds, five silhouettes plus a naming glyph, plus guarded/built/building
          markers — drops first at map zoom. */}
      {zoom === "detail" ? (
        <div data-testid="sector-slots">
          {slots.map((slot) => (
            <span
              key={slot.slotIndex}
              data-testid={`slot-${slot.slotIndex}`}
              data-silhouette={silhouetteFor(slot.slotTypeId)}
            >
              <span aria-hidden="true">{glyphFor(slot.slotTypeId)}</span>
              {slot.marker ? (
                <span data-testid={`slot-${slot.slotIndex}-marker`} aria-hidden="true">
                  {markerGlyph(slot.marker)}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* Yield: owner-only, through LoamFigure, never dropped at any zoom tier. */}
      {netLoam ? (
        <div data-testid="sector-yield">
          <LoamFigure kind="flow" amount={netLoam} period="per turn" />
        </div>
      ) : null}
    </div>
  );
}

export { ALL_SLOT_KINDS };
