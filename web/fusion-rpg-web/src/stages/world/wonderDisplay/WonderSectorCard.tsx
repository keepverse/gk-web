import type { CSSProperties } from "react";
import type { SectorView, SlotView } from "@/contract/types";
import { resolveTheme } from "@/features/gui-lego/themeRegistry";
import {
  foldWonderCard,
  type WonderCatalogRow,
  type WonderProgress
} from "./wonderDisplayFold";
import { wonderDisplayAction, type WonderDisplayAction } from "./wonderDisplayBus";

export type WonderSectorCardProps = {
  slot: SlotView;
  sector: SectorView;
  /** The slot's own world-catalog row — null while unread (cap renders pending, never guessed). */
  catalogRow?: WonderCatalogRow | null;
  catalogProvided?: boolean;
  /** Closed-bus sink; every button stays enabled (GG-55) and files here. */
  onEvent?: (action: WonderDisplayAction) => void;
};

/**
 * empire-wonder-surfaces `wonder-display` (plan Task 4D.4, spec §Design 1) — the sector-card
 * recipe, mounted in the `SectorInspector` slots block instead of the legacy `SlotRow` sentence
 * for Wonder slots (identity + effect + construction-progress). Paint arrives from the
 * `wonder-scope-*` / `wonder-rarity-*` packs via `resolveTheme` — no hard-coded scope/rarity
 * colour map lives here (Lego violation, not taste). Copy arrives from the display catalog via
 * the fold — no id, no wire reason, no literal renders. No ambient animation (GG-32 honored:
 * the packs' `vfx` slots are null and this card starts none).
 *
 * Shared density is consumed by name: the rising meter carries
 * `data-piece="capacity-meter" data-density="progress"` (4D.1 owns the piece; a second meter
 * beside it is the SOLID fork this module must fail review on), and the foundation line links
 * the sibling shelf (`data-shelf="wonder-relic-shelf"`) instead of re-implementing it (GG-9).
 */
export function WonderSectorCard({ slot, sector, catalogRow, catalogProvided, onEvent }: WonderSectorCardProps) {
  const reading = foldWonderCard({ slot, sector, catalogRow, catalogProvided });
  if (reading.kind === "not-wonder") return null;

  const fire = (event: string) => onEvent?.(wonderDisplayAction(event, slot.structureId));

  if (reading.kind === "placeholder") {
    const teaser = reading.lockedReason != null;
    return (
      <div
        data-testid="wonder-sector-card"
        data-reading={teaser ? "locked-teaser" : "placeholder"}
        className="text-sm text-text"
      >
        {slot.wonderScope != null ? (
          <span
            data-testid="wonder-scope-badge"
            data-theme={`wonder-scope.${slot.wonderScope}`}
            style={resolveTheme({ kind: "wonder-scope", id: slot.wonderScope }).css as CSSProperties}
          >
            {slot.wonderScope}
          </span>
        ) : null}
        {teaser ? (
          <div data-testid="wonder-locked-reason">{reading.lockedReason}</div>
        ) : (
          <div data-testid="wonder-placeholder">{reading.copy}</div>
        )}
        <button type="button" data-testid="wonder-expand" onClick={() => fire(teaser ? "wonder-display.teaser.explain" : reading.action)}>
          Read more
        </button>
      </div>
    );
  }

  const scopeTheme = resolveTheme(reading.themeRefs.scope);
  const rarityTheme = resolveTheme(reading.themeRefs.rarity);
  const progress = reading.progress;
  const capState = reading.cap.state;
  const progressState = progress.state;

  return (
    <section
      data-testid="wonder-sector-card"
      data-scope={reading.scope}
      data-rarity={reading.rarity}
      data-progress={progressState}
      data-cap={capState}
      className="text-sm text-text"
    >
      <div data-testid="wonder-name">{reading.name}</div>
      <span
        data-testid="wonder-scope-badge"
        data-theme={`wonder-scope.${reading.scope}`}
        style={scopeTheme.css as CSSProperties}
      >
        {reading.scope}
      </span>{" "}
      <span
        data-testid="wonder-rarity-badge"
        data-theme={`wonder-rarity.${reading.rarity}`}
        style={rarityTheme.css as CSSProperties}
      >
        {reading.rarity}
      </span>
      <div data-testid="wonder-effect">{reading.effectSentence}</div>
      <WonderProgress progress={progress} buildTurns={catalogRow?.buildTurns} />
      {reading.cap.state === "known" ? (
        <div data-testid="wonder-cap-line">{reading.cap.line}</div>
      ) : null}
      {reading.cap.state === "pending" ? (
        <div data-testid="wonder-cap-pending">{reading.cap.reason}</div>
      ) : null}
      {reading.cap.state === "pending" ? (
        <button type="button" data-testid="wonder-retry" onClick={() => fire("wonder-display.retry")}>
          Retry
        </button>
      ) : null}
      {reading.lockedReason != null ? (
        <div data-testid="wonder-locked-reason">{reading.lockedReason}</div>
      ) : null}
      <button
        type="button"
        data-testid="wonder-relic-shelf-link"
        data-shelf="wonder-relic-shelf"
        onClick={() => fire("wonder-display.reading.open")}
      >
        Foundation treasure — open the relic shelf
      </button>
    </section>
  );
}

function WonderProgress({ progress, buildTurns }: { progress: WonderProgress; buildTurns?: number }) {
  if (progress.state === "built") return null;
  if (progress.state === "pending") {
    return <div data-testid="wonder-progress-pending">{progress.reason}</div>;
  }
  const fraction =
    buildTurns != null && buildTurns > 0 ? Math.min(1, Math.max(0, 1 - progress.nightsLeft / buildTurns)) : null;
  return (
    <>
      <div data-testid="wonder-progress">
        {`rising — ${progress.nightsLeft} night${progress.nightsLeft === 1 ? "" : "s"} left`}
      </div>
      <div
        data-testid="wonder-capacity-meter"
        data-piece="capacity-meter"
        data-density="progress"
        {...(fraction != null ? { "data-fraction": fraction } : {})}
      >
        <div>
          <div style={fraction != null ? { width: `${fraction * 100}%` } : undefined} />
        </div>
      </div>
    </>
  );
}
